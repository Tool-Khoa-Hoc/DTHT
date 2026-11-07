// Danh mục môn học chuẩn — NGUỒN SỰ THẬT DUY NHẤT về môn thi THPT.
// Mọi trang (nhập điểm, tìm trường) import từ đây; cấm tự khai SUBJECTS/alias
// ở trang (trước đây trùng lặp ở AdmissionCalculator + SchoolFinder + GPA).
// Khoá chuẩn dùng không dấu, giữ tương thích schema v2 ('toan', 'ly', ...).

export const SUBJECTS = [
  { key: 'toan', label: 'Toán', labelEn: 'Mathematics', group: 'bat-buoc' },
  { key: 'van', label: 'Ngữ văn', labelEn: 'Literature', group: 'bat-buoc' },
  { key: 'anh', label: 'Tiếng Anh', labelEn: 'English', group: 'ngoai-ngu' },
  { key: 'ly', label: 'Vật lí', labelEn: 'Physics', group: 'tu-nhien' },
  { key: 'hoa', label: 'Hoá học', labelEn: 'Chemistry', group: 'tu-nhien' },
  { key: 'sinh', label: 'Sinh học', labelEn: 'Biology', group: 'tu-nhien' },
  { key: 'su', label: 'Lịch sử', labelEn: 'History', group: 'xa-hoi' },
  { key: 'dia', label: 'Địa lí', labelEn: 'Geography', group: 'xa-hoi' },
  { key: 'gdkp', label: 'Giáo dục kinh tế và pháp luật', labelEn: 'Economics & Law', group: 'xa-hoi' },
  { key: 'tin', label: 'Tin học', labelEn: 'Informatics', group: 'tu-nhien' },
  { key: 'congnghe', label: 'Công nghệ', labelEn: 'Technology', group: 'tu-nhien' },
  { key: 'phap', label: 'Tiếng Pháp', labelEn: 'French', group: 'ngoai-ngu' },
  { key: 'trung', label: 'Tiếng Trung', labelEn: 'Chinese', group: 'ngoai-ngu' },
  { key: 'duc', label: 'Tiếng Đức', labelEn: 'German', group: 'ngoai-ngu' },
  { key: 'nhat', label: 'Tiếng Nhật', labelEn: 'Japanese', group: 'ngoai-ngu' },
  { key: 'han', label: 'Tiếng Hàn', labelEn: 'Korean', group: 'ngoai-ngu' },
  { key: 'nga', label: 'Tiếng Nga', labelEn: 'Russian', group: 'ngoai-ngu' },
];

export const SUBJECT_KEYS = SUBJECTS.map((s) => s.key);
export const SUBJECT_LABEL = Object.fromEntries(SUBJECTS.map((s) => [s.key, s.label]));
export const SUBJECT_LABEL_EN = Object.fromEntries(SUBJECTS.map((s) => [s.key, s.labelEn]));

export function getSubjectLabel(key, lang = 'vi') {
  if (lang === 'en') {
    return SUBJECT_LABEL_EN[key] || SUBJECT_LABEL[key] || key;
  }
  return SUBJECT_LABEL[key] || key;
}

// Bỏ dấu + thường hoá để map tên môn tự do (dữ liệu v1 lưu tên tiếng Việt,
// lẫn lộn "Vật lý"/"Vật lí") về khoá chuẩn — chuẩn hoá MỘT lần tại đây.
export function normalizeText(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

const ALIASES = {
  toan: 'toan', math: 'toan', mathematics: 'toan',
  'ngu van': 'van', van: 'van', literature: 'van',
  'vat li': 'ly', 'vat ly': 'ly', ly: 'ly', vatli: 'ly', physics: 'ly',
  'hoa hoc': 'hoa', hoa: 'hoa', chemistry: 'hoa',
  'sinh hoc': 'sinh', sinh: 'sinh', biology: 'sinh',
  'lich su': 'su', su: 'su', history: 'su',
  'dia li': 'dia', 'dia ly': 'dia', dia: 'dia', geography: 'dia',
  'tieng anh': 'anh', anh: 'anh', 'ngoai ngu': 'anh', english: 'anh',
  'giao duc kinh te va phap luat': 'gdkp', gdkp: 'gdkp', gdcd: 'gdkp',
  'giao duc cong dan': 'gdkp', 'economics & law': 'gdkp',
  'tin hoc': 'tin', tin: 'tin', informatics: 'tin',
  'cong nghe': 'congnghe', congnghe: 'congnghe', technology: 'congnghe',
  'tieng phap': 'phap', phap: 'phap', french: 'phap',
  'tieng trung': 'trung', trung: 'trung', chinese: 'trung',
  'tieng duc': 'duc', duc: 'duc', german: 'duc',
  'tieng nhat': 'nhat', nhat: 'nhat', japanese: 'nhat',
  'tieng han': 'han', han: 'han', korean: 'han',
  'tieng nga': 'nga', nga: 'nga', russian: 'nga',
};

export function canonicalSubjectKey(rawKey) {
  if (!rawKey) return null;
  const norm = normalizeText(rawKey);
  return ALIASES[norm] || (SUBJECT_KEYS.includes(rawKey) ? rawKey : null);
}

// Chuẩn hoá object điểm theo môn { tên_tự_do: điểm } -> { khoá_chuẩn: điểm }.
export function canonicalSubjects(subjects) {
  const out = {};
  for (const [k, v] of Object.entries(subjects || {})) {
    const key = canonicalSubjectKey(k) || k;
    const n = parseFloat(v);
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
}
