// Hồ sơ điểm thí sinh — schema v3 cho profiles.admission_scores (JSONB).
//
// v3 (score-v3) so với v2:
// - Migration KHÔNG LÀM RƠI dữ liệu: v1 `bkhcm` -> scores.combined.HCMUT (giữ
//   nguyên trường nhập gốc để tính lại bằng công thức đã sửa mẫu số ở
//   formulas.js), v1 học bạ từng môn 3 năm -> hocba.yearly + subjects (TB 3
//   năm), khoá môn tự do được chuẩn hoá qua subjects.js ngay tại migration.
// - Thêm chỗ chứa có cấu trúc cho V-SAT (từng môn ×150), SPT/H-SCA (từng môn
//   + tổ hợp đã tính), BCA (kèm điểm kết hợp), combined theo trường kèm
//   formulaVersion.
// - validateEntry() kiểm tra theo từng phần/từng môn theo registry exams.js
//   (validateScoreInput cũ giữ lại cho tương thích).
// - saveScoreEntry() là hàm ghi DUY NHẤT (merge sâu + updatedAt) — trang
//   không tự spread admission_scores (nguyên nhân ghi đè stale, lỗi F-03).
//
// status: 'actual' (điểm thật) | 'mock' (thi thử) | 'target' (mục tiêu) | 'none'

import { EXAMS, normalizeMethodCode } from './exams.js';
import { canonicalSubjects } from './subjects.js';
import { allComboScores } from './combos.js';

export const SCORES_VERSION = 3;

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
const now = () => new Date().toISOString();

// Trung bình 3 năm cho 1 môn từ dữ liệu v1: [điểm lớp 10, 11, 12] hoặc
// object theo năm. Trả { yearly, avg }.
function yearlyAverage(raw) {
  if (Array.isArray(raw)) {
    const ys = raw.map(num);
    const valid = ys.filter((v) => v != null);
    if (!valid.length) return null;
    return { yearly: ys, avg: valid.reduce((a, b) => a + b, 0) / valid.length };
  }
  if (raw && typeof raw === 'object') {
    const ys = [num(raw.lop10 ?? raw.g10), num(raw.lop11 ?? raw.g11), num(raw.lop12 ?? raw.g12)];
    const valid = ys.filter((v) => v != null);
    if (!valid.length) return null;
    return { yearly: ys, avg: valid.reduce((a, b) => a + b, 0) / valid.length };
  }
  const single = num(raw);
  return single == null ? null : { yearly: [null, null, single], avg: single };
}

