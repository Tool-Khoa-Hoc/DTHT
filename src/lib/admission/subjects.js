// Danh mục môn học chuẩn — NGUỒN SỰ THẬT DUY NHẤT về môn thi THPT.
// Mọi trang (nhập điểm, tìm trường) import từ đây; cấm tự khai SUBJECTS/alias
// ở trang (trước đây trùng lặp ở AdmissionCalculator + SchoolFinder + GPA).
// Khoá chuẩn dùng không dấu, giữ tương thích schema v2 ('toan', 'ly', ...).

export const SUBJECTS = [
  { key: 'toan', label: 'Toán', group: 'bat-buoc' },
  { key: 'van', label: 'Ngữ văn', group: 'bat-buoc' },
  { key: 'anh', label: 'Tiếng Anh', group: 'ngoai-ngu' },
  { key: 'ly', label: 'Vật lí', group: 'tu-nhien' },
  { key: 'hoa', label: 'Hoá học', group: 'tu-nhien' },
  { key: 'sinh', label: 'Sinh học', group: 'tu-nhien' },
  { key: 'su', label: 'Lịch sử', group: 'xa-hoi' },
  { key: 'dia', label: 'Địa lí', group: 'xa-hoi' },
  { key: 'gdkp', label: 'Giáo dục kinh tế và pháp luật', group: 'xa-hoi' },
  { key: 'tin', label: 'Tin học', group: 'tu-nhien' },
  { key: 'congnghe', label: 'Công nghệ', group: 'tu-nhien' },
  { key: 'phap', label: 'Tiếng Pháp', group: 'ngoai-ngu' },
  { key: 'trung', label: 'Tiếng Trung', group: 'ngoai-ngu' },
  { key: 'duc', label: 'Tiếng Đức', group: 'ngoai-ngu' },
  { key: 'nhat', label: 'Tiếng Nhật', group: 'ngoai-ngu' },
  { key: 'han', label: 'Tiếng Hàn', group: 'ngoai-ngu' },
  { key: 'nga', label: 'Tiếng Nga', group: 'ngoai-ngu' },
];

export const SUBJECT_KEYS = SUBJECTS.map((s) => s.key);
export const SUBJECT_LABEL = Object.fromEntries(SUBJECTS.map((s) => [s.key, s.label]));

// Bỏ dấu + thường hoá để map tên môn tự do (dữ liệu v1 lưu tên tiếng Việt,
// lẫn lộn "Vật lý"/"Vật lí") về khoá chuẩn — chuẩn hoá MỘT lần tại đây.
export function normalizeText(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

const ALIASES = {
  toan: 'toan', 'ngu van': 'van', van: 'van',
  'vat li': 'ly', 'vat ly': 'ly', ly: 'ly', 'vatli': 'ly',
  'hoa hoc': 'hoa', hoa: 'hoa',
  'sinh hoc': 'sinh', sinh: 'sinh',
  'lich su': 'su', su: 'su',
  'dia li': 'dia', 'dia ly': 'dia', dia: 'dia',
  'tieng anh': 'anh', anh: 'anh', 'ngoai ngu': 'anh',
  'giao duc kinh te va phap luat': 'gdkp', gdkp: 'gdkp', gdcd: 'gdkp',
  'giao duc cong dan': 'gdkp',
  'tin hoc': 'tin', tin: 'tin',
  'cong nghe': 'congnghe', congnghe: 'congnghe',
  'tieng phap': 'phap', phap: 'phap',
  'tieng trung': 'trung', trung: 'trung',
  'tieng duc': 'duc', duc: 'duc',
  'tieng nhat': 'nhat', nhat: 'nhat',
  'tieng han': 'han', han: 'han',
  'tieng nga': 'nga', nga: 'nga',
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
