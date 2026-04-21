const SUBJECT_TIME_DEFAULTS = {
  toan: 90,
  math: 90,
  ly: 50,
  physics: 50,
  hoa: 50,
  chemistry: 50,
  sinh: 50,
  biology: 50,
};

function stripAccents(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normalizeExamSubject(value) {
  const normalized = stripAccents(value).trim().toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('toan') || normalized === 'math') return 'toan';
  if (normalized.includes('vat ly') || normalized === 'ly' || normalized === 'physics') return 'ly';
  if (normalized.includes('hoa') || normalized === 'chemistry') return 'hoa';
  if (normalized.includes('sinh') || normalized === 'biology') return 'sinh';
  return normalized;
}

function toOptionalPositiveInt(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

export function getCanonicalExamTimeMinutes(subject) {
  const normalized = normalizeExamSubject(subject);
  if (!normalized) return null;
  return SUBJECT_TIME_DEFAULTS[normalized] ?? null;
}

export function normalizeExamTimeMinutes(subject, value, fallback = null) {
  const canonical = getCanonicalExamTimeMinutes(subject);
  if (canonical !== null) {
    return canonical;
  }

  const directValue = toOptionalPositiveInt(value);
  if (directValue !== null) {
    return directValue;
  }

  return toOptionalPositiveInt(fallback);
}

export function normalizeExamPayloadTime(examData, subjectHint = '') {
  if (!examData || typeof examData !== 'object') {
    return examData;
  }

  const normalizedTime = normalizeExamTimeMinutes(
    subjectHint || examData.subjectFolder || examData.subject,
    examData.time,
    examData.duration_minutes ?? examData.durationMinutes ?? null,
  );

  if (normalizedTime === null) {
    return examData;
  }

  return {
    ...examData,
    time: normalizedTime,
  };
}
