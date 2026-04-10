import { supabase } from '../lib/supabase';

const ANSWER_FILE_BUCKET = 'exam-answer-files';
const FALLBACK_ANSWER_FILE_NAME = 'Dap an';

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toTrimmedString = (value) => (
  typeof value === 'string' ? value.trim() : ''
);

const toExamIdLower = (value) => toTrimmedString(value).toLowerCase();

const toUniqueExamIds = (values = []) => {
  const unique = [];
  const seen = new Set();

  for (const raw of values) {
    const normalized = toTrimmedString(raw);
    if (!normalized) continue;
    const lower = normalized.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    unique.push(normalized);
  }

  return unique;
};

const toUniqueExactExamIds = (values = []) => {
  const unique = [];
  const seen = new Set();

  for (const raw of values) {
    const normalized = toTrimmedString(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }

  return unique;
};

export const hasPopulatedAnswerKey = (answerKey) => (
  isObject(answerKey) && Object.keys(answerKey).length > 0
);

export const normalizeExamResources = (value) => {
  const resources = isObject(value) ? value : {};
  const solutionUrl = toTrimmedString(resources.solution_url || resources.solutionUrl);
  const answerFileUrl = toTrimmedString(resources.answer_file_url || resources.answerFileUrl || solutionUrl);
  const answerFileName = toTrimmedString(resources.answer_file_name || resources.answerFileName || FALLBACK_ANSWER_FILE_NAME);
  const videoUrl = toTrimmedString(resources.video_url || resources.videoUrl);

  return {
    ...resources,
    solution_url: solutionUrl,
    video_url: videoUrl,
    answer_file_url: answerFileUrl,
    answer_file_name: answerFileName,
  };
};

const toSafeFilePart = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9._-]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');

export async function adminDeleteStorageFile(bucket, path) {
  if (!bucket || !path) return false;
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    console.error(`[StorageCleanup] Failed to delete ${path} in ${bucket}:`, error);
    return false;
  }
  return true;
}

