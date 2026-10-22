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
    full: 'Điểm thi tốt nghiệp THPT',
    org: 'Bộ GD&ĐT',
    scale: 30,
    unit: 'điểm tổ hợp 3 môn',
    sigmaFloor: 0.75, // trên thang quy đổi 30 — xem predict.js
  },
  hocba: {
    code: 'hocba',
    label: 'Học bạ',
    full: 'Xét học bạ THPT',
    org: 'Theo từng trường',
    scale: 30,
    unit: 'điểm tổ hợp 3 môn',
    sigmaFloor: 1.0,
    // Bộ GD không có khung quy đổi chung học bạ -> THPT: cấm quy đổi chéo.
    // Chỉ ước tính được khi có điểm chuẩn học bạ riêng của ngành đó.
    noCrossConvert: true,
  },
  hsa: {
    code: 'hsa',
    label: 'HSA',
    full: 'Đánh giá năng lực — ĐHQG Hà Nội',
    org: 'ĐHQG Hà Nội',
    scale: 150,
    unit: 'điểm',
    parts: { dinh_luong: 50, dinh_tinh: 50, khoa_hoc: 50 },
    sigmaFloor: 0.75,
  },
  vact: {
    code: 'vact',
    label: 'V-ACT',
    full: 'Đánh giá năng lực — ĐHQG TP.HCM',
    org: 'ĐHQG TP. Hồ Chí Minh',
    scale: 1200,
    unit: 'điểm',
    parts: { ngon_ngu: 600, toan: 300, tu_duy_kh: 300 },
    sigmaFloor: 0.75,
  },
  tsa: {
    code: 'tsa',
    label: 'TSA',
    full: 'Đánh giá tư duy — ĐH Bách khoa Hà Nội',
    org: 'ĐH Bách khoa Hà Nội',
    scale: 100,
    unit: 'điểm',
    parts: { toan: 40, doc_hieu: 20, khoa_hoc: 40 },
    sigmaFloor: 0.75,
  },
  spt: {
    code: 'spt',
    label: 'SPT',
    full: 'Đánh giá năng lực chuyên biệt — ĐH Sư phạm Hà Nội',
    org: 'Trường ĐH Sư phạm Hà Nội',
    scale: 10, // theo môn, quy theo tổ hợp của trường
    unit: 'điểm/môn',
    sigmaFloor: 0.9,
  },
  hsca: {
    code: 'hsca',
    label: 'H-SCA',
    full: 'Đánh giá năng lực chuyên biệt — ĐH Sư phạm TP.HCM',
    org: 'Trường ĐH Sư phạm TP. Hồ Chí Minh',
    scale: 10, // theo môn/phần, chi tiết do exams.json dữ liệu bổ sung
    unit: 'điểm',
    sigmaFloor: 0.9,
  },
  bca: {
    code: 'bca',
    label: 'BCA',
    full: 'Đánh giá năng lực — Bộ Công An',
    org: 'Bộ Công An',
    scale: 100,
    unit: 'điểm bài thi',
    parts: { tu_luan: 25, toan: 35, lich_su: 10, ngoai_ngu: 15, tu_chon: 15 },
    sigmaFloor: 0.9,
  },
  vsat: {
    code: 'vsat',
    label: 'V-SAT',
    full: 'Kỳ thi V-SAT',
    org: 'Trung tâm Khảo thí Quốc gia',
    scale: 450, // tổ hợp 3 môn x 150
    unit: 'điểm tổ hợp',
    sigmaFloor: 0.9,
  },
  combined: {
    code: 'combined',
    label: 'Tổng hợp',
    full: 'Xét tuyển tổng hợp theo trường (thang riêng, vd HCMUT/UEH thang 100)',
    org: 'Theo từng trường',
    scale: null, // thang nằm ở từng bản ghi điểm chuẩn, không cố định theo kỳ thi
    unit: 'điểm theo thang của trường',
    sigmaFloor: 0.9,
  },
  direct: {
    code: 'direct',
    label: 'Tuyển thẳng',
    full: 'Tuyển thẳng / ưu tiên xét tuyển',
    org: 'Theo từng trường',
    scale: null,
    unit: '—',
    noScore: true,
  },
  other: {
    code: 'other',
    label: 'Khác',
    full: 'Phương thức khác',
    org: 'Theo từng trường',
    scale: null,
    unit: '—',
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

// Khu vực ưu tiên + nhóm đối tượng ưu tiên (danh nghĩa, thang 30) — Quy chế Bộ GD&ĐT.
export const REGION_PRIORITY = { KV1: 0.75, 'KV2-NT': 0.5, KV2: 0.25, KV3: 0 };
export const CATEGORY_PRIORITY = { UT1: 2.0, UT2: 1.0, NONE: 0 };
