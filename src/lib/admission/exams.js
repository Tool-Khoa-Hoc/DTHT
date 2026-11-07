// Exam registry — NGUỒN SỰ THẬT DUY NHẤT về kỳ thi/phương thức xét tuyển.
// Mọi trang (nhập điểm, tìm trường, tính điểm) PHẢI import từ đây.
// Cấm hardcode nhãn/thang điểm tại page (đó là root cause lỗi đảo HSA/V-ACT cũ).
//
// Chốt chuẩn (đối chiếu DATA-RESEARCH.md + AUDIT.md §1.1):
//   HSA  = ĐHQG Hà Nội  = thang 150
//   V-ACT = ĐHQG TP.HCM = thang 1200
//   TSA  = ĐH Bách khoa Hà Nội = thang 100
//   BCA  = Bộ Công An = thang 100 (bài thi), xét tuyển P3 = THPT*2/5 + BCA*3/5 + ĐC

export const EXAMS = {
  thpt: {
    code: 'thpt',
    label: 'THPT',
    labelEn: 'National Exam',
    full: 'Điểm thi tốt nghiệp THPT',
    fullEn: 'National High School Graduation Exam',
    org: 'Bộ GD&ĐT',
    orgEn: 'MOET Vietnam',
    scale: 30,
    unit: 'điểm tổ hợp 3 môn',
    unitEn: '3-subject combo pts',
    sigmaFloor: 0.75, // trên thang quy đổi 30 — xem predict.js
  },
  hocba: {
    code: 'hocba',
    label: 'Học bạ',
    labelEn: 'Transcript',
    full: 'Xét học bạ THPT',
    fullEn: 'High School Academic Transcript',
    org: 'Theo từng trường',
    orgEn: 'By University',
    scale: 30,
    unit: 'điểm tổ hợp 3 môn',
    unitEn: '3-subject combo pts',
    sigmaFloor: 1.0,
    // Bộ GD không có khung quy đổi chung học bạ -> THPT: cấm quy đổi chéo.
    // Chỉ ước tính được khi có điểm chuẩn học bạ riêng của ngành đó.
    noCrossConvert: true,
  },
  hsa: {
    code: 'hsa',
    label: 'HSA',
    labelEn: 'HSA',
    full: 'Đánh giá năng lực — ĐHQG Hà Nội',
    fullEn: 'Competency Assessment — VNU Hanoi',
    org: 'ĐHQG Hà Nội',
    orgEn: 'VNU Hanoi',
    scale: 150,
    unit: 'điểm',
    unitEn: 'pts',
    parts: { dinh_luong: 50, dinh_tinh: 50, khoa_hoc: 50 },
    sigmaFloor: 0.75,
  },
  vact: {
    code: 'vact',
    label: 'V-ACT',
    labelEn: 'V-ACT',
    full: 'Đánh giá năng lực — ĐHQG TP.HCM',
    fullEn: 'Competency Assessment — VNU-HCM',
    org: 'ĐHQG TP. Hồ Chí Minh',
    orgEn: 'VNU Ho Chi Minh City',
    scale: 1200,
    unit: 'điểm',
    unitEn: 'pts',
    // Một mô hình phần thi duy nhất, hai mức chi tiết (thiết kế v3 Mục 2.2):
    // nhập theo `parts` (600/300/300) hoặc theo `subParts` của phần ngôn ngữ
    // (Tiếng Việt 300 + Tiếng Anh 300) như máy tính BKHCM trước đây.
    parts: { ngon_ngu: 600, toan: 300, tu_duy_kh: 300 },
    subParts: { ngon_ngu: { tieng_viet: 300, tieng_anh: 300 } },
    sigmaFloor: 0.75,
  },
  tsa: {
    code: 'tsa',
    label: 'TSA',
    labelEn: 'TSA',
    full: 'Đánh giá tư duy — ĐH Bách khoa Hà Nội',
    fullEn: 'Thinking Skills Assessment — HUST',
    org: 'ĐH Bách khoa Hà Nội',
    orgEn: 'Hanoi Univ. of Science & Tech',
    scale: 100,
    unit: 'điểm',
    unitEn: 'pts',
    parts: { toan: 40, doc_hieu: 20, khoa_hoc: 40 },
    sigmaFloor: 0.75,
  },
  spt: {
    code: 'spt',
    label: 'SPT',
    labelEn: 'SPT',
    full: 'Đánh giá năng lực chuyên biệt — ĐH Sư phạm Hà Nội',
    fullEn: 'Specialized Competency Exam — HNUE',
    org: 'Trường ĐH Sư phạm Hà Nội',
    orgEn: 'Hanoi National Univ. of Education',
    // Tách hai thang (thiết kế v3 Mục 2.2): từng môn thang 10, tổ hợp sau khi
    // áp hệ số của trường quy về thang 30 — điểm chuẩn SPT trong dữ liệu là
    // thang 30. `scale` giữ 30 cho đường so điểm chuẩn; validate từng môn
    // phải dùng `subjectScale`.
    scale: 30,
    subjectScale: 10,
    comboScale: 30,
    unit: 'điểm tổ hợp thang 30 (từng môn thang 10)',
    unitEn: '30-pt combo score (10-pt per subject)',
    sigmaFloor: 0.9,
  },
  hsca: {
    code: 'hsca',
    label: 'H-SCA',
    labelEn: 'H-SCA',
    full: 'Đánh giá năng lực chuyên biệt — ĐH Sư phạm TP.HCM',
    fullEn: 'Specialized Competency Exam — HCMUE',
    org: 'Trường ĐH Sư phạm TP. Hồ Chí Minh',
    orgEn: 'HCMC Univ. of Education',
    scale: 30,
    subjectScale: 10,
    comboScale: 30,
    formulaFamily: 'hsca-weighted', // công thức kết hợp ở formulas.js
    unit: 'điểm xét tuyển thang 30 (điểm môn chuyên biệt thang 10)',
    unitEn: '30-pt admission score (10-pt per subject)',
    sigmaFloor: 0.9,
  },
  bca: {
    code: 'bca',
    label: 'BCA',
    labelEn: 'BCA',
    full: 'Đánh giá năng lực — Bộ Công An',
    fullEn: 'Public Security Assessment — MPS',
    org: 'Bộ Công An',
    orgEn: 'Ministry of Public Security',
    scale: 100,
    unit: 'điểm bài thi',
    unitEn: 'exam pts',
    parts: { tu_luan: 25, toan: 35, lich_su: 10, ngoai_ngu: 15, tu_chon: 15 },
    // Điểm chuẩn BCA là điểm KẾT HỢP thang 30 (phương thức 3), không phải
    // thang 100 của bài thi — công thức ở formulas.js bcaCombinedScore().
    combined: { scale: 30, thptWeight: 2 / 5, examWeightOn30: 3 / 5, formulaRef: 'bca-p3' },
    sigmaFloor: 0.9,
  },
  vsat: {
    code: 'vsat',
    label: 'V-SAT',
    labelEn: 'V-SAT',
    full: 'Kỳ thi V-SAT',
    fullEn: 'V-SAT Entrance Exam',
    org: 'Trung tâm Khảo thí Quốc gia',
    orgEn: 'National Testing Center',
    scale: 450, // tổ hợp 3 môn x 150
    subjectScale: 150,
    parts: { mon_1: 150, mon_2: 150, mon_3: 150 },
    scoreMode: 'per-subject-150',
    unit: 'điểm tổ hợp (3 môn × 150)',
    unitEn: 'combo pts (3 subjects × 150)',
    sigmaFloor: 0.9,
  },
  combined: {
    code: 'combined',
    label: 'Tổng hợp',
    labelEn: 'Composite',
    full: 'Xét tuyển tổng hợp theo trường (thang riêng, vd HCMUT/UEH thang 100)',
    fullEn: 'University Composite Admission (e.g. HCMUT/UEH 100-pt scale)',
    org: 'Theo từng trường',
    orgEn: 'By University',
    scale: null, // thang nằm ở từng bản ghi điểm chuẩn, không cố định theo kỳ thi
    unit: 'điểm theo thang của trường',
    unitEn: 'university scale pts',
    sigmaFloor: 0.9,
  },
  direct: {
    code: 'direct',
    label: 'Tuyển thẳng',
    labelEn: 'Direct',
    full: 'Tuyển thẳng / ưu tiên xét tuyển',
    fullEn: 'Direct / Priority Admission',
    org: 'Theo từng trường',
    orgEn: 'By University',
    scale: null,
    unit: '—',
    unitEn: '—',
    noScore: true,
  },
  other: {
    code: 'other',
    label: 'Khác',
    labelEn: 'Other',
    full: 'Phương thức khác',
    fullEn: 'Other Admission Method',
    org: 'Theo từng trường',
    orgEn: 'By University',
    scale: null,
    unit: '—',
    unitEn: '—',
    noScore: true,
  },
};

