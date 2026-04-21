const resolveDefaultApiBase = () => {
  if (typeof window === 'undefined') return 'http://127.0.0.1:8787';
  const { protocol, hostname, port } = window.location;
  if (hostname === '127.0.0.1' || hostname === 'localhost') {
    return `${protocol}//${hostname}:8787`;
  }
  if (port) {
    return `${protocol}//${hostname}:8787`;
  }
  return `${protocol}//${hostname}`;
};

const resolveConfiguredApiBase = () => {
  const env = import.meta.env || {};
  return env.VITE_EXAM_REVIEW_API_BASE || env.VITE_API_URL || env.VITE_API_UR || resolveDefaultApiBase();
};

const API_BASE = resolveConfiguredApiBase().replace(/\/$/, '');
const ADMIN_TOKEN_STORAGE_KEY = 'exam_review_admin_token';

function readAdminToken() {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

async function request(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
  };
  if (path.startsWith('/admin/')) {
    const adminToken = readAdminToken();
    if (!adminToken) {
      throw new Error(`Missing admin token. Set localStorage["${ADMIN_TOKEN_STORAGE_KEY}"] before using exam review admin APIs.`);
    }
    headers.Authorization = `Bearer ${adminToken}`;
  }
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error || `Request failed: ${response.status}`);
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function importExamDocx(file) {
  const formData = new FormData();
  formData.append('file', file);
  return request('/admin/exams/import', {
    method: 'POST',
    body: formData,
  });
}

export async function syncLocalDraft(payload) {
  return request('/admin/exams/sync-local', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getExamReview(examId) {
  return request(`/admin/exams/${encodeURIComponent(examId)}/review`);
}

export async function patchQuestion(examId, questionId, body) {
  return request(`/admin/exams/${encodeURIComponent(examId)}/questions/${encodeURIComponent(questionId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function patchQuestionKey(examId, questionId, body) {
  return request(`/admin/exams/${encodeURIComponent(examId)}/questions/${encodeURIComponent(questionId)}/key`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function patchQuestionSolution(examId, questionId, solutionUrl) {
  return request(`/admin/exams/${encodeURIComponent(examId)}/questions/${encodeURIComponent(questionId)}/solution`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ solution_url: solutionUrl }),
  });
}

export async function patchExamSolution(examId, solutionUrl) {
  return request(`/admin/exams/${encodeURIComponent(examId)}/solution`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ solution_url: solutionUrl }),
  });
}

export async function saveDraft(examId) {
  return request(`/admin/exams/${encodeURIComponent(examId)}/save-draft`, {
    method: 'POST',
  });
}

export async function publishExam(examId) {
  return request(`/admin/exams/${encodeURIComponent(examId)}/publish`, {
    method: 'POST',
  });
}

export async function getStudentExam(examId) {
  return request(`/student/exams/${encodeURIComponent(examId)}`);
}

export async function listStudentExams() {
  const payload = await request('/student/exams');
  return Array.isArray(payload?.exams) ? payload.exams : [];
}
