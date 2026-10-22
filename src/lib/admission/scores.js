// Hồ sơ điểm thí sinh — schema v2 cho profiles.admission_scores (JSONB).
// Thay thế 6 hình dạng v1 không version + localStorage rời rạc (my_tsa/my_hsa/my_vact).
//
// v2:
// {
//   version: 2,
//   candidate: { region: 'KV1|KV2-NT|KV2|KV3', category: 'UT1|UT2|NONE' },
//   scores: {
//     thpt:  { status, subjects: {toan,...}, byGroup: { A00: 27.5 }, updatedAt },
//     hocba: { status, byGroup: {...}, updatedAt },
//     hsa:   { status, total, scale: 150, parts: {...}, updatedAt },
//     vact:  { status, total, scale: 1200, parts: {...}, updatedAt },
//     tsa:   { status, total, scale: 100, parts: {...}, updatedAt },
//     bca:   { status, total, scale: 100, parts: {...}, updatedAt },
//     ...
//   },
//   legacy_unverified: { ... } // điểm HSA/V-ACT v1 bị cách ly (lỗi đảo nhãn/thang
//                              // ở AdmissionCalculator cũ) — KHÔNG tự gán lại kỳ thi,
//                              // chờ user xác nhận. Xem UX-SCHEMA.md §3.4.
// }
// status: 'actual' (điểm thật) | 'mock' (thi thử) | 'target' (mục tiêu/what-if) | 'none'

import { EXAMS, normalizeMethodCode } from './exams.js';

export const SCORES_VERSION = 2;

export function emptyScoreProfile() {
  return {
    version: SCORES_VERSION,
    candidate: { region: 'KV3', category: 'NONE' },
    scores: {},
    legacy_unverified: {},
  };
}

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

// Migrate v1 (mọi hình dạng cũ) + localStorage sang v2. Thuần hàm, chạy được ở
// cả client lẫn script test. KHÔNG tin dữ liệu hsa/vact của AdmissionCalculator v1
// (thang bị đảo) -> đưa vào legacy_unverified. Riêng hsa/tsa từ GPACalculator
// (localStorage my_hsa thang 150 / my_tsa thang 100 — thang ĐÚNG) thì tin được.
export function migrateLegacyScores(legacy, local = {}) {
  const out = emptyScoreProfile();
  if (!legacy || typeof legacy !== 'object') legacy = {};

  if (legacy.version === SCORES_VERSION && legacy.scores) {
    return { ...out, ...legacy, version: SCORES_VERSION };
  }

  // THPT — v1: thpt_exam_total dạng string "27.50", thpt_exam là mảng môn
  const thptTotal = num(legacy.thpt_exam_total);
  if (thptTotal != null) {
    const subjects = {};
    if (Array.isArray(legacy.thpt_exam)) {
      for (const s of legacy.thpt_exam) {
        if (s?.name != null && num(s.grade) != null) subjects[s.name] = num(s.grade);
      }
    }
    // Không biết tổ hợp nào tạo ra total ở v1 -> để byGroup rỗng, giữ total ở _total
    out.scores.thpt = { status: 'actual', subjects, total: thptTotal, byGroup: {}, migratedFrom: 'v1' };
  }
  const hbTotal = num(legacy.thpt_transcript_total);
  if (hbTotal != null) {
    out.scores.hocba = { status: 'actual', total: hbTotal, byGroup: {}, migratedFrom: 'v1' };
  }

  // HSA / V-ACT v1 từ AdmissionCalculator: CÁCH LY (không phân biệt được thang nào)
  for (const key of ['hsa', 'vact']) {
    if (legacy[key]?.total != null) {
      out.legacy_unverified[key] = {
        ...legacy[key],
        reason: 'v1 AdmissionCalculator đảo nhãn HSA/V-ACT và dùng chung thang 1200 — cần user xác nhận lại kỳ thi và nhập lại điểm.',
      };
    }
  }
  // TSA v1: thang 100 đúng, nhưng total đã trộn điểm ưu tiên -> giữ total gốc
  // (totalWithPriority tách riêng), ưu tiên KHÔNG migrate vào điểm gốc.
  if (legacy.tsa?.total != null && num(legacy.tsa.total) != null) {
    out.scores.tsa = {
      status: 'actual',
      total: num(legacy.tsa.total),
      scale: EXAMS.tsa.scale,
      parts: { toan: num(legacy.tsa.toan), doc_hieu: num(legacy.tsa.doc), khoa_hoc: num(legacy.tsa.kh) },
      migratedFrom: 'v1',
    };
  }
  if (legacy.bca?.bcaScore != null && num(legacy.bca.bcaScore) != null) {
    out.scores.bca = {
      status: 'actual',
      total: num(legacy.bca.bcaScore),
      scale: EXAMS.bca.scale,
      migratedFrom: 'v1',
    };
  }

  // localStorage từ GPACalculator (thang đúng): my_hsa=150, my_tsa=100.
  // my_vact không nơi nào ghi ở v1 (đường chết) — nếu tồn tại thì vẫn cách ly
  // vì không rõ nguồn.
  const lsHsa = num(local.my_hsa);
  if (lsHsa != null && !out.scores.hsa) {
    out.scores.hsa = { status: 'actual', total: lsHsa, scale: EXAMS.hsa.scale, migratedFrom: 'localStorage-gpa' };
  }
  const lsTsa = num(local.my_tsa);
  if (lsTsa != null && !out.scores.tsa) {
    out.scores.tsa = { status: 'actual', total: lsTsa, scale: EXAMS.tsa.scale, migratedFrom: 'localStorage-gpa' };
  }
  const lsVact = num(local.my_vact);
  if (lsVact != null) {
    out.legacy_unverified.vact_localstorage = {
      total: lsVact,
      reason: 'my_vact không có nơi ghi chính thức ở v1 — nguồn không xác định, cần user xác nhận.',
    };
  }
  return out;
}

// Lấy điểm của 1 phương thức từ hồ sơ v2. Trả null nếu chưa có / trạng thái none.
export function getScore(profileV2, methodCode) {
  const code = normalizeMethodCode(methodCode);
  const entry = profileV2?.scores?.[code];
  if (!entry || entry.status === 'none') return null;
  return entry;
}

// Validate + clamp điểm nhập vào theo thang của kỳ thi. 0 là giá trị HỢP LỆ
// (sửa lỗi falsy-zero của v1: if (d.tv) ...).
export function validateScoreInput(code, total) {
  const exam = EXAMS[normalizeMethodCode(code)];
  const n = num(total);
  if (n == null) return { ok: false, error: 'Chưa nhập điểm' };
  if (exam?.scale != null && (n < 0 || n > exam.scale))
    return { ok: false, error: `Điểm phải trong khoảng 0–${exam.scale}` };
  return { ok: true, value: n };
}
