import { supabase } from '../lib/supabase';

let examIndexCache = null;
let examIndexRequest = null;
let examIndexForceRequest = null;

const EXAM_INDEX_URL = '/data/exams/index.json';
const SESSION_KEY = 'exam_index_cache_v5';
const SESSION_TTL_MS = 5 * 60 * 1000;

const SUBJECT_STYLE_MAP = {
  toan: { icon: 'calculate', color: 'from-blue-500 to-indigo-600' },
  ly: { icon: 'experiment', color: 'from-amber-500 to-orange-600' },
  hoa: { icon: 'science', color: 'from-green-500 to-emerald-600' },
  sinh: { icon: 'biotech', color: 'from-teal-500 to-cyan-600' },
  van: { icon: 'menu_book', color: 'from-rose-500 to-pink-600' },
  anh: { icon: 'language', color: 'from-sky-500 to-blue-600' },
  su: { icon: 'history_edu', color: 'from-yellow-600 to-amber-700' },
  dia: { icon: 'public', color: 'from-lime-500 to-green-600' },
  gdcd: { icon: 'gavel', color: 'from-purple-500 to-violet-600' },
  tin: { icon: 'computer', color: 'from-cyan-500 to-sky-600' },
};

function toTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toSubjectFolder(value) {
  return toTrimmedString(value).toLowerCase();
}

function toOptionalPositiveInt(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

function toOptionalTimestampMs(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 1e12) return value;
    if (value > 1e9) return value * 1000;
    return null;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function getDefaultStyle(subjectFolder) {
  const style = SUBJECT_STYLE_MAP[subjectFolder] || SUBJECT_STYLE_MAP.sinh;
  return {
    icon: style?.icon || 'quiz',
    color: style?.color || 'from-slate-500 to-slate-700',
  };
}

function normalizeExamRecord(input, source = 'local') {
  if (!input || typeof input !== 'object') return null;

  const subjectFolder = toSubjectFolder(input.subjectFolder || input.subject);
  const rawId = toTrimmedString(input.id || input.exam_id || input.examId || input.examPath || input.exam_path);
  const examPath = toTrimmedString(input.examPath || input.exam_path || rawId);
  const title = toTrimmedString(input.title || input.exam_title || input.examTitle || rawId);
  if (!subjectFolder || !rawId || !examPath || !title) return null;

  const style = getDefaultStyle(subjectFolder);
  const record = {
    id: rawId,
    title,
    subject: subjectFolder,
    subjectFolder,
    examPath,
    questions: toOptionalPositiveInt(input.questions || input.question_count || input.questionCount),
    time: toOptionalPositiveInt(input.time || input.duration_minutes || input.durationMinutes),
    status: toTrimmedString(input.status || 'ongoing') || 'ongoing',
    icon: toTrimmedString(input.icon) || style.icon,
    color: toTrimmedString(input.color) || style.color,
    updated_at: input.updated_at || input.updatedAt || input.last_synced_at || input.lastSyncedAt || null,
    _updatedAtMs: toOptionalTimestampMs(
      input.updated_at || input.updatedAt || input.last_synced_at || input.lastSyncedAt,
    ),
    _source: source,
  };

  return record;
}

function getRecordKey(record) {
  if (!record) return '';
  return `${record.subjectFolder || ''}:${record.examPath || record.id || ''}`.toLowerCase();
}

function mergeExamIndexes(localRows, dbRows) {
  const map = new Map();

  const push = (item, source) => {
    const normalized = normalizeExamRecord(item, source);
    if (!normalized) return;

    const key = getRecordKey(normalized);
    if (!key) return;

    const current = map.get(key);
    if (!current) {
      map.set(key, normalized);
      return;
    }

    const preferDbId = normalized._source === 'db';

    const merged = {
      ...current,
      ...normalized,
      id: preferDbId
        ? (normalized.id || current.id)
        : (current.id || normalized.id),
      title: normalized.title || current.title,
      subject: normalized.subject || current.subject,
      subjectFolder: normalized.subjectFolder || current.subjectFolder,
      examPath: normalized.examPath || current.examPath,
      questions: normalized.questions ?? current.questions ?? null,
      time: normalized.time ?? current.time ?? null,
      status: normalized.status || current.status || 'ongoing',
      icon: normalized.icon || current.icon,
      color: normalized.color || current.color,
    };

    const currentUpdated = current._updatedAtMs || 0;
    const nextUpdated = normalized._updatedAtMs || 0;
    merged._updatedAtMs = Math.max(currentUpdated, nextUpdated);
    merged.updated_at = merged._updatedAtMs ? (merged._updatedAtMs / 1000) : (normalized.updated_at || current.updated_at || null);

    map.set(key, merged);
  };

  for (const row of Array.isArray(localRows) ? localRows : []) {
    push(row, 'local');
  }

  for (const row of Array.isArray(dbRows) ? dbRows : []) {
    push(row, 'db');
  }

  return Array.from(map.values())
    .map((item) => {
      const { _updatedAtMs, _source, ...rest } = item;
      return rest;
    })
    .sort((a, b) => {
      const aTime = toOptionalTimestampMs(a.updated_at) || 0;
      const bTime = toOptionalTimestampMs(b.updated_at) || 0;
      if (bTime !== aTime) return bTime - aTime;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
}

function hasSessionStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function readSessionCache() {
  if (!hasSessionStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray(parsed.data) &&
      Number.isFinite(parsed.cachedAt)
    ) {
      if ((Date.now() - parsed.cachedAt) <= SESSION_TTL_MS) {
        return parsed.data;
      }
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

function writeSessionCache(value) {
  if (!hasSessionStorage()) return;
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      data: value,
      cachedAt: Date.now(),
    }));
  } catch {
    // Ignore storage quota / serialization failures.
  }
}

async function loadLocalExamIndex({ forceRefresh = false } = {}) {
  const requestUrl = forceRefresh
    ? `${EXAM_INDEX_URL}?ts=${Date.now()}`
    : EXAM_INDEX_URL;

  try {
    const response = await fetch(requestUrl, { cache: 'no-store' });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function loadDbExamIndex() {
  try {
    const { data, error } = await supabase.rpc('public_list_exam_index');
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function getExamIndex({ forceRefresh = false } = {}) {
  if (!forceRefresh && Array.isArray(examIndexCache)) {
    return examIndexCache;
  }

  if (!forceRefresh) {
    const cached = readSessionCache();
    if (cached) {
      examIndexCache = cached;
      return cached;
    }
  }

  if (forceRefresh) {
    if (examIndexForceRequest) return examIndexForceRequest;
  } else if (examIndexRequest) {
    return examIndexRequest;
  }

  const requestPromise = Promise
    .all([
      loadLocalExamIndex({ forceRefresh }),
      loadDbExamIndex(),
    ])
    .then(([localRows, dbRows]) => {
      const merged = mergeExamIndexes(localRows, dbRows);
      examIndexCache = merged;
      writeSessionCache(merged);
      return merged;
    })
    .finally(() => {
      if (forceRefresh) {
        examIndexForceRequest = null;
      } else {
        examIndexRequest = null;
      }
    });

  if (forceRefresh) {
    examIndexForceRequest = requestPromise;
  } else {
    examIndexRequest = requestPromise;
  }

  return requestPromise;
}

export function clearExamIndexCache() {
  examIndexCache = null;
  examIndexRequest = null;
  examIndexForceRequest = null;
  if (!hasSessionStorage()) return;
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore storage failures.
  }
}
