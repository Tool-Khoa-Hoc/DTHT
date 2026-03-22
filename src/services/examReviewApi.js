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

const API_BASE = (import.meta.env.VITE_EXAM_REVIEW_API_BASE || resolveDefaultApiBase()).replace(/\/$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
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
