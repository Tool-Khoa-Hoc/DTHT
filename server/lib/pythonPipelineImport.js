import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const PYTHON_EXPORT_SCRIPT = resolve(PROJECT_ROOT, 'exam-importer', 'export_import_result.py');
const DEFAULT_PYTHON_CMD = process.env.EXAM_IMPORT_PYTHON_CMD || 'python';
const INLINE_MARK_TO_TOKEN = {
  bold: 'b',
  italic: 'i',
  sup: 'sup',
  sub: 'sub',
};

function normalizeQuestionType(type) {
  const value = String(type || '').trim().toLowerCase();
  if (!value) return 'unknown';
  if (value === 'true_false') return 'true_false_group';
  return value;
}

function stripMarkupToRawText(rawMarkup) {
  const lines = String(rawMarkup || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => {
      let out = String(line || '');
      for (let i = 0; i < 8; i += 1) {
        const next = out.replace(/\[!(?:b|i|sup|sub):\$([^$]+)\$\]/gi, '$1');
        if (next === out) break;
        out = next;
      }
      out = out.replace(/\[(?:!m|math):\$([^$]+)\$\]/gi, '$1');
      out = out.replace(/\[img:\$([^$]+)\$\]/gi, (_match, imageId) => `[img:$${imageId}$]`);
      out = out.replace(/\[br\]/gi, '\n');
      return out
        .split('\n')
        .map((part) => part.replace(/[ \t]+/g, ' ').trim())
        .filter(Boolean)
        .join('\n');
    });
  return lines.filter(Boolean).join('\n');
}

function collectAssetRefs(value, target) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) collectAssetRefs(item, target);
    return;
  }
  if (typeof value === 'object') {
    if (typeof value.image_id === 'string' && value.image_id.trim()) {
      target.add(`image:${value.image_id.trim()}`);
    }
    if (typeof value.math_id === 'string' && value.math_id.trim()) {
      target.add(`math:${value.math_id.trim()}`);
    }
    for (const nested of Object.values(value)) collectAssetRefs(nested, target);
    return;
  }
  if (typeof value === 'string') {
    const imageMatches = value.match(/\[img:\$([^$]+)\$\]/g) || [];
    const mathMatches = value.match(/\[!m:\$([^$]+)\$\]/g) || [];
    for (const token of imageMatches) {
      const match = token.match(/\[img:\$([^$]+)\$\]/);
      if (match?.[1]) target.add(`image:${match[1]}`);
    }
    for (const token of mathMatches) {
      const match = token.match(/\[!m:\$([^$]+)\$\]/);
      if (match?.[1]) target.add(`math:${match[1]}`);
    }
  }
}

function buildAssetList(stemBlocks, options, statements, answerSlots, tableBlocks) {
  const refs = new Set();
  collectAssetRefs(stemBlocks, refs);
  collectAssetRefs(options, refs);
  collectAssetRefs(statements, refs);
  collectAssetRefs(answerSlots, refs);
  collectAssetRefs(tableBlocks, refs);
  return Array.from(refs).map((ref) => {
    const [type, id] = ref.split(':');
    return { type, id };
  });
}

function normalizeAcceptedAnswers(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }
  if (value === null || value === undefined) return [];
  return String(value)
    .split(/\r?\n|\||,\s+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSingleChoiceKey(value) {
  const text = String(value || '').trim().toUpperCase();
  if (/^[A-Z]$/.test(text)) return text;
  return null;
}

function deriveTableBlocks(stemBlocks) {
  return Array.isArray(stemBlocks)
    ? stemBlocks.filter((block) => block && typeof block === 'object' && block.type === 'table')
    : [];
}

function wrapTextWithMarks(text, marks) {
  let value = String(text || '');
  for (const mark of Array.isArray(marks) ? marks : []) {
    const token = INLINE_MARK_TO_TOKEN[String(mark || '').toLowerCase()];
    if (!token || !value) continue;
    value = `[!${token}:$${value}$]`;
  }
  return value;
}

function normalizePythonInlineNode(node) {
  if (typeof node === 'string') {
    return { type: 'text', text: node };
  }
  if (!node || typeof node !== 'object') {
    return null;
  }

  const type = String(node.type || '').toLowerCase();
  if (type === 'text') {
    const text = String(node.text || '');
    if (!text) return null;
    const marks = Array.isArray(node.marks) ? node.marks : [];
    return marks.length > 0
      ? { type: 'text', text, marks }
      : { type: 'text', text };
  }
  if (type === 'math') {
    const latex = String(node.latex || node.text || '').trim();
    return latex ? { type: 'math', text: latex } : null;
  }
  if (type === 'image') {
    const imageId = String(node.image_id || '').trim();
    return imageId ? { type: 'image', image_id: imageId } : null;
  }

  if (typeof node.text === 'string' && node.text.trim()) {
    return { type: 'text', text: wrapTextWithMarks(node.text, node.marks) };
  }
  if (typeof node.image_id === 'string' && node.image_id.trim()) {
    return { type: 'image', image_id: node.image_id.trim() };
  }
  return null;
}

function normalizePythonInlineList(nodes) {
  return (Array.isArray(nodes) ? nodes : [])
    .map((node) => normalizePythonInlineNode(node))
    .filter(Boolean);
}

function normalizePythonTableRow(row) {
  const sourceCells = Array.isArray(row)
    ? row
    : Array.isArray(row?.cells)
      ? row.cells
      : [];

  return sourceCells
    .map((cell) => normalizePythonInlineList(Array.isArray(cell) ? cell : [cell]))
    .filter((cell) => cell.length > 0);
}

function normalizePythonBlock(block) {
  if (!block || typeof block !== 'object') {
    return null;
  }

  const type = String(block.type || '').toLowerCase();
  if (type === 'paragraph') {
    if (Array.isArray(block.children)) {
      return block;
    }
    const children = normalizePythonInlineList(block.inlines);
    return children.length > 0 ? { type: 'paragraph', children } : null;
  }

  if (type === 'table') {
    const rows = (Array.isArray(block.rows) ? block.rows : [])
      .map((row) => normalizePythonTableRow(row))
      .filter((row) => row.length > 0);
    return rows.length > 0 ? { type: 'table', rows } : null;
  }

  if (type === 'text' || type === 'math' || type === 'image') {
    const inlineNode = normalizePythonInlineNode(block);
    return inlineNode ? { type: 'paragraph', children: [inlineNode] } : null;
  }

  if (Array.isArray(block.children)) {
    return block;
  }

  return block;
}

function normalizePythonBlocks(blocks) {
  return (Array.isArray(blocks) ? blocks : [])
    .map((block) => normalizePythonBlock(block))
    .filter(Boolean);
}

function extToContentType(filename, fallback = '') {
  const ext = String(filename || '').split('.').pop()?.toLowerCase() || '';
  if (fallback) return fallback;
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'svg') return 'image/svg+xml';
  if (ext === 'webp') return 'image/webp';
  return 'application/octet-stream';
}