// Mã phương thức trong dữ liệu nguồn (sample-cutoffs.json / ingest sau này)
// -> mã registry ở trên. Dữ liệu ingest PHẢI đi qua hàm này, không so chuỗi tự do.
const METHOD_ALIASES = {
  THPT_QG: 'thpt',
  THPT: 'thpt',
  HOC_BA: 'hocba',
  HB: 'hocba',
  HSA: 'hsa',
  VACT: 'vact',
  'V-ACT': 'vact',
  TSA: 'tsa',
  SPT: 'spt',
  HSCA: 'hsca',
  'H-SCA': 'hsca',
  BCA: 'bca',
  BCA_COMBINED: 'bca',
  VSAT: 'vsat',
  'V-SAT': 'vsat',
  COMPOSITE_100: 'combined',
  INTEGRATED_100: 'combined',
  COMBINED: 'combined',
};

export function normalizeMethodCode(raw) {
  if (!raw) return 'other';
  const key = String(raw).trim().toUpperCase();
  if (EXAMS[key.toLowerCase()]) return key.toLowerCase();
  return METHOD_ALIASES[key] || 'other';
}

export function getExam(code) {
  return EXAMS[normalizeMethodCode(code)] || EXAMS.other;
}

export function getExamMeta(code, lang = 'vi') {
  const exam = getExam(code);
  const isEn = lang === 'en';
  return {
    ...exam,
    displayLabel: isEn ? exam.labelEn || exam.label : exam.label,
    displayFull: isEn ? exam.fullEn || exam.full : exam.full,
    displayOrg: isEn ? exam.orgEn || exam.org : exam.org,
    displayUnit: isEn ? exam.unitEn || exam.unit : exam.unit,
  };
}

// Khu vực ưu tiên + nhóm đối tượng ưu tiên (danh nghĩa, thang 30) — Quy chế Bộ GD&ĐT.
// NGUỒN DUY NHẤT: predict.js/formulas.js import từ đây, cấm hardcode lại.
export const REGION_PRIORITY = { KV1: 0.75, 'KV2-NT': 0.5, KV2: 0.25, KV3: 0 };
export const CATEGORY_PRIORITY = { UT1: 2.0, UT2: 1.0, NONE: 0 };
// Mốc bắt đầu giảm dần điểm ưu tiên và khoảng giảm (quy chế: tổng điểm từ
// 22,5 trở lên thì ưu tiên thực = (30 - tổng)/7,5 × danh nghĩa).
export const PRIORITY_TAPER_START = 22.5;
export const PRIORITY_TAPER_SPAN = 7.5;
