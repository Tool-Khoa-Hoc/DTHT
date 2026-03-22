import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { buildExamReviewPackage } from './reviewPackage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'exams.json');

dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });
dotenv.config({ path: path.join(PROJECT_ROOT, '.env.local'), override: true });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

const supabaseAdmin = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: { schema: 'public' },
      global: {
        headers: { 'x-application-name': 'tram-hs-sv-server' },
      },
    })
  : null;

function createEmptyStore() {
  return { exams: {} };
}

function normalizeAssetBundle(input) {
  if (!input || typeof input !== 'object') {
    return { images: {}, math: {} };
  }
  return {
    images: input.images && typeof input.images === 'object' && !Array.isArray(input.images) ? input.images : {},
    math: input.math && typeof input.math === 'object' && !Array.isArray(input.math) ? input.math : {},
  };
}

function buildReviewState(record) {
  const review = buildExamReviewPackage({
    examPublicJson: record.exam_public_json || {},
    examPrivateJson: record.exam_private_json || {},
    validationReport: record.validation_report || {},
  });
  const pkg = review.exam_review_package || {};
  return {
    exam_review_package: pkg,
    validation_report: record.validation_report || {},
    warning_count: Number(pkg?.summary?.warning_count || 0),
    error_count: Number(pkg?.summary?.error_count || 0),
    has_blocking_errors: Boolean(pkg?.review_flags?.has_blocking_errors),
    needs_manual_review: Boolean(pkg?.review_flags?.needs_manual_review),
    needs_answer_key_setup: Boolean(pkg?.review_flags?.needs_answer_key_setup),
    can_publish: Boolean(pkg?.meta?.can_publish),
  };
}

function mapSupabaseRowsToRecord(examRow, publicRow, privateRow, reviewRow) {
  if (!examRow) return null;
  return {
    id: examRow.id,
    status: examRow.status || 'draft_review',
    created_by: examRow.created_by || null,
    created_at: examRow.created_at || null,
    updated_at: examRow.updated_at || null,
    published_at: examRow.published_at || null,
    import_meta: examRow.import_meta || null,
    exam_public_json: publicRow?.exam_public_json || {},
    exam_private_json: privateRow?.exam_private_json || {},
    full_raw_markup:
      privateRow?.full_raw_markup ||
      privateRow?.exam_private_json?.import_data?.raw_markup ||
      '',
    validation_report: reviewRow?.validation_report || {},
    exam_review_package: reviewRow?.exam_review_package || null,
  };
}