async function materializeAssetBundle(pyAssets) {
  const images = pyAssets?.images && typeof pyAssets.images === 'object'
    ? pyAssets.images
    : {};
  const math = pyAssets?.math && typeof pyAssets.math === 'object'
    ? pyAssets.math
    : {};

  const nextImages = {};
  for (const [imageId, imageMeta] of Object.entries(images)) {
    const source = String(imageMeta?.source || '').trim();
    if (source.startsWith('data:')) {
      nextImages[imageId] = { ...imageMeta, source };
      continue;
    }

    const pathValue = String(imageMeta?.path || '').trim();
    if (!pathValue) {
      nextImages[imageId] = { ...imageMeta };
      continue;
    }

    try {
      const payload = await readFile(pathValue);
      const contentType = extToContentType(imageMeta?.filename || pathValue, imageMeta?.content_type);
      nextImages[imageId] = {
        id: imageId,
        filename: imageMeta?.filename || '',
        content_type: contentType,
        source: `data:${contentType};base64,${payload.toString('base64')}`,
      };
    } catch {
      nextImages[imageId] = { ...imageMeta };
    }
  }

  return { images: nextImages, math };
}

export function convertPythonPublicToServerPublic(pyPublicJson, assetBundle = null) {
  const title = pyPublicJson?.title || 'Imported exam';
  const assets = assetBundle && typeof assetBundle === 'object'
    ? assetBundle
    : (pyPublicJson?.assets && typeof pyPublicJson.assets === 'object'
      ? pyPublicJson.assets
      : { images: {}, math: {} });

  const parts = Array.isArray(pyPublicJson?.parts)
    ? pyPublicJson.parts
    : Array.isArray(pyPublicJson?.sections)
      ? pyPublicJson.sections
      : [];

  const sections = parts.map((part, sectionIndex) => {
    const partId = part?.id || `section_${sectionIndex + 1}`;
    const partTitle = part?.name || part?.title || `PHẦN ${sectionIndex + 1}`;
    const questionType = normalizeQuestionType(part?.type);
    const sourceQuestions = Array.isArray(part?.questions) ? part.questions : [];

    const questions = sourceQuestions.map((question, questionIndex) => {
      const type = normalizeQuestionType(question?.type || questionType);
      const stemBlocks = normalizePythonBlocks(question?.stem_blocks);
      const options = Array.isArray(question?.choices)
        ? question.choices.map((choice, index) => ({
          key: String(choice?.id || String.fromCharCode(65 + index)).toUpperCase(),
          content: normalizePythonBlocks(choice?.content_blocks),
        }))
        : [];
      const statements = Array.isArray(question?.statements)
        ? question.statements.map((statement, index) => ({
          id: String(statement?.id || String.fromCharCode(97 + index)).toLowerCase(),
          content: normalizePythonBlocks(statement?.content_blocks),
        }))
        : [];
      const slotCount = type === 'short_answer'
        ? Math.max(1, Number(question?.answer_slot_count || 1))
        : 0;
      const answerSlots = Array.from({ length: slotCount }, (_, index) => ({ id: `slot_${index + 1}` }));
      const tableBlocks = deriveTableBlocks(stemBlocks);
      const assetList = buildAssetList(stemBlocks, options, statements, answerSlots, tableBlocks);
      const sourceNo = Number(question?.source_number);
      const no = Number.isFinite(sourceNo) ? sourceNo : questionIndex + 1;

      return {
        id: question?.id || `${partId}.q${questionIndex + 1}`,
        no,
        display_no: String(no),
        type,
        stem_blocks: stemBlocks,
        options,
        statements,
        answer_slots: answerSlots,
        table_blocks: tableBlocks,
        assets: assetList,
        solution_url: null,
      };
    });

    return {
      id: partId,
      title: partTitle,
      question_type: questionType,
      questions,
    };
  });

  return {
    document_type: 'exam',
    title,
    meta: {
      organization: null,
      exam_name: title,
      subject: pyPublicJson?.meta?.subject ?? null,
      duration_minutes: pyPublicJson?.meta?.duration_minutes ?? null,
      exam_code: null,
    },
    assets,
    solution_url: null,
    sections,
  };
}