// Migrate mọi hình dạng cũ (v1 GPACalculator, v2, localStorage rời) -> v3.
// Thuần hàm. HSA/V-ACT của AdmissionCalculator v1 vẫn bị CÁCH LY vào
// legacy_unverified (lỗi đảo nhãn/thang — không tự gán lại kỳ thi).
export function migrateLegacyScores(legacy, local = {}) {
  // v2/v3 -> v3: giữ nguyên scores, chỉ nâng version + bổ sung qua migrateToV3.
  if (legacy && (legacy.version === 2 || legacy.version === 3) && legacy.scores) {
    return migrateToV3(legacy, local);
  }
  const out = emptyScoreProfile();
  if (!legacy || typeof legacy !== 'object') legacy = {};

  // THPT v1: thpt_exam_total (string) + thpt_exam (mảng môn, khoá tự do)
  const thptTotal = num(legacy.thpt_exam_total);
  if (thptTotal != null || Array.isArray(legacy.thpt_exam)) {
    const rawSubjects = {};
    if (Array.isArray(legacy.thpt_exam)) {
      for (const s of legacy.thpt_exam) {
        if (s?.name != null && num(s.grade) != null) rawSubjects[s.name] = num(s.grade);
      }
    }
    const subjects = canonicalSubjects(rawSubjects);
    out.scores.thpt = {
      status: 'actual', subjects,
      byGroup: Object.keys(subjects).length ? allComboScores(subjects) : {},
      total: thptTotal ?? undefined, migratedFrom: 'v1', updatedAt: now(),
    };
  }

  // Học bạ v1: GIỮ điểm từng môn (v2 làm rơi — chỉ giữ tổng).
  const hbTotal = num(legacy.thpt_transcript_total);
  const hbEntry = { status: 'actual', mode: 'tb-3-nam', subjects: {}, yearly: {}, byGroup: {}, migratedFrom: 'v1', updatedAt: now() };
  if (Array.isArray(legacy.thpt_transcript)) {
    for (const row of legacy.thpt_transcript) {
      // Dạng v1: { name, g10, g11, g12 } hoặc { subject/name, years: [...] }
      const name = row?.name || row?.subject;
      if (!name) continue;
      const ya = yearlyAverage(row.years || [row.g10, row.g11, row.g12]);
      if (!ya) continue;
      const key = Object.keys(canonicalSubjects({ [name]: ya.avg }))[0];
      if (!key) continue;
      hbEntry.yearly[key] = ya.yearly;
      hbEntry.subjects[key] = Math.round(ya.avg * 100) / 100;
    }
  } else if (legacy.thpt_transcript && typeof legacy.thpt_transcript === 'object') {
    for (const [name, raw] of Object.entries(legacy.thpt_transcript)) {
      const ya = yearlyAverage(raw);
      if (!ya) continue;
      const key = Object.keys(canonicalSubjects({ [name]: ya.avg }))[0];
      if (!key) continue;
      hbEntry.yearly[key] = ya.yearly;
      hbEntry.subjects[key] = Math.round(ya.avg * 100) / 100;
    }
  }
  if (Object.keys(hbEntry.subjects).length) {
    hbEntry.byGroup = allComboScores(hbEntry.subjects);
    out.scores.hocba = hbEntry;
  } else if (hbTotal != null) {
    out.scores.hocba = { status: 'actual', total: hbTotal, byGroup: {}, migratedFrom: 'v1', updatedAt: now() };
  }

  // BKHCM v1 -> combined.HCMUT: giữ NGUYÊN các trường nhập gốc để tính lại
  // bằng hcmutCombinedScore() đã sửa mẫu số (không giữ kết quả cũ đã sai).
  const bk = legacy.bkhcm;
  if (bk && typeof bk === 'object' && Object.keys(bk).length) {
    out.scores.combined = {
      HCMUT: {
        status: 'actual',
        scale: 100,
        migratedFrom: 'v1-bkhcm',
        recalcNote:
          'Điểm BKHCM của bạn đã được chuyển sang hồ sơ v3 và sẽ được tính lại bằng công thức đã sửa mẫu số (không nhân đôi Toán thì chia 12, không phải 15).',
        rawInput: bk,
        updatedAt: now(),
      },
    };
  }

  // HSA / V-ACT v1 từ AdmissionCalculator: CÁCH LY.
  for (const key of ['hsa', 'vact']) {
    if (legacy[key]?.total != null) {
      out.legacy_unverified[key] = {
        ...legacy[key],
        reason: 'v1 AdmissionCalculator đảo nhãn HSA/V-ACT và dùng chung thang 1200 — cần user xác nhận lại kỳ thi và nhập lại điểm.',
      };
    }
  }
  // TSA v1: thang 100 đúng, giữ total gốc + từng phần.
  if (legacy.tsa?.total != null && num(legacy.tsa.total) != null) {
    out.scores.tsa = {
      status: 'actual',
      total: num(legacy.tsa.total),
      scale: EXAMS.tsa.scale,
      parts: { toan: num(legacy.tsa.toan), doc_hieu: num(legacy.tsa.doc), khoa_hoc: num(legacy.tsa.kh) },
      migratedFrom: 'v1', updatedAt: now(),
    };
  }
  if (legacy.bca?.bcaScore != null && num(legacy.bca.bcaScore) != null) {
    out.scores.bca = {
      status: 'actual', total: num(legacy.bca.bcaScore), scale: EXAMS.bca.scale,
      migratedFrom: 'v1', updatedAt: now(),
    };
  }

  // localStorage GPACalculator (thang đúng): my_hsa=150, my_tsa=100.
  // bkhcm_admission (object BKHCM lưu local) cũng được hút vào combined.
  const lsHsa = num(local.my_hsa);
  if (lsHsa != null && !out.scores.hsa) {
    out.scores.hsa = { status: 'actual', total: lsHsa, scale: EXAMS.hsa.scale, migratedFrom: 'localStorage-gpa', updatedAt: now() };
  }
  const lsTsa = num(local.my_tsa);
  if (lsTsa != null && !out.scores.tsa) {
    out.scores.tsa = { status: 'actual', total: lsTsa, scale: EXAMS.tsa.scale, migratedFrom: 'localStorage-gpa', updatedAt: now() };
  }
  const lsVact = num(local.my_vact);
  if (lsVact != null) {
    out.legacy_unverified.vact_localstorage = {
      total: lsVact,
      reason: 'my_vact không có nơi ghi chính thức ở v1 — nguồn không xác định, cần user xác nhận.',
    };
  }
  if (local.bkhcm_admission && !out.scores.combined) {
    try {
      const bkLocal =
        typeof local.bkhcm_admission === 'string'
          ? JSON.parse(local.bkhcm_admission)
          : local.bkhcm_admission;
      if (bkLocal && typeof bkLocal === 'object') {
        out.scores.combined = {
          HCMUT: {
            status: 'actual', scale: 100, migratedFrom: 'v1-bkhcm',
            recalcNote:
              'Điểm BKHCM của bạn đã được chuyển sang hồ sơ v3 và sẽ được tính lại bằng công thức đã sửa mẫu số (không nhân đôi Toán thì chia 12, không phải 15).',
            rawInput: bkLocal, updatedAt: now(),
          },
        };
      }
    } catch { /* dữ liệu local hỏng — bỏ qua, không chặn migration */ }
  }
  return out;
}