async function ensureSupabaseConfigured() {
  if (!supabaseAdmin) {
    throw new Error(
      'Supabase is not configured for the exam review API. Set SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }
  return supabaseAdmin;
}

async function getExamRecordFromSupabase(examId) {
  const db = await ensureSupabaseConfigured();

  const [{ data: examRow, error: examError }, { data: publicRow, error: publicError }, { data: privateRow, error: privateError }, { data: reviewRow, error: reviewError }] = await Promise.all([
    db.from('exams').select('*').eq('id', examId).maybeSingle(),
    db.from('exam_public_data').select('*').eq('exam_id', examId).maybeSingle(),
    db.from('exam_private_data').select('*').eq('exam_id', examId).maybeSingle(),
    db.from('exam_review_state').select('*').eq('exam_id', examId).maybeSingle(),
  ]);

  if (examError) throw examError;
  if (publicError) throw publicError;
  if (privateError) throw privateError;
  if (reviewError) throw reviewError;
  return mapSupabaseRowsToRecord(examRow, publicRow, privateRow, reviewRow);
}

async function upsertExamRecordToSupabase(record) {
  const db = await ensureSupabaseConfigured();
  const reviewState = buildReviewState(record);
  const assets = normalizeAssetBundle(
    record.exam_private_json?.import_data?.assets || record.exam_public_json?.assets,
  );

  const examPayload = {
    id: record.id,
    title: record.exam_public_json?.title ?? null,
    subject: record.exam_public_json?.meta?.subject ?? null,
    duration_minutes: record.exam_public_json?.meta?.duration_minutes ?? null,
    status: record.status || 'draft_review',
    solution_url: record.exam_public_json?.solution_url || null,
    created_by: record.created_by || null,
    created_at: record.created_at || undefined,
    updated_at: record.updated_at || new Date().toISOString(),
    published_at: record.published_at || null,
    import_meta: record.import_meta || {},
  };

  const publicPayload = {
    exam_id: record.id,
    exam_public_json: {
      ...(record.exam_public_json || {}),
      assets,
    },
    updated_at: record.updated_at || new Date().toISOString(),
  };

  const privatePayload = {
    exam_id: record.id,
    exam_private_json: {
      ...(record.exam_private_json || {}),
      import_data: {
        ...(record.exam_private_json?.import_data || {}),
        raw_markup:
          record.exam_private_json?.import_data?.raw_markup ||
          record.full_raw_markup ||
          '',
        raw_text:
          record.exam_private_json?.import_data?.raw_text ||
          '',
        assets,
      },
    },
    full_raw_markup:
      record.full_raw_markup ||
      record.exam_private_json?.import_data?.raw_markup ||
      '',
    updated_at: record.updated_at || new Date().toISOString(),
  };

  const reviewPayload = {
    exam_id: record.id,
    validation_report: reviewState.validation_report,
    exam_review_package: reviewState.exam_review_package,
    warning_count: reviewState.warning_count,
    error_count: reviewState.error_count,
    has_blocking_errors: reviewState.has_blocking_errors,
    needs_manual_review: reviewState.needs_manual_review,
    needs_answer_key_setup: reviewState.needs_answer_key_setup,
    can_publish: reviewState.can_publish,
    updated_at: record.updated_at || new Date().toISOString(),
    last_validated_at: new Date().toISOString(),
  };

  const [{ error: examError }, { error: publicError }, { error: privateError }, { error: reviewError }] = await Promise.all([
    db.from('exams').upsert(examPayload, { onConflict: 'id' }),
    db.from('exam_public_data').upsert(publicPayload, { onConflict: 'exam_id' }),
    db.from('exam_private_data').upsert(privatePayload, { onConflict: 'exam_id' }),
    db.from('exam_review_state').upsert(reviewPayload, { onConflict: 'exam_id' }),
  ]);

  if (examError) throw examError;
  if (publicError) throw publicError;
  if (privateError) throw privateError;
  if (reviewError) throw reviewError;

  return getExamRecordFromSupabase(record.id);
}

async function listPublishedExamRecordsFromSupabase() {
  const db = await ensureSupabaseConfigured();
  const { data: examRows, error: examsError } = await db
    .from('exams')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false });
  if (examsError) throw examsError;

  const ids = (examRows || []).map((row) => row.id).filter(Boolean);
  if (ids.length === 0) return [];

  const [{ data: publicRows, error: publicError }, { data: privateRows, error: privateError }, { data: reviewRows, error: reviewError }] = await Promise.all([
    db.from('exam_public_data').select('*').in('exam_id', ids),
    db.from('exam_private_data').select('*').in('exam_id', ids),
    db.from('exam_review_state').select('*').in('exam_id', ids),
  ]);

  if (publicError) throw publicError;
  if (privateError) throw privateError;
  if (reviewError) throw reviewError;

  const publicMap = new Map((publicRows || []).map((row) => [row.exam_id, row]));
  const privateMap = new Map((privateRows || []).map((row) => [row.exam_id, row]));
  const reviewMap = new Map((reviewRows || []).map((row) => [row.exam_id, row]));

  return examRows.map((examRow) => mapSupabaseRowsToRecord(
    examRow,
    publicMap.get(examRow.id),
    privateMap.get(examRow.id),
    reviewMap.get(examRow.id),
  ));
}

export async function ensureStoreFile() {
  if (supabaseAdmin) return;
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await readFile(STORE_FILE, 'utf8');
  } catch {
    await writeFile(STORE_FILE, JSON.stringify(createEmptyStore(), null, 2), 'utf8');
  }
}

export async function readStore() {
  await ensureStoreFile();
  const raw = await readFile(STORE_FILE, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return createEmptyStore();
    if (!parsed.exams || typeof parsed.exams !== 'object') parsed.exams = {};
    return parsed;
  } catch {
    return createEmptyStore();
  }
}

export async function writeStore(store) {
  await ensureStoreFile();
  await writeFile(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
}

export async function getExamRecord(examId) {
  if (supabaseAdmin) {
    return getExamRecordFromSupabase(examId);
  }
  const store = await readStore();
  return store.exams?.[examId] || null;
}

export async function upsertExamRecord(record) {
  if (supabaseAdmin) {
    return upsertExamRecordToSupabase(record);
  }
  const store = await readStore();
  store.exams[record.id] = record;
  await writeStore(store);
  return record;
}

export async function listPublishedExamRecords() {
  if (supabaseAdmin) {
    return listPublishedExamRecordsFromSupabase();
  }
  const store = await readStore();
  return Object.values(store.exams || {}).filter((record) => record?.status === 'published');
}

export function isSupabaseBackedStoreEnabled() {
  return Boolean(supabaseAdmin);
}

export async function upsertExamKeyRecord(examId, answerKey, resources = {}) {
  if (!examId) return null;

  if (supabaseAdmin) {
    const db = await ensureSupabaseConfigured();
    const payload = {
      exam_id: examId,
      answer_key: (answerKey && typeof answerKey === 'object') ? answerKey : {},
      resources: (resources && typeof resources === 'object') ? resources : {},
    };
    const { error } = await db.from('exam_keys').upsert(payload, { onConflict: 'exam_id' });
    if (error) throw error;
    return payload;
  }

  const store = await readStore();
  if (!store.exam_keys || typeof store.exam_keys !== 'object') {
    store.exam_keys = {};
  }
  store.exam_keys[examId] = {
    answer_key: (answerKey && typeof answerKey === 'object') ? answerKey : {},
    resources: (resources && typeof resources === 'object') ? resources : {},
  };
  await writeStore(store);
  return store.exam_keys[examId];
}