export function convertPythonPrivateToServerPrivate(pyPrivateJson, examPublicJson, fullRawMarkup) {
  const answerKey = pyPrivateJson?.answer_key && typeof pyPrivateJson.answer_key === 'object'
    ? pyPrivateJson.answer_key
    : {};

  const questionKeys = [];
  for (const section of Array.isArray(examPublicJson?.sections) ? examPublicJson.sections : []) {
    for (const question of Array.isArray(section?.questions) ? section.questions : []) {
      const type = normalizeQuestionType(question?.type);
      const rawValue = answerKey[question.id];

      let normalizedAnswerKey = null;
      let acceptedAnswers = null;
      let normalization = null;

      if (type === 'single_choice') {
        const selected = normalizeSingleChoiceKey(rawValue);
        normalizedAnswerKey = selected ? { selected_option: selected } : null;
      } else if (type === 'true_false_group') {
        if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
          const keyMap = {};
          for (const [key, value] of Object.entries(rawValue)) {
            if (value === true || value === false) keyMap[key] = value;
          }
          normalizedAnswerKey = Object.keys(keyMap).length > 0 ? keyMap : null;
        }
      } else if (type === 'short_answer') {
        acceptedAnswers = normalizeAcceptedAnswers(rawValue);
        normalization = acceptedAnswers.length > 0 ? { trim: true, lowercase: true } : null;
      } else if (rawValue !== null && rawValue !== undefined) {
        normalizedAnswerKey = rawValue;
      }

      questionKeys.push({
        question_id: question.id,
        type,
        answer_key: normalizedAnswerKey,
        accepted_answers: acceptedAnswers,
        normalization,
        scoring: { method: 'exact', points: 1 },
      });
    }
  }

  return {
    document_type: 'exam_private',
    question_keys: questionKeys,
    import_data: {
      raw_markup: fullRawMarkup,
      raw_text: stripMarkupToRawText(fullRawMarkup),
      assets: examPublicJson?.assets || { images: {}, math: {} },
      parser_notes: [],
      validation_hints: [],
    },
  };
}

function runPythonImport(docxPath, assetDir, title) {
  return new Promise((resolvePromise, rejectPromise) => {
    const args = [PYTHON_EXPORT_SCRIPT, docxPath, '--asset-dir', assetDir];
    if (title) {
      args.push('--title', title);
    }

    const child = spawn(DEFAULT_PYTHON_CMD, args, {
      cwd: PROJECT_ROOT,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      rejectPromise(error);
    });
    child.on('close', (code) => {
      if (code !== 0) {
        rejectPromise(new Error(stderr.trim() || `Python import failed with exit code ${code}.`));
        return;
      }
      try {
        resolvePromise(JSON.parse(stdout));
      } catch (error) {
        rejectPromise(new Error(`Invalid JSON from python import bridge: ${error.message}`));
      }
    });
  });
}

export async function buildDraftViaPythonPipeline(buffer, filename) {
  const tempRoot = await mkdtemp(join(tmpdir(), 'exam-import-'));
  try {
    const docxPath = join(tempRoot, filename || 'uploaded.docx');
    const assetDir = join(tempRoot, 'assets');
    await mkdir(assetDir, { recursive: true });
    await writeFile(docxPath, buffer);

    const imported = await runPythonImport(docxPath, assetDir, filename);
    const fullRawMarkup = String(imported?.full_raw_markup || '');
    const assetBundle = await materializeAssetBundle(imported?.exam_public_json?.assets || {});
    const examPublicJson = convertPythonPublicToServerPublic(imported?.exam_public_json || {}, assetBundle);
    const examPrivateJson = convertPythonPrivateToServerPrivate(
      imported?.exam_private_json || {},
      examPublicJson,
      fullRawMarkup,
    );

    return {
      import_engine: 'python_pipeline',
      full_raw_markup: fullRawMarkup,
      exam_public_json: examPublicJson,
      exam_private_json: examPrivateJson,
      validation_report: imported?.validation_report || { errors: [], warnings: [], stats: {} },
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

export { stripMarkupToRawText };
