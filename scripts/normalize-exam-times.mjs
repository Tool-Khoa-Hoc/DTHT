import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { normalizeExamTimeMinutes, normalizeSubjectFolder } from './exam-utils.js';

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function resolveExamSubject(rootType, subjectFolder, examData) {
  if (rootType === 'public') {
    return normalizeSubjectFolder(subjectFolder || examData?.subject);
  }
  return normalizeSubjectFolder(examData?.subject || subjectFolder);
}

async function normalizeExamFile(examJsonPath, { rootType, subjectFolder = '' } = {}) {
  const raw = await fs.readFile(examJsonPath, 'utf8');
  const examData = JSON.parse(raw);
  if (!examData || typeof examData !== 'object' || Array.isArray(examData)) {
    return { changed: false, reason: 'invalid' };
  }

  const subject = resolveExamSubject(rootType, subjectFolder, examData);
  const normalizedTime = normalizeExamTimeMinutes(
    subject,
    examData.time,
    examData.duration_minutes ?? examData.durationMinutes ?? null,
  );

  if (normalizedTime === null || examData.time === normalizedTime) {
    return { changed: false, reason: 'unchanged' };
  }

  const nextPayload = `${JSON.stringify({ ...examData, time: normalizedTime }, null, 2)}\n`;
  await fs.writeFile(examJsonPath, nextPayload, 'utf8');
  return { changed: true, subject, time: normalizedTime };
}

async function normalizePublicExams(rootDir) {
  const examsRoot = path.join(rootDir, 'public', 'data', 'exams');
  if (!(await fileExists(examsRoot))) {
    return { changed: 0, scanned: 0 };
  }

  let changed = 0;
  let scanned = 0;
  const subjectEntries = await fs.readdir(examsRoot, { withFileTypes: true });

  for (const subjectEntry of subjectEntries) {
    if (!subjectEntry.isDirectory()) continue;
    const subjectFolder = subjectEntry.name;
    const subjectDir = path.join(examsRoot, subjectFolder);
    const examEntries = await fs.readdir(subjectDir, { withFileTypes: true });

    for (const examEntry of examEntries) {
      if (!examEntry.isDirectory()) continue;
      const examJsonPath = path.join(subjectDir, examEntry.name, 'exam.json');
      if (!(await fileExists(examJsonPath))) continue;

      scanned += 1;
      const result = await normalizeExamFile(examJsonPath, { rootType: 'public', subjectFolder });
      if (result.changed) changed += 1;
    }
  }

  return { changed, scanned };
}

async function normalizeOutputExams(rootDir) {
  const outputRoot = path.join(rootDir, 'output');
  if (!(await fileExists(outputRoot))) {
    return { changed: 0, scanned: 0 };
  }

  let changed = 0;
  let scanned = 0;
  const entries = await fs.readdir(outputRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const examJsonPath = path.join(outputRoot, entry.name, 'exam.json');
    if (!(await fileExists(examJsonPath))) continue;

    scanned += 1;
    const result = await normalizeExamFile(examJsonPath, { rootType: 'output' });
    if (result.changed) changed += 1;
  }

  return { changed, scanned };
}

export async function normalizeAllExamTimes({ rootDir = process.cwd(), silent = false } = {}) {
  const publicResult = await normalizePublicExams(rootDir);
  const outputResult = await normalizeOutputExams(rootDir);

  if (!silent) {
    console.log(
      `[normalize-exam-times] public changed ${publicResult.changed}/${publicResult.scanned}, ` +
      `output changed ${outputResult.changed}/${outputResult.scanned}`,
    );
  }

  return {
    public: publicResult,
    output: outputResult,
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

  await normalizeAllExamTimes({ rootDir, silent });
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  runCli().catch((error) => {
    console.error('[normalize-exam-times] failed:', error?.message || error);
    process.exitCode = 1;
  });
}
