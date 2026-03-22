import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { gzipSync, deflateSync } from 'node:zlib';
import { buildDraftFromDocx } from './lib/docxImport.js';
import { buildExamReviewPackage } from './lib/reviewPackage.js';
import {
  ensureStoreFile,
  getExamRecord,
  listPublishedExamRecords,
  upsertExamKeyRecord,
  upsertExamRecord,
} from './lib/store.js';

function resolvePort() {
  const argv = Array.isArray(process.argv) ? process.argv.slice(2) : [];
  const flagIndex = argv.findIndex((arg) => arg === '--port');
  const cliValue = flagIndex >= 0 ? argv[flagIndex + 1] : null;
  const raw = cliValue || process.env.EXAM_REVIEW_API_PORT || '8787';
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 8787;
}

const PORT = resolvePort();

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://dautruonghoctap.io.vn'
];

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}

function checkAuth(req) {
  const adminToken = process.env.ADMIN_TOKEN || 'dtht_secret_token_123';
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.split(' ')[1];
  return token === adminToken;
}

let examListCache = { data: null, timestamp: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 mins

function invalidateCache() {
  examListCache.data = null;
  examListCache.timestamp = 0;
}

function sendJson(req, res, statusCode, payload, cacheMaxAge = 0) {
  setCorsHeaders(req, res);

  if (cacheMaxAge > 0 && statusCode === 200) {
    res.setHeader('Cache-Control', `public, max-age=${cacheMaxAge}`);
  } else {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  }

  const jsonString = JSON.stringify(payload);
  let buffer = Buffer.from(jsonString, 'utf-8');

  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (jsonString.length > 1024) { // Only compress if > 1KB
    if (acceptEncoding.includes('gzip')) {
      res.setHeader('Content-Encoding', 'gzip');
      buffer = gzipSync(buffer);
    } else if (acceptEncoding.includes('deflate')) {
      res.setHeader('Content-Encoding', 'deflate');
      buffer = deflateSync(buffer);
    }
  }

  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', buffer.length);
  res.end(buffer);
}

function normalizeQuestionType(type) {
  const t = String(type || '').toLowerCase().trim();
  if (t === 'true_false') return 'true_false_group';
  if (!t) return 'unknown';
  return t;
}

function normalizeSubjectText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getQuestionPoints(questionType, subject) {
  if (questionType === 'single_choice') return 0.25;
  if (questionType === 'true_false_group') return [0.1, 0.25, 0.5, 1];
  if (questionType === 'short_answer') {
    const normalizedSubject = normalizeSubjectText(subject);
    return normalizedSubject.includes('toan') || normalizedSubject.includes('math') ? 0.5 : 0.25;
  }
  return null;
}

function normalizeAssetBundle(input) {
  if (!input || typeof input !== 'object') {
    return { images: {}, math: {} };
  }
  const images = (input.images && typeof input.images === 'object' && !Array.isArray(input.images))
    ? input.images
    : {};
  const math = (input.math && typeof input.math === 'object' && !Array.isArray(input.math))
    ? input.math
    : {};
  return { images, math };
}

function sanitizeUrlOrNull(input) {
  if (input === null || input === undefined || String(input).trim() === '') return null;
  try {
    const value = String(input).trim();
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  return JSON.parse(text);
}

async function readMultipartForm(req) {
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  const MAX_SIZE = 20 * 1024 * 1024; // 20MB
  
  if (contentLength > MAX_SIZE) {
    throw new Error('Payload too large. Max 20MB allowed.');
  }

  const host = req.headers.host || `127.0.0.1:${PORT}`;
  const request = new Request(`http://${host}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: req,
    duplex: 'half',
  });
  return request.formData();
}

function getQuestionsFromPublic(examPublicJson) {
  const sections = Array.isArray(examPublicJson?.sections) ? examPublicJson.sections : [];
  return sections.flatMap((section) => (Array.isArray(section?.questions) ? section.questions : []));
}

function findQuestion(examPublicJson, questionId) {
  const sections = Array.isArray(examPublicJson?.sections) ? examPublicJson.sections : [];
  for (let s = 0; s < sections.length; s += 1) {
    const questions = Array.isArray(sections[s]?.questions) ? sections[s].questions : [];
    for (let q = 0; q < questions.length; q += 1) {
      if (String(questions[q]?.id) === String(questionId)) {
        return {
          sectionIndex: s,
          questionIndex: q,
          question: questions[q],
          section: sections[s],
        };
      }
    }
  }
  return null;
}

function getOrCreatePrivateKeyEntry(examPrivateJson, questionId, questionType) {
  if (!Array.isArray(examPrivateJson.question_keys)) {
    examPrivateJson.question_keys = [];
  }

  let entry = examPrivateJson.question_keys.find((item) => String(item?.question_id) === String(questionId));
  if (!entry) {
    entry = {
      question_id: questionId,
      type: normalizeQuestionType(questionType),
      answer_key: null,
      accepted_answers: null,
      normalization: null,
      scoring: { method: 'exact', points: 1 },
    };
    examPrivateJson.question_keys.push(entry);
  }

  entry.type = normalizeQuestionType(questionType);
  if (!entry.scoring || typeof entry.scoring !== 'object') {
    entry.scoring = { method: 'exact', points: 1 };
  }
  return entry;
}

function wrapMarksAsTokens(text, marks) {
  let value = String(text || '');
  for (const mark of Array.isArray(marks) ? marks : []) {
    const normalized = String(mark || '').toLowerCase();
    if (!value) continue;
    if (normalized === 'bold') value = `[!b:$${value}$]`;
    else if (normalized === 'italic') value = `[!i:$${value}$]`;
    else if (normalized === 'sub') value = `[!sub:$${value}$]`;
    else if (normalized === 'sup') value = `[!sup:$${value}$]`;
  }
  return value;
}

function inlineNodeToText(node) {
  if (typeof node === 'string') return node;
  if (!node || typeof node !== 'object') return '';

  if (node.math !== undefined) {
    return `[!m:$${String(node.math || '')}$]`;
  }
  if (node.blank !== undefined) {
    return String(node.blank || node.id || '...');
  }

  const type = String(node.type || '').toLowerCase();
  if (type === 'text') {
    return wrapMarksAsTokens(node.text || '', node.marks);
  }
  if (type === 'math') {
    return `[!m:$${String(node.text || node.latex || '')}$]`;
  }
  if (type === 'image') {
    const imageId = String(node.image_id || '').trim();
    return imageId ? `[img:$${imageId}$]` : '';
  }
  if (type === 'blank') {
    return String(node.text || node.id || '...');
  }
  if (typeof node.text === 'string') {
    return wrapMarksAsTokens(node.text, node.marks);
  }
  return '';
}

function rowToText(row) {
  const cells = Array.isArray(row)
    ? row
    : (Array.isArray(row?.cells) ? row.cells : []);
  if (cells.length === 0) return '';
  const renderedCells = cells.map((cell) => {
    if (Array.isArray(cell)) return cell.map((item) => inlineNodeToText(item)).join('');
    return inlineNodeToText(cell);
  });
  return `[* ${renderedCells.join(' | ')} *]`;
}

function blockToText(block) {
  if (typeof block === 'string') return block;
  if (!block || typeof block !== 'object') return '';
  if (Array.isArray(block)) return block.map((node) => inlineNodeToText(node)).join('');

  if (typeof block.text === 'string' && !block.type) {
    return wrapMarksAsTokens(block.text, block.marks);
  }

  const type = String(block.type || '').toLowerCase();
  if (type === 'paragraph') {
    const children = Array.isArray(block.children)
      ? block.children
      : (Array.isArray(block.inlines) ? block.inlines : []);
    return children.map((node) => inlineNodeToText(node)).join('');
  }
  if (type === 'table') {
    return (Array.isArray(block.rows) ? block.rows : [])
      .map((row) => rowToText(row))
      .filter(Boolean)
      .join('\n');
  }
  if (type === 'image' || type === 'math' || type === 'text' || type === 'blank') {
    return inlineNodeToText(block);
  }
  if (type === 'group') {
    return (Array.isArray(block.children) ? block.children : [])
      .map((child) => blockToText(child))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function blocksToText(blocks) {
  if (!Array.isArray(blocks)) return '';
  return blocks
    .map((block) => blockToText(block))
    .filter(Boolean)
    .join('\n')
    .trim();
}

function buildReviewResponse(record) {
  const review = buildExamReviewPackage({
    examPublicJson: record.exam_public_json,
    examPrivateJson: record.exam_private_json,
    validationReport: record.validation_report,
  });
  const assets = normalizeAssetBundle(
    record.exam_private_json?.import_data?.assets || record.exam_public_json?.assets,
  );

  const questionSolutionUrls = {};
  for (const question of getQuestionsFromPublic(record.exam_public_json)) {
    questionSolutionUrls[question.id] = question.solution_url || null;
  }

  return {
    exam_id: record.id,
    exam_status: record.status,
    exam_solution_url: record.exam_public_json?.solution_url || null,
    question_solution_urls: questionSolutionUrls,
    raw_markup: record.exam_private_json?.import_data?.raw_markup || '',
    raw_text: record.exam_private_json?.import_data?.raw_text || '',
    assets,
    import_debug: {
      import_meta: record.import_meta || null,
      full_raw_markup:
        record.full_raw_markup ||
        record.exam_private_json?.import_data?.raw_markup ||
        '',
      exam_public_json: record.exam_public_json || null,
      exam_private_json: record.exam_private_json || null,
      validation_report: record.validation_report || null,
    },
    ...review,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function optionLabelToIndex(label) {
  const normalized = String(label || '').trim().toUpperCase();
  if (!/^[A-Z]$/.test(normalized)) return null;
  return normalized.charCodeAt(0) - 65;
}

function buildRuntimePartId(sectionIndex) {
  return `part${sectionIndex + 1}`;
}

function buildRuntimeQuestionId(questionIndex) {
  return `q${questionIndex + 1}`;
}

function buildRuntimeStatementId(questionIndex, statementIndex) {
  return `q${questionIndex + 1}${String.fromCharCode(97 + statementIndex)}`;
}

function extractQuestionKeyMap(examPrivateJson) {
  const entries = Array.isArray(examPrivateJson?.question_keys) ? examPrivateJson.question_keys : [];
  const map = new Map();
  for (const entry of entries) {
    if (!entry?.question_id) continue;
    map.set(String(entry.question_id), entry);
  }
  return map;
}

function getDurationMinutes(record) {
  return Number(record?.exam_public_json?.meta?.duration_minutes || record?.duration_minutes || 0) || 0;
}

function buildPublishedExamResources(record) {
  const examId = String(record?.id || '').trim();
  return {
    edit_link: examId ? `/admin/composer?examId=${encodeURIComponent(examId)}` : null,
    solution_url: record?.exam_public_json?.solution_url || null,
  };
}

function buildRuntimeExamFromRecord(record) {
  const sections = Array.isArray(record?.exam_public_json?.sections) ? record.exam_public_json.sections : [];
  const assets = normalizeAssetBundle(
    record?.exam_private_json?.import_data?.assets || record?.exam_public_json?.assets,
  );
  const examSubject = record?.exam_public_json?.meta?.subject || record?.subject || 'Đề thi online';

  return {
    id: record.id,
    title: record?.exam_public_json?.title || record?.exam_public_json?.meta?.exam_name || 'Đề thi online',
    subject: examSubject,
    time: getDurationMinutes(record),
    description: record?.exam_public_json?.description || null,
    resources: {
      edit_link: `/admin/composer?examId=${encodeURIComponent(record.id)}`,
      solution_url: record?.exam_public_json?.solution_url || null,
    },
    _assets: assets,
    parts: sections.map((section, sectionIndex) => {
      const partId = buildRuntimePartId(sectionIndex);
      const rawQuestions = Array.isArray(section?.questions) ? section.questions : [];
      return {
        id: partId,
        name: section?.title || `PHẦN ${sectionIndex + 1}`,
        description: section?.description || null,
        questions: rawQuestions.map((question, questionIndex) => {
          const runtimeQuestionId = buildRuntimeQuestionId(questionIndex);
          const normalizedType = normalizeQuestionType(question?.type);
          const options = (Array.isArray(question?.options) ? question.options : []).map((option) => (
            Array.isArray(option?.content) ? option.content : []
          ));
          const statements = (Array.isArray(question?.statements) ? question.statements : []).map((statement, statementIndex) => ({
            id: buildRuntimeStatementId(questionIndex, statementIndex),
            content: Array.isArray(statement?.content) ? statement.content : [],
          }));
          return {
            id: runtimeQuestionId,
            source_question_id: question?.id || null,
            no: Number(question?.no || questionIndex + 1),
            type: normalizedType === 'true_false_group' ? 'true_false' : normalizedType,
            content: Array.isArray(question?.stem_blocks) ? question.stem_blocks : [],
            options,
            statements,
            points: getQuestionPoints(normalizedType, examSubject),
          };
        }),
      };
    }),
  };
}

function buildAnswerKeyFromRecord(record) {
  const sections = Array.isArray(record?.exam_public_json?.sections) ? record.exam_public_json.sections : [];
  const privateLookup = extractQuestionKeyMap(record?.exam_private_json);
  const answerKey = {};

  sections.forEach((section, sectionIndex) => {
    const partId = buildRuntimePartId(sectionIndex);
    const questions = Array.isArray(section?.questions) ? section.questions : [];
    questions.forEach((question, questionIndex) => {
      const runtimeQuestionId = buildRuntimeQuestionId(questionIndex);
      const compositeKey = `${partId}.${runtimeQuestionId}`;
      const privateEntry = privateLookup.get(String(question?.id || '')) || null;
      const normalizedType = normalizeQuestionType(question?.type);

      if (normalizedType === 'single_choice') {
        const selectedLabel = parseSingleChoiceLabel(
          privateEntry?.answer_key?.selected_option ?? privateEntry?.answer_key,
        );
        const selectedIndex = optionLabelToIndex(selectedLabel);
        answerKey[compositeKey] = Number.isInteger(selectedIndex) ? selectedIndex : null;
        return;
      }

      if (normalizedType === 'true_false_group') {
        const rawKeyMap = privateEntry?.answer_key && typeof privateEntry.answer_key === 'object'
          ? privateEntry.answer_key
          : {};
        const normalizedMap = {};
        const statements = Array.isArray(question?.statements) ? question.statements : [];
        statements.forEach((statement, statementIndex) => {
          const sourceId = String(statement?.id || String.fromCharCode(97 + statementIndex)).toLowerCase();
          const runtimeStatementId = buildRuntimeStatementId(questionIndex, statementIndex);
          const rawValue =
            rawKeyMap[sourceId] ??
            rawKeyMap[runtimeStatementId] ??
            rawKeyMap[String(statement?.id || '')] ??
            null;
          normalizedMap[runtimeStatementId] = rawValue === true ? true : rawValue === false ? false : null;
        });
        answerKey[compositeKey] = normalizedMap;
        return;
      }

      if (normalizedType === 'short_answer') {
        const acceptedAnswers = parseAcceptedAnswers(
          privateEntry?.accepted_answers ??
          privateEntry?.answer_key?.accepted_answers ??
          privateEntry?.answer_key,
        );
        answerKey[compositeKey] = acceptedAnswers.length > 0 ? acceptedAnswers : null;
        return;
      }

      answerKey[compositeKey] = privateEntry?.answer_key ?? null;
    });
  });

  return answerKey;
}

function buildStudentExamCard(record) {
  const sections = Array.isArray(record?.exam_public_json?.sections) ? record.exam_public_json.sections : [];
  const questionCount = sections.reduce((total, section) => total + (Array.isArray(section?.questions) ? section.questions.length : 0), 0);

  return {
    id: record.id,
    title: record?.exam_public_json?.title || record?.exam_public_json?.meta?.exam_name || 'Đề thi online',
    subject: record?.exam_public_json?.meta?.subject || record?.subject || 'Đề thi online',
    time: getDurationMinutes(record),
    questions: questionCount,
    status: 'ongoing',
    subjectFolder: 'online',
    examPath: record.id,
    is_online: true,
    description: record?.exam_public_json?.description || null,
    published_at: record?.published_at || null,
  };
}

function reviewPackageToExamPublicJson(syncPayload) {
  const review = syncPayload?.exam_review_package || {};
  const sections = Array.isArray(review?.sections) ? review.sections : [];
  const questionSolutionUrls = syncPayload?.question_solution_urls || {};
  const examSolutionUrl = sanitizeUrlOrNull(syncPayload?.exam_solution_url);
  const assets = normalizeAssetBundle(syncPayload?.assets);

  return {
    document_type: 'exam',
    title: review?.meta?.title ?? null,
    meta: {
      organization: null,
      exam_name: review?.meta?.title ?? null,
      subject: review?.meta?.subject ?? null,
      duration_minutes: review?.meta?.duration_minutes ?? null,
      exam_code: null,
    },
    assets,
    solution_url: examSolutionUrl,
    sections: sections.map((section, sectionIndex) => ({
      id: section?.section_id || `section_${sectionIndex + 1}`,
      title: section?.title || `PHẦN ${sectionIndex + 1}`,
      question_type: normalizeQuestionType(section?.question_type || 'unknown'),
      questions: (Array.isArray(section?.questions) ? section.questions : []).map((question, questionIndex) => ({
        id: question?.question_id || `sec_${sectionIndex + 1}_q_${questionIndex + 1}`,
        no: Number(question?.no || questionIndex + 1),
        display_no: String(question?.no || questionIndex + 1),
        type: normalizeQuestionType(question?.type || 'unknown'),
        stem_blocks: Array.isArray(question?.render_data?.stem_blocks) ? question.render_data.stem_blocks : [],
        options: Array.isArray(question?.render_data?.options) ? question.render_data.options : [],
        statements: Array.isArray(question?.render_data?.statements) ? question.render_data.statements : [],
        answer_slots: Array.isArray(question?.render_data?.answer_slots) ? question.render_data.answer_slots : [],
        table_blocks: Array.isArray(question?.render_data?.table_blocks) ? question.render_data.table_blocks : [],
        assets: Array.isArray(question?.render_data?.assets) ? question.render_data.assets : [],
        solution_url: sanitizeUrlOrNull(questionSolutionUrls?.[question?.question_id]) || null,
      })),
    })),
  };
}

function reviewPackageToExamPrivateJson(syncPayload) {
  const review = syncPayload?.exam_review_package || {};
  const sections = Array.isArray(review?.sections) ? review.sections : [];
  const assets = normalizeAssetBundle(syncPayload?.assets);

  const questionKeys = [];
  for (const section of sections) {
    for (const question of Array.isArray(section?.questions) ? section.questions : []) {
      const type = normalizeQuestionType(question?.type || 'unknown');
      const current = question?.current_key_state || {};
      const answerKey = current?.answer_key || null;
      let normalizedAnswerKey = null;
      let acceptedAnswers = null;
      let normalization = null;

      if (type === 'single_choice') {
        const selected = parseSingleChoiceLabel(answerKey?.selected_option ?? answerKey);
        normalizedAnswerKey = selected ? { selected_option: selected } : null;
      } else if (type === 'true_false_group') {
        if (answerKey && typeof answerKey === 'object' && !Array.isArray(answerKey)) {
          const map = {};
          for (const [k, v] of Object.entries(answerKey)) {
            if (v === true || v === false) map[k] = v;
          }
          normalizedAnswerKey = Object.keys(map).length > 0 ? map : null;
        }
      } else if (type === 'short_answer') {
        acceptedAnswers = parseAcceptedAnswers(answerKey?.accepted_answers ?? answerKey);
        normalization = answerKey?.normalization || { trim: true, lowercase: true };
      } else {
        normalizedAnswerKey = answerKey;
      }

      questionKeys.push({
        question_id: question?.question_id,
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
      raw_markup: String(syncPayload?.raw_markup || ''),
      raw_text: String(syncPayload?.raw_text || ''),
      assets,
      parser_notes: [],
      validation_hints: [],
    },
  };
}

async function refreshAndSave(record) {
  record.updated_at = nowIso();
  await upsertExamRecord(record);
  return buildReviewResponse(record);
}

async function handleSyncLocal(req, res) {
  if (!checkAuth(req)) {
    return sendJson(req, res, 401, { error: 'Unauthorized. Admin token required.' });
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(req, res, 400, { error: 'Invalid JSON body.' });
  }

  const reviewPackage = body?.exam_review_package;
  if (!reviewPackage || typeof reviewPackage !== 'object') {
    return sendJson(req, res, 400, { error: 'exam_review_package is required.' });
  }

  const examPublicJson = reviewPackageToExamPublicJson(body);
  const examPrivateJson = reviewPackageToExamPrivateJson(body);
  const validationReport = runValidation(examPublicJson, examPrivateJson);

  const examId = randomUUID();
  const now = nowIso();
  const record = {
    id: examId,
    status: 'draft_review',
    created_at: now,
    updated_at: now,
    published_at: null,
    exam_public_json: examPublicJson,
    exam_private_json: examPrivateJson,
    validation_report: validationReport,
    full_raw_markup: String(body?.raw_markup || ''),
    import_meta: {
      engine: 'sync_local',
    },
  };

  await upsertExamRecord(record);
  return sendJson(req, res, 200, buildReviewResponse(record));
}

function parseSingleChoiceLabel(input) {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return String.fromCharCode(64 + Math.max(1, Math.min(26, input)));
  }
  const text = String(input || '').trim().toUpperCase();
  if (/^[A-Z]$/.test(text)) return text;
  if (/^\d+$/.test(text)) return parseSingleChoiceLabel(Number(text));
  return null;
}

function parseAcceptedAnswers(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((value) => String(value ?? '').trim())
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/\r?\n|\||,\s+/g)
      .map((value) => value.trim())
      .filter(Boolean);
  }
  if (raw === null || raw === undefined) return [];
  return [String(raw).trim()].filter(Boolean);
}

function normalizeIssueMap(validationReport) {
  const byQuestion = {};

  const add = (questionId, issue) => {
    if (!questionId) return;
    if (!byQuestion[questionId]) byQuestion[questionId] = [];
    byQuestion[questionId].push(issue);
  };

  for (const issue of Array.isArray(validationReport?.errors) ? validationReport.errors : []) {
    if (issue?.question_id) add(issue.question_id, issue);
  }
  for (const issue of Array.isArray(validationReport?.warnings) ? validationReport.warnings : []) {
    if (issue?.question_id) add(issue.question_id, issue);
  }

  validationReport.issues_by_question = byQuestion;
}

function runValidation(examPublicJson, examPrivateJson) {
  const sections = Array.isArray(examPublicJson?.sections) ? examPublicJson.sections : [];
  const questions = sections.flatMap((section) => Array.isArray(section?.questions) ? section.questions : []);
  const assets = normalizeAssetBundle(examPublicJson?.assets);
  const errors = [];
  const warnings = [];

  if (sections.length === 0 || questions.length === 0) {
    errors.push({
      level: 'error',
      code: 'broken_question_structure',
      message: 'No section/question found.',
      source: 'validator',
    });
  }

  for (const question of questions) {
    const stem = blocksToText(question.stem_blocks);
    if (!stem) {
      errors.push({
        level: 'error',
        code: 'missing_stem_blocks',
        message: 'Question stem is required.',
        source: 'validator',
        question_id: question.id,
      });
    }

    const qType = normalizeQuestionType(question.type);
    if (qType === 'single_choice' && (!Array.isArray(question.options) || question.options.length < 2)) {
      warnings.push({
        level: 'warning',
        code: 'broken_question_structure',
        message: 'Single choice should contain at least 2 options.',
        source: 'validator',
        question_id: question.id,
      });
    }

    if (qType === 'true_false_group' && (!Array.isArray(question.statements) || question.statements.length < 2)) {
      warnings.push({
        level: 'warning',
        code: 'broken_question_structure',
        message: 'True/false group should contain at least 2 statements.',
        source: 'validator',
        question_id: question.id,
      });
    }
  }

  const validationReport = {
    status: errors.length > 0 ? 'error' : 'ok',
    stats: {
      section_count: sections.length,
      question_count: questions.length,
      image_count: Object.keys(assets.images || {}).length,
      table_count: questions.reduce((acc, question) => acc + (Array.isArray(question.table_blocks) ? question.table_blocks.length : 0), 0),
      math_count: Object.keys(assets.math || {}).length,
    },
    errors,
    warnings,
    issues_by_question: {},
  };

  normalizeIssueMap(validationReport);

  if (!Array.isArray(examPrivateJson?.question_keys)) {
    examPrivateJson.question_keys = [];
  }
  return validationReport;
}

function routeMatch(pathname, pattern) {
  const match = pathname.match(pattern);
  if (!match) return null;
  return match.slice(1).map((value) => decodeURIComponent(value));
}

async function handleImport(req, res) {
  if (!checkAuth(req, res)) {
    return sendJson(req, res, 401, { error: 'Unauthorized. Admin token required.' });
  }
  try {
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    let fileBuffer = null;
    let filename = 'uploaded.docx';

    if (contentType.includes('multipart/form-data')) {
      const formData = await readMultipartForm(req);
      const file = formData.get('file');
      if (!file || typeof file.arrayBuffer !== 'function') {
        return sendJson(req, res, 400, { error: 'Missing file in multipart form. Use field name "file".' });
      }
      filename = file.name || filename;
      fileBuffer = Buffer.from(await file.arrayBuffer());
    } else {
      const body = await readJsonBody(req);
      if (body?.file_base64) {
        fileBuffer = Buffer.from(body.file_base64, 'base64');
        filename = body.filename || filename;
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return sendJson(req, res, 400, { error: 'No .docx payload found.' });
    }

    const imported = await buildDraftFromDocx(fileBuffer, filename);
    const examId = randomUUID();
    const now = nowIso();

    const record = {
      id: examId,
      status: 'draft_review',
      created_at: now,
      updated_at: now,
      published_at: null,
      exam_public_json: imported.exam_public_json,
      exam_private_json: imported.exam_private_json,
      validation_report: imported.validation_report,
      full_raw_markup: imported.full_raw_markup,
      import_meta: {
        engine: imported.import_engine || 'unknown',
      },
    };

    await upsertExamRecord(record);
    return sendJson(req, res, 200, buildReviewResponse(record));
  } catch (error) {
    return sendJson(req, res, 500, { error: error?.message || 'Import failed.' });
  }
}

async function handleGetReview(req, res, examId) {
  if (!checkAuth(req)) {
    return sendJson(req, res, 401, { error: 'Unauthorized. Admin token required.' });
  }
  const record = await getExamRecord(examId);
  if (!record) return sendJson(req, res, 404, { error: 'Exam not found.' });
  return sendJson(req, res, 200, buildReviewResponse(record));
}

async function handlePatchQuestion(req, res, examId, questionId) {
  if (!checkAuth(req)) {
    return sendJson(req, res, 401, { error: 'Unauthorized. Admin token required.' });
  }
  const record = await getExamRecord(examId);
  if (!record) return sendJson(req, res, 404, { error: 'Exam not found.' });

  const located = findQuestion(record.exam_public_json, questionId);
  if (!located) return sendJson(req, res, 404, { error: 'Question not found.' });

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(req, res, 400, { error: 'Invalid JSON body.' });
  }

  const nextType = normalizeQuestionType(body.type || located.question.type);
  located.question.type = nextType;

  if (Array.isArray(body.stem_blocks)) {
    located.question.stem_blocks = body.stem_blocks;
  }
  if (Array.isArray(body.options)) {
    located.question.options = body.options;
  }
  if (Array.isArray(body.statements)) {
    located.question.statements = body.statements;
  }
  if (Array.isArray(body.answer_slots)) {
    located.question.answer_slots = body.answer_slots;
  } else if (nextType === 'short_answer' && !Array.isArray(located.question.answer_slots)) {
    located.question.answer_slots = [{ id: 'slot_1' }];
  }

  if (Array.isArray(body.table_blocks)) {
    located.question.table_blocks = body.table_blocks;
  }
  if (Array.isArray(body.assets)) {
    located.question.assets = body.assets;
  }

  record.validation_report = runValidation(record.exam_public_json, record.exam_private_json);
  return sendJson(req, res, 200, await refreshAndSave(record));
}

async function handlePatchKey(req, res, examId, questionId) {
  if (!checkAuth(req)) {
    return sendJson(req, res, 401, { error: 'Unauthorized. Admin token required.' });
  }
  const record = await getExamRecord(examId);
  if (!record) return sendJson(req, res, 404, { error: 'Exam not found.' });

  const located = findQuestion(record.exam_public_json, questionId);
  if (!located) return sendJson(req, res, 404, { error: 'Question not found.' });

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(req, res, 400, { error: 'Invalid JSON body.' });
  }

  const questionType = normalizeQuestionType(located.question.type);
  const entry = getOrCreatePrivateKeyEntry(record.exam_private_json, questionId, questionType);

  if (questionType === 'single_choice') {
    const selected = parseSingleChoiceLabel(body?.answer_key?.selected_option ?? body?.selected_option ?? body?.answer_key);
    if (!selected) return sendJson(req, res, 400, { error: 'single_choice key requires selected_option (A/B/C/...).' });
    entry.answer_key = { selected_option: selected };
    entry.accepted_answers = null;
    entry.normalization = null;
  } else if (questionType === 'true_false_group') {
    const keyMap = body?.answer_key;
    if (!keyMap || typeof keyMap !== 'object' || Array.isArray(keyMap)) {
      return sendJson(req, res, 400, { error: 'true_false_group key requires answer_key object.' });
    }
    const normalized = {};
    for (const [k, v] of Object.entries(keyMap)) {
      if (v === true || v === false) normalized[k] = v;
    }
    if (Object.keys(normalized).length === 0) {
      return sendJson(req, res, 400, { error: 'No valid true/false values found in answer_key.' });
    }
    entry.answer_key = normalized;
    entry.accepted_answers = null;
    entry.normalization = null;
  } else if (questionType === 'short_answer') {
    const accepted = parseAcceptedAnswers(body?.accepted_answers ?? body?.answer_key ?? body?.value);
    entry.answer_key = null;
    entry.accepted_answers = accepted;
    entry.normalization = body?.normalization || { trim: true, lowercase: true };
  } else {
    entry.answer_key = body?.answer_key ?? null;
    entry.accepted_answers = parseAcceptedAnswers(body?.accepted_answers);
    entry.normalization = body?.normalization ?? null;
  }

  record.validation_report = runValidation(record.exam_public_json, record.exam_private_json);
  return sendJson(req, res, 200, await refreshAndSave(record));
}

async function handlePatchQuestionSolution(req, res, examId, questionId) {
  if (!checkAuth(req)) {
    return sendJson(req, res, 401, { error: 'Unauthorized. Admin token required.' });
  }
  const record = await getExamRecord(examId);
  if (!record) return sendJson(req, res, 404, { error: 'Exam not found.' });

  const located = findQuestion(record.exam_public_json, questionId);
  if (!located) return sendJson(req, res, 404, { error: 'Question not found.' });

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(req, res, 400, { error: 'Invalid JSON body.' });
  }

  const safeUrl = sanitizeUrlOrNull(body.solution_url);
  if (body.solution_url && !safeUrl) {
    return sendJson(req, res, 400, { error: 'solution_url must be http/https URL.' });
  }

  located.question.solution_url = safeUrl;
  return sendJson(req, res, 200, await refreshAndSave(record));
}

async function handlePatchExamSolution(req, res, examId) {
  if (!checkAuth(req)) {
    return sendJson(req, res, 401, { error: 'Unauthorized. Admin token required.' });
  }
  const record = await getExamRecord(examId);
  if (!record) return sendJson(req, res, 404, { error: 'Exam not found.' });

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(req, res, 400, { error: 'Invalid JSON body.' });
  }

  const safeUrl = sanitizeUrlOrNull(body.solution_url);
  if (body.solution_url && !safeUrl) {
    return sendJson(req, res, 400, { error: 'solution_url must be http/https URL.' });
  }
  record.exam_public_json.solution_url = safeUrl;
  return sendJson(req, res, 200, await refreshAndSave(record));
}

async function handleSaveDraft(req, res, examId) {
  if (!checkAuth(req)) {
    return sendJson(req, res, 401, { error: 'Unauthorized. Admin token required.' });
  }
  const record = await getExamRecord(examId);
  if (!record) return sendJson(req, res, 404, { error: 'Exam not found.' });
  record.status = 'draft_review';
  return sendJson(req, res, 200, await refreshAndSave(record));
}

async function handlePublish(req, res, examId) {
  if (!checkAuth(req)) {
    return sendJson(req, res, 401, { error: 'Unauthorized. Admin token required.' });
  }
  const record = await getExamRecord(examId);
  if (!record) return sendJson(req, res, 404, { error: 'Exam not found.' });

  record.validation_report = runValidation(record.exam_public_json, record.exam_private_json);
  const reviewPayload = buildReviewResponse(record);
  const canPublish = Boolean(reviewPayload?.exam_review_package?.meta?.can_publish);
  if (!canPublish) {
    return sendJson(req, res, 400, {
      error: 'Cannot publish because review checks are not satisfied.',
      publish_checks: reviewPayload.exam_review_package.publish_checks,
      review_flags: reviewPayload.exam_review_package.review_flags,
    });
  }

  record.status = 'published';
  record.published_at = nowIso();
  const response = await refreshAndSave(record);
  await upsertExamKeyRecord(record.id, buildAnswerKeyFromRecord(record), buildPublishedExamResources(record));
  invalidateCache();
  return sendJson(req, res, 200, response);
}

async function handleStudentExam(req, res, examId) {
  const record = await getExamRecord(examId);
  if (!record) return sendJson(req, res, 404, { error: 'Exam not found.' });
  if (record.status !== 'published') {
    return sendJson(req, res, 403, { error: 'Exam deciding review/publish; public payload unavailable.' });
  }
  return sendJson(req, res, 200, {
    exam_id: record.id,
    exam_card: buildStudentExamCard(record),
    exam_runtime_json: buildRuntimeExamFromRecord(record),
  }, 3600); // 1 hour cache for specific exam
}

async function handleStudentExamList(req, res) {
  const now = Date.now();
  if (examListCache.data && (now - examListCache.timestamp < CACHE_TTL)) {
    return sendJson(req, res, 200, examListCache.data, 600);
  }

  const records = await listPublishedExamRecords();
  const data = {
    exams: records.map((record) => buildStudentExamCard(record)),
  };
  
  examListCache = { data, timestamp: now };
  return sendJson(req, res, 200, data, 600); // 10 mins browser cache
}

async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || `127.0.0.1:${PORT}`}`);
  const pathname = url.pathname;
  const method = (req.method || 'GET').toUpperCase();

  try {
    if (method === 'GET' && pathname === '/health') {
      return sendJson(req, res, 200, { ok: true, service: 'exam-review-api' });
    }

    if (method === 'POST' && pathname === '/admin/exams/import') {
      return handleImport(req, res);
    }

    if (method === 'POST' && pathname === '/admin/exams/sync-local') {
      return handleSyncLocal(req, res);
    }

    const reviewMatch = routeMatch(pathname, /^\/admin\/exams\/([^/]+)\/review$/);
    if (method === 'GET' && reviewMatch) {
      return handleGetReview(req, res, reviewMatch[0]);
    }

    const patchKeyMatch = routeMatch(pathname, /^\/admin\/exams\/([^/]+)\/questions\/([^/]+)\/key$/);
    if (method === 'PATCH' && patchKeyMatch) {
      return handlePatchKey(req, res, patchKeyMatch[0], patchKeyMatch[1]);
    }

    const patchQuestionSolutionMatch = routeMatch(pathname, /^\/admin\/exams\/([^/]+)\/questions\/([^/]+)\/solution$/);
    if (method === 'PATCH' && patchQuestionSolutionMatch) {
      return handlePatchQuestionSolution(req, res, patchQuestionSolutionMatch[0], patchQuestionSolutionMatch[1]);
    }

    const patchQuestionMatch = routeMatch(pathname, /^\/admin\/exams\/([^/]+)\/questions\/([^/]+)$/);
    if (method === 'PATCH' && patchQuestionMatch) {
      return handlePatchQuestion(req, res, patchQuestionMatch[0], patchQuestionMatch[1]);
    }

    const patchExamSolutionMatch = routeMatch(pathname, /^\/admin\/exams\/([^/]+)\/solution$/);
    if (method === 'PATCH' && patchExamSolutionMatch) {
      return handlePatchExamSolution(req, res, patchExamSolutionMatch[0]);
    }

    const saveDraftMatch = routeMatch(pathname, /^\/admin\/exams\/([^/]+)\/save-draft$/);
    if (method === 'POST' && saveDraftMatch) {
      return handleSaveDraft(req, res, saveDraftMatch[0]);
    }

    const publishMatch = routeMatch(pathname, /^\/admin\/exams\/([^/]+)\/publish$/);
    if (method === 'POST' && publishMatch) {
      return handlePublish(req, res, publishMatch[0]);
    }

    const studentMatch = routeMatch(pathname, /^\/student\/exams\/([^/]+)$/);
    if (method === 'GET' && studentMatch) {
      return handleStudentExam(req, res, studentMatch[0]);
    }

    if (method === 'GET' && pathname === '/student/exams') {
      return handleStudentExamList(req, res);
    }

    return sendJson(req, res, 404, { error: 'Route not found.' });
  } catch (error) {
    return sendJson(req, res, 500, { error: error?.message || 'Internal server error.' });
  }
}

await ensureStoreFile();

async function isSameExamReviewApiRunning(port) {
  const candidates = [
    `http://127.0.0.1:${port}/health`,
    `http://localhost:${port}/health`,
  ];

  for (const url of candidates) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const payload = await response.json().catch(() => null);
      if (payload?.ok === true && payload?.service === 'exam-review-api') {
        return true;
      }
    } catch {
      // Ignore and try next candidate.
    }
  }
  return false;
}

const httpServer = createServer(handler);

httpServer.on('error', async (error) => {
  if (error?.code === 'EADDRINUSE') {
    const sameService = await isSameExamReviewApiRunning(PORT);
    if (sameService) {
      // eslint-disable-next-line no-console
      console.log(`[exam-review-api] already running on http://127.0.0.1:${PORT}`);
      process.exit(0);
      return;
    }

    // eslint-disable-next-line no-console
    console.error(
      `[exam-review-api] port ${PORT} is already in use. ` +
      `Run with a different port, for example: npm run server -- --port 8788`,
    );
    process.exit(1);
    return;
  }

  // eslint-disable-next-line no-console
  console.error('[exam-review-api] failed to start:', error?.message || error);
  process.exit(1);
});

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[exam-review-api] listening on http://127.0.0.1:${PORT}`);
});