// Nâng v2 -> v3 (và chuẩn hoá v3): ánh xạ 1-1, bổ sung trường mới để trống,
// giữ nguyên legacy_unverified. Không làm rơi bất kỳ entry nào.
export function migrateToV3(profile, local = {}) {
  const out = emptyScoreProfile();
  if (!profile || typeof profile !== 'object') return migrateLegacyScores(profile, local);
  out.candidate = profile.candidate || out.candidate;
  out.legacy_unverified = profile.legacy_unverified || {};
  out.scores = { ...(profile.scores || {}) };
  // v2 lưu hocba không có mode -> mặc định 'gia-tri-don' (một giá trị TB/môn).
  if (out.scores.hocba && !out.scores.hocba.mode) {
    out.scores.hocba = { ...out.scores.hocba, mode: 'gia-tri-don' };
  }
  // v2 thpt/hocba: chuẩn hoá lại khoá môn + tính lại byGroup nếu có subjects.
  for (const code of ['thpt', 'hocba']) {
    const e = out.scores[code];
    if (e?.subjects && Object.keys(e.subjects).length) {
      const subjects = canonicalSubjects(e.subjects);
      out.scores[code] = { ...e, subjects, byGroup: allComboScores(subjects) };
    }
  }
  // Hút nốt localStorage còn sót (chỉ khi hồ sơ chưa có).
  const lsHsa = num(local.my_hsa);
  if (lsHsa != null && !out.scores.hsa) {
    out.scores.hsa = { status: 'actual', total: lsHsa, scale: EXAMS.hsa.scale, migratedFrom: 'localStorage-gpa', updatedAt: now() };
  }
  const lsTsa = num(local.my_tsa);
  if (lsTsa != null && !out.scores.tsa) {
    out.scores.tsa = { status: 'actual', total: lsTsa, scale: EXAMS.tsa.scale, migratedFrom: 'localStorage-gpa', updatedAt: now() };
  }
  return out;
}

export function getScore(profileV3, methodCode) {
  const code = normalizeMethodCode(methodCode);
  const entry = profileV3?.scores?.[code];
  if (!entry || entry.status === 'none') return null;
  return entry;
}

// Ghi 1 entry vào hồ sơ v3 — hàm ghi DUY NHẤT. Merge sâu theo mã phương thức,
// đóng dấu updatedAt, không đụng các entry khác.
export function saveScoreEntry(profileV3, code, entry) {
  const base = profileV3 && profileV3.version === SCORES_VERSION ? profileV3 : migrateToV3(profileV3 || {});
  const key = normalizeMethodCode(code);
  return {
    ...base,
    scores: {
      ...base.scores,
      [key]: { ...(base.scores[key] || {}), ...entry, updatedAt: now() },
    },
  };
}

// Validate 1 entry theo registry: từng phần theo parts, từng môn theo
// subjectScale, tổng theo thang bài thi. 0 là điểm HỢP LỆ.
export function validateEntry(code, entry) {
  const exam = EXAMS[normalizeMethodCode(code)];
  if (!exam) return { ok: false, error: 'Phương thức không tồn tại trong registry' };
  if (!entry || typeof entry !== 'object') return { ok: false, error: 'Chưa nhập điểm' };
  if (entry.parts) {
    for (const [pk, pv] of Object.entries(entry.parts)) {
      if (pv == null || pv === '') continue;
      const n = num(pv);
      const max = exam.parts?.[pk];
      if (n == null) return { ok: false, error: `Điểm phần ${pk} không hợp lệ` };
      if (max != null && (n < 0 || n > max))
        return { ok: false, error: `Điểm phần ${pk} phải trong khoảng 0–${max}` };
    }
  }
  if (entry.subjects) {
    const maxSubject = exam.subjectScale ?? 10;
    for (const [sk, sv] of Object.entries(entry.subjects)) {
      if (sv == null || sv === '') continue;
      const n = num(sv);
      if (n == null || n < 0 || n > maxSubject)
        return { ok: false, error: `Điểm môn ${sk} phải trong khoảng 0–${maxSubject}` };
    }
  }
  if (entry.total != null && entry.total !== '') {
    const n = num(entry.total);
    if (n == null) return { ok: false, error: 'Điểm tổng không hợp lệ' };
    const maxTotal = entry.scale ?? exam.scale;
    if (maxTotal != null && (n < 0 || n > maxTotal))
      return { ok: false, error: `Điểm tổng phải trong khoảng 0–${maxTotal}` };
  }
  return { ok: true };
}

// Giữ tương thích nơi gọi cũ.
export function validateScoreInput(code, total) {
  const exam = EXAMS[normalizeMethodCode(code)];
  const n = num(total);
  if (n == null) return { ok: false, error: 'Chưa nhập điểm' };
  if (exam?.scale != null && (n < 0 || n > exam.scale))
    return { ok: false, error: `Điểm phải trong khoảng 0–${exam.scale}` };
  return { ok: true, value: n };
}