export async function listAdminExamKeys() {
  const { data, error } = await supabase.rpc('admin_list_exam_keys');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function listPublicExamIndex() {
  const { data, error } = await supabase.rpc('public_list_exam_index');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getAdminExamKey(examId) {
  const safeExamId = toTrimmedString(examId);
  if (!safeExamId) return null;

  const { data, error } = await supabase.rpc('admin_get_exam_key', {
    p_exam_id: safeExamId,
  });
  if (error) throw error;
  return data || null;
}

export async function upsertAdminExamKeyBundle({ examId, answerKey, resources }) {
  const safeExamId = toTrimmedString(examId);
  if (!safeExamId) {
    throw new Error('Thiếu mã đề thi để lưu.');
  }

  const payloadResources = normalizeExamResources(resources);
  const payloadAnswerKey = isObject(answerKey) ? answerKey : {};

  const { data, error } = await supabase.rpc('admin_upsert_exam_key_bundle', {
    p_exam_id: safeExamId,
    p_answer_key: payloadAnswerKey,
    p_resources: payloadResources,
  });
  if (error) throw error;
  return data || null;
}

export async function deleteAdminExamKey(examId) {
  const safeExamId = toTrimmedString(examId);
  if (!safeExamId) return false;

  const { data, error } = await supabase.rpc('admin_delete_exam_key', {
    p_exam_id: safeExamId,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function adminDeleteExamBundle(examId) {
  const safeExamId = toTrimmedString(examId);
  if (!safeExamId) {
    return {
      deleted: false,
      exam_id: '',
    };
  }

  const { data, error } = await supabase.rpc('admin_delete_exam_bundle', {
    p_exam_id: safeExamId,
  });

  if (error) throw error;
  return data && typeof data === 'object'
    ? data
    : {
      deleted: Boolean(data),
      exam_id: safeExamId,
    };
}

export async function resolveAdminExamKeyIds(examIds) {
  const requested = toUniqueExamIds(Array.isArray(examIds) ? examIds : [examIds]);
  if (requested.length === 0) return [];

  const requestedLowerSet = new Set(requested.map((item) => toExamIdLower(item)));
  let rows = [];

  try {
    rows = await listAdminExamKeys();
  } catch {
    rows = [];
  }

  const matched = rows
    .map((row) => toTrimmedString(row?.exam_id))
    .filter((rowExamId) => rowExamId && requestedLowerSet.has(toExamIdLower(rowExamId)));

  // Keep both exact DB ids (if found) and requested ids as a fallback attempt.
  return toUniqueExactExamIds([...matched, ...requested]);
}

export async function deleteAdminExamKeys(examIds) {
  const requested = toUniqueExamIds(Array.isArray(examIds) ? examIds : [examIds]);
  if (requested.length === 0) {
    return {
      requested: [],
      attempted: [],
      deleted: [],
      notFound: [],
      failed: [],
    };
  }

  const attempted = await resolveAdminExamKeyIds(requested);
  const deleted = [];
  const notFound = [];
  const failed = [];
  const details = [];

  for (const examId of attempted) {
    try {
      const deletedBundle = await adminDeleteExamBundle(examId);
      const removed = Boolean(deletedBundle?.deleted);
      details.push(deletedBundle || { exam_id: examId, deleted: removed });

      if (removed) {
        deleted.push(examId);
      } else {
        notFound.push(examId);
      }
    } catch (error) {
      failed.push({
        examId,
        error: error?.message || String(error),
      });
    }
  }

  return {
    requested,
    attempted,
    deleted,
    notFound,
    failed,
    details,
  };
}

export async function uploadExamDocumentFile(examId, subjectFolder, file, oldPath = null) {
  if (!file) {
    throw new Error('Chưa chọn file đề thi để tải lên.');
  }

  const EXAM_DOCUMENT_BUCKET = 'exams';
  const folder = toSafeFilePart(subjectFolder) || toSafeFilePart(examId) || 'unknown';
  const ext = file.name.split('.').pop() || 'pdf';
  const storagePath = `${folder}/${toSafeFilePart(examId)}.${ext}`;

  if (oldPath && oldPath !== storagePath) {
    await adminDeleteStorageFile(EXAM_DOCUMENT_BUCKET, oldPath).catch(() => {});
  }

  const { error: uploadError } = await supabase
    .storage
    .from(EXAM_DOCUMENT_BUCKET)
    .upload(storagePath, file, {
      upsert: true,
      contentType: file.type || undefined,
      cacheControl: '3600',
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(EXAM_DOCUMENT_BUCKET).getPublicUrl(storagePath);
  return {
    bucket: EXAM_DOCUMENT_BUCKET,
    path: storagePath,
    publicUrl: data?.publicUrl || '',
    fileName: file.name || 'exam-document.pdf',
  };
}

export async function uploadExamAnswerFile(examId, file, oldPath = null) {
  if (!file) {
    throw new Error('Chưa chọn file đáp án để tải lên.');
  }

  const ext = file.name.split('.').pop() || 'pdf';
  const examFolder = toSafeFilePart(examId) || 'unknown-exam';
  const storagePath = `${examFolder}/${examFolder}-answer.${ext}`;

  if (oldPath && oldPath !== storagePath) {
    await adminDeleteStorageFile(ANSWER_FILE_BUCKET, oldPath).catch(() => {});
  }

  const { error: uploadError } = await supabase
    .storage
    .from(ANSWER_FILE_BUCKET)
    .upload(storagePath, file, {
      upsert: true,
      contentType: file.type || undefined,
      cacheControl: '3600',
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(ANSWER_FILE_BUCKET).getPublicUrl(storagePath);
  return {
    bucket: ANSWER_FILE_BUCKET,
    path: storagePath,
    publicUrl: data?.publicUrl || '',
    fileName: file.name || FALLBACK_ANSWER_FILE_NAME,
  };
}
