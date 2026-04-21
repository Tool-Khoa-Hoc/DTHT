export const DOCUMENT_FIELDS = 'id, title, description, file_url, category, education_level, uploaded_by, author_name, created_at, uploaded_at, is_featured, publish_date, major';

export const ADMIN_DOCUMENT_FIELDS = `${DOCUMENT_FIELDS}, document_reports(id, reason, created_at, document_id, reported_by, documents(id, title, author_name))`;

export const LIBRARY_THPT_CATEGORIES = [
  { label: 'Tất cả', value: '' },
  { label: 'Toán', value: 'toan' },
  { label: 'Vật Lý', value: 'ly' },
  { label: 'Hóa Học', value: 'hoa' },
  { label: 'Sinh Học', value: 'sinh' },
  { label: 'Ngữ Văn', value: 'van' },
  { label: 'Tiếng Anh', value: 'anh' },
  { label: 'Lịch Sử', value: 'su' },
  { label: 'Địa Lý', value: 'dia' },
  { label: 'Tin Học', value: 'tin' },
  { label: 'GD KT&PL', value: 'gdktpl' },
];

export function normalizeSearchText(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function getDocumentUploadDate(document) {
  return document?.uploaded_at || document?.created_at || null;
}

export function formatViDate(value, options) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(
    'vi-VN',
    options ?? {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    },
  ).format(date);
}

export function formatViDateTime(value) {
  return formatViDate(value, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getDocumentKindMeta(fileUrl) {
  const lowerUrl = (fileUrl || '').toLowerCase();

  if (!lowerUrl) {
    return {
      icon: 'draft',
      label: 'Chưa gắn link',
      accent: 'text-slate-400',
      chipClass: 'bg-slate-500/10 text-slate-300 border border-slate-500/20',
    };
  }

  if (
    lowerUrl.includes('youtube.com')
    || lowerUrl.includes('youtu.be')
    || lowerUrl.includes('vimeo.com')
  ) {
    return {
      icon: 'play_circle',
      label: 'Video',
      accent: 'text-rose-300',
      chipClass: 'bg-rose-500/10 text-rose-200 border border-rose-500/20',
    };
  }

  if (
    lowerUrl.includes('.doc')
    || lowerUrl.includes('.docx')
    || lowerUrl.includes('docs.google.com')
  ) {
    return {
      icon: 'article',
      label: 'Docs',
      accent: 'text-sky-300',
      chipClass: 'bg-sky-500/10 text-sky-200 border border-sky-500/20',
    };
  }

  if (lowerUrl.includes('.pdf') || lowerUrl.includes('drive.google.com')) {
    return {
      icon: 'picture_as_pdf',
      label: 'PDF / Drive',
      accent: 'text-amber-300',
      chipClass: 'bg-amber-500/10 text-amber-200 border border-amber-500/20',
    };
  }

  return {
    icon: 'link',
    label: 'Liên kết',
    accent: 'text-emerald-300',
    chipClass: 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/20',
  };
}

export function getEducationLevelLabel(level) {
  return level === 'university' ? 'Đại học' : 'THPT';
}
