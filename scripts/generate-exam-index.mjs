import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const INDEX_FILENAME = 'index.json';

function getSubjectUiMeta(subject = '') {
  const normalized = String(subject).toLowerCase();
  if (normalized.includes('toán')) {
    return { icon: 'functions', color: 'from-blue-500 to-indigo-600' };
  }
  if (normalized.includes('lý')) {
    return { icon: 'architecture', color: 'from-emerald-500 to-teal-600' };
  }
  if (normalized.includes('anh')) {
    return { icon: 'language', color: 'from-rose-500 to-pink-600' };
  }
  if (normalized.includes('hóa')) {
    return { icon: 'science', color: 'from-amber-500 to-orange-600' };
  }
  if (normalized.includes('sinh')) {
    return { icon: 'biotech', color: 'from-green-500 to-lime-600' };
  }
  return { icon: 'quiz', color: 'from-slate-500 to-slate-600' };
}

function getQuestionCount(examData) {
  if (!Array.isArray(examData?.parts)) {
    return 0;
  }
  return examData.parts.reduce((total, part) => {
    if (!Array.isArray(part?.questions)) {
      return total;
    }
    return total + part.questions.length;
  }, 0);
}

function normalizeIndexCandidate({ examData, subjectFolder, examPath, updatedAt }) {
  const examId = String(examData?.id || '').trim() || examPath;
  const subjectValue = subjectFolder;
  const ui = getSubjectUiMeta(subjectValue);

  return {
    id: examId,
    title: examData.title,
    subject: subjectValue,
    subjectFolder,
    examPath,
    time: examData.time,
    color: ui.color,
    icon: ui.icon,
    questions: getQuestionCount(examData),
    updated_at: updatedAt,
  };
}

async function collectIndexCandidates(examsRoot) {
  const candidates = [];
  let skipped = 0;

  const subjectEntries = await fs.readdir(examsRoot, { withFileTypes: true });
  for (const subjectEntry of subjectEntries) {
    if (!subjectEntry.isDirectory()) {
      continue;
    }

    const subjectFolder = subjectEntry.name;
    const subjectDir = path.join(examsRoot, subjectFolder);
    const examEntries = await fs.readdir(subjectDir, { withFileTypes: true });

    for (const examEntry of examEntries) {
      if (!examEntry.isDirectory()) {
        continue;
      }

      const examPath = examEntry.name;
      const examJsonPath = path.join(subjectDir, examPath, 'exam.json');

      let examStat;
      try {
        examStat = await fs.stat(examJsonPath);
      } catch {
        continue;
      }

      try {
        const raw = await fs.readFile(examJsonPath, 'utf8');
        const examData = JSON.parse(raw);

        if (
          !examData ||
          typeof examData !== 'object' ||
          Array.isArray(examData) ||
          !examData.title ||
          !Object.prototype.hasOwnProperty.call(examData, 'parts')
        ) {
          skipped += 1;
          continue;
        }

        candidates.push(normalizeIndexCandidate({
          examData,
          subjectFolder,
          examPath,
          updatedAt: examStat.mtimeMs / 1000,
        }));
      } catch {
        skipped += 1;
      }
    }
  }

  return { candidates, skipped };
}

function dedupeCandidates(candidates) {
  const byRoute = new Set();
  const bySubjectAndId = new Set();
  const deduped = [];
  let skipped = 0;

  const sortedByFreshness = [...candidates].sort(
    (left, right) => Number(right.updated_at || 0) - Number(left.updated_at || 0),
  );

  for (const item of sortedByFreshness) {
    const routeKey = `${item.subjectFolder || ''}::${item.examPath || ''}`;
    const examId = String(item.id || '').trim();
    const subjectFolder = String(item.subjectFolder || '').trim();
    const subjectAndIdKey = examId ? `${subjectFolder}::${examId}` : '';

    if (byRoute.has(routeKey)) {
      skipped += 1;
      continue;
    }

    if (subjectAndIdKey && bySubjectAndId.has(subjectAndIdKey)) {
      skipped += 1;
      continue;
    }

    byRoute.add(routeKey);
    if (subjectAndIdKey) {
      bySubjectAndId.add(subjectAndIdKey);
    }
    deduped.push(item);
  }

  deduped.sort((left, right) => {
    const subjectCompare = String(left.subjectFolder || '').localeCompare(String(right.subjectFolder || ''));
    if (subjectCompare !== 0) {
      return subjectCompare;
    }
    return String(left.examPath || '').localeCompare(String(right.examPath || ''));
  });

  return { deduped, skipped };
}

export async function generateExamIndex({ rootDir = process.cwd(), silent = false } = {}) {
  const examsRoot = path.join(rootDir, 'public', 'data', 'exams');
  const indexPath = path.join(examsRoot, INDEX_FILENAME);

  const { candidates, skipped: skippedFromParse } = await collectIndexCandidates(examsRoot);
  const { deduped, skipped: skippedFromDedupe } = dedupeCandidates(candidates);
  const skipped = skippedFromParse + skippedFromDedupe;

  const nextPayload = `${JSON.stringify(deduped, null, 2)}\n`;
  let previousPayload = null;
  try {
    previousPayload = await fs.readFile(indexPath, 'utf8');
  } catch {
    previousPayload = null;
  }

  const changed = previousPayload !== nextPayload;
  if (changed) {
    await fs.writeFile(indexPath, nextPayload, 'utf8');
  }

  if (!silent) {
    const status = changed ? 'updated' : 'unchanged';
    console.log(`[exam-index] ${status}: ${deduped.length} items, skipped ${skipped}`);
  }

  return {
    changed,
    items: deduped.length,
    skipped,
    indexPath,
  };
}

async function runCli() {
  const args = process.argv.slice(2);
  let rootDir = process.cwd();
  let silent = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--silent') {
      silent = true;
      continue;
    }
    if (arg === '--root') {
      const nextValue = args[index + 1];
      if (!nextValue) {
        throw new Error('--root requires a value');
      }
      rootDir = path.resolve(nextValue);
      index += 1;
    }
  }

  await generateExamIndex({ rootDir, silent });
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  runCli().catch((error) => {
    console.error('[exam-index] failed:', error?.message || error);
    process.exitCode = 1;
  });
}
