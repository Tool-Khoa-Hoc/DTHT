// Công thức tính điểm theo trường / khối ngành — mọi công thức sống ở đây,
// trang chỉ gọi hàm. Mỗi công thức đăng ký kèm (schoolCode, method, năm áp
// dụng, formulaVersion, sourceUrl) vì công thức đổi theo năm là bình thường.
//
// ĐÃ SỬA so với bản hardcode cũ trong GPACalculator.jsx:
// - BKHCM: mẫu số điểm năng lực = maxDGNL/100 (15 khi nhân đôi Toán, 12 khi
//   KHÔNG nhân đôi) — bản cũ luôn chia 15 khiến thí sinh không nhân Toán mất
//   tới 20 điểm năng lực. Test TC-11 khoá lỗi này.
// - Ưu tiên BKHCM: không còn ô nhập tay thang 100 — tính bằng
//   priorityAppliedForScale() từ điểm thô thang 30 (quy chế giảm dần).

import { priorityApplied, priorityAppliedForScale } from './predict.js';
import { comboRawScore } from './combos.js';

const round2 = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// BCA — phương thức 3 (kết hợp): ĐXT thang 30 =
//   điểm tổ hợp THPT × 2/5 + (điểm bài thi BCA quy thang 30) × 3/5
//   + điểm cộng; ưu tiên cộng theo quy chế trên thang 30 sau khi kết hợp.
export function bcaCombinedScore({
  thptComboScore,
  bcaExamScore,
  bonus = 0,
  region = 'KV3',
  category = 'NONE',
} = {}) {
  if (thptComboScore == null || bcaExamScore == null) return null;
  const bcaOn30 = (Number(bcaExamScore) / 100) * 30;
  const base = Number(thptComboScore) * (2 / 5) + bcaOn30 * (3 / 5);
  const uuTien = priorityApplied(base, region, category);
  const value = base + Number(bonus || 0) + uuTien;
  return {
    value: round2(value),
    scale: 30,
    formulaVersion: 'bca-p3-v1',
    breakdown: {
      thptPhan: round2(Number(thptComboScore) * (2 / 5)),
      bcaQuy30: round2(bcaOn30),
      bcaPhan: round2(bcaOn30 * (3 / 5)),
      diemCong: Number(bonus || 0),
      uuTien: round2(uuTien),
    },
    explain: [
      `Điểm tổ hợp THPT đóng góp: ${round2(Number(thptComboScore) * (2 / 5))} (× 2/5)`,
      `Điểm bài thi BCA quy thang 30: ${round2(bcaOn30)}, đóng góp: ${round2(bcaOn30 * (3 / 5))} (× 3/5)`,
      `Điểm ưu tiên thực áp dụng (thang 30): +${round2(uuTien)}`,
    ],
  };
}

// ---------------------------------------------------------------------------
// HCMUT (ĐH Bách khoa TP.HCM) — xét tuyển tổng hợp thang 100.
//   Điểm học lực = Điểm năng lực × 70% + TNTHPT quy đổi × 20% + Học bạ quy đổi × 10%
//   ĐT 2.1 (có ĐGNL): Điểm năng lực = (tổng V-ACT + Toán×2 nếu tổ hợp nhân Toán)
//                      / (maxDGNL/100), maxDGNL = 1500 (có ×2) hoặc 1200.
//   ĐT 2.2 (không ĐGNL): Điểm năng lực = TNTHPT quy đổi × 0,75.
//   TNTHPT quy đổi = (tổng 3 môn, Toán ×2 nếu nhân Toán) / (4 hoặc 3) × 10.
export function hcmutCombinedScore(input = {}) {
  const {
    vactTotal = null,
    vactToan = null,
    doubleMath = false,
    thptScores = null, // [môn1, môn2, môn3] thang 10
    thptMathScore = null,
    hocbaScores = null, // [môn1, môn2, môn3] thang 10
    hocbaMathScore = null,
    bonus = 0,
    region = 'KV3',
    category = 'NONE',
  } = input;

  const quyDoi100 = (scores, mathScore) => {
    if (!scores || scores.length !== 3 || scores.some((s) => s == null)) return null;
    const sum = scores.reduce((a, b) => a + Number(b), 0) + (doubleMath ? Number(mathScore || 0) : 0);
    return (sum / (doubleMath ? 4 : 3)) * 10;
  };

  const tnthptQD = quyDoi100(thptScores, thptMathScore);
  const hbQD = quyDoi100(hocbaScores, hocbaMathScore);
  if (tnthptQD == null || hbQD == null) return null;

  const hasVact = vactTotal != null;
  let diemNL;
  if (hasVact) {
    const weighted = Number(vactTotal) + (doubleMath ? Number(vactToan || 0) : 0);
    const maxDGNL = doubleMath ? 1500 : 1200;
    diemNL = weighted / (maxDGNL / 100);
  } else {
    diemNL = tnthptQD * 0.75;
  }
  const hocLuc = diemNL * 0.7 + tnthptQD * 0.2 + hbQD * 0.1;
  // Ưu tiên: tính trên điểm thô thang 30 tương đương rồi quy sang thang 100.
  const raw30 = tnthptQD * 0.3;
  const uuTien = priorityAppliedForScale(raw30, 100, region, category);
  const value = Math.min(100, hocLuc + Number(bonus || 0) + uuTien);
  return {
    value: round2(value),
    scale: 100,
    formulaVersion: 'hcmut-tong-hop-v1',
    breakdown: {
      diemNL: round2(diemNL),
      tnthptQD: round2(tnthptQD),
      hbQD: round2(hbQD),
      hocLuc: round2(hocLuc),
      diemCong: Number(bonus || 0),
      uuTien: round2(uuTien),
      doiTuong: hasVact ? 'ĐT 2.1 (có điểm ĐGNL)' : 'ĐT 2.2 (không có điểm ĐGNL)',
    },
    explain: [
      `Điểm năng lực: ${round2(diemNL)} (${hasVact ? `V-ACT quy đổi, mẫu số ${doubleMath ? 15 : 12}` : 'TNTHPT quy đổi × 0,75'})`,
      `Điểm TNTHPT quy đổi: ${round2(tnthptQD)} · Điểm học bạ quy đổi: ${round2(hbQD)}`,
      `Điểm học lực = ${round2(diemNL)} × 70% + ${round2(tnthptQD)} × 20% + ${round2(hbQD)} × 10% = ${round2(hocLuc)}`,
    ],
  };
}

// ---------------------------------------------------------------------------
// H-SCA (ĐH Sư phạm TP.HCM) — điểm xét tuyển thang 30 đã kết hợp:
//   ĐT = (0,5 × điểm môn chính ĐGNLCB + 0,35 × ĐHB1 + 0,15 × ĐHB2) × 3
// (ĐHB1/ĐHB2: điểm học bạ hai môn còn lại trong tổ hợp, thang 10.)
export function hscaComboScore({ monChinh, hb1, hb2 } = {}) {
  if (monChinh == null || hb1 == null || hb2 == null) return null;
  const value = (0.5 * Number(monChinh) + 0.35 * Number(hb1) + 0.15 * Number(hb2)) * 3;
  return {
    value: round2(value),
    scale: 30,
    formulaVersion: 'hsca-hcmue-v1',
    explain: [
      `Điểm xét tuyển H-SCA = (0,5 × ${monChinh} + 0,35 × ${hb1} + 0,15 × ${hb2}) × 3 = ${round2(value)}`,
    ],
  };
}

// SPT (ĐH Sư phạm Hà Nội) — tổng tổ hợp theo hệ số trường công bố.
// Không có hệ số: cộng đều 3 môn (thang 30). Có hệ số: quy về thang 30 theo
// tổng hệ số. Từ 2025 HNUE công bố điểm chung sau quy đổi tương đương cho
// các phương thức — điểm SPT thuần trong dữ liệu chủ yếu là các năm/trường
// còn công bố riêng; hàm này chỉ tính điểm tổ hợp, không tự gán phương thức.
export function sptComboScore(subjectScores, comboCode, { weights } = {}) {
  const raw = comboRawScore(subjectScores, comboCode, { weights });
  if (raw == null) return null;
  if (!weights) return { value: round2(raw), scale: 30, formulaVersion: 'spt-combo-v1' };
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const value = totalWeight > 0 ? (raw / totalWeight) * 3 : raw;
  return { value: round2(value), scale: 30, formulaVersion: 'spt-combo-weighted-v1' };
}

// V-SAT — tổng tổ hợp 3 môn, mỗi môn thang 150.
export function vsatComboScore(subjectScores150) {
  if (!subjectScores150) return null;
  const values = Object.values(subjectScores150).filter((v) => v != null).map(Number);
  if (values.length !== 3) return null;
  if (values.some((v) => !Number.isFinite(v) || v < 0 || v > 150)) return null;
  const value = values.reduce((a, b) => a + b, 0);
  return {
    value,
    scale: 450,
    formulaVersion: 'vsat-combo-v1',
    explain: [`Tổng tổ hợp V-SAT = ${values.join(' + ')} = ${value} (thang 450)`],
  };
}

// ---------------------------------------------------------------------------
// Đăng ký công thức tổng hợp thang 100 theo trường × năm. Trường CHƯA có văn
// bản công thức đã kiểm chứng -> trạng thái minh bạch, hàm trả value=null với
// reason 'formula-unverified' — tuyệt đối không suy công thức từ điểm chuẩn.
export const INTEGRATED_FORMULAS = {
  HCMUT: {
    schoolCode: 'HCMUT', method: 'combined', scale: 100, status: 'verified',
    formulaVersion: 'hcmut-tong-hop-v1', compute: hcmutCombinedScore,
  },
  UEH: {
    schoolCode: 'UEH', method: 'combined', scale: 100, status: 'cho-van-ban-chinh-thuc',
    formulaVersion: null, compute: null,
    note: 'UEH công bố điểm chuẩn tích hợp thang 100 nhưng hệ thống chưa có văn bản công thức chính thức đã kiểm chứng theo năm — chưa hỗ trợ tính điểm tổng hợp cho UEH.',
  },
  UIT: {
    schoolCode: 'UIT', method: 'combined', scale: 100, status: 'cho-van-ban-chinh-thuc',
    formulaVersion: null, compute: null,
    note: 'UIT công bố điểm chuẩn tổng hợp thang 100 (2026) nhưng công thức dự kiến trong nguồn chưa phải văn bản chính thức — chưa hỗ trợ tính, chỉ tra được điểm chuẩn.',
  },
};

export function integrated100Score(schoolCode, input = {}) {
  const reg = INTEGRATED_FORMULAS[String(schoolCode || '').toUpperCase()];
  if (!reg) {
    return { value: null, reason: 'school-not-registered', scale: 100, explain: ['Trường này chưa đăng ký công thức tổng hợp thang 100 trong hệ thống.'] };
  }
  if (reg.status !== 'verified' || !reg.compute) {
    return {
      value: null, reason: 'formula-unverified', scale: 100,
      explain: [reg.note || 'Chưa có công thức chính thức đã kiểm chứng cho trường này.'],
    };
  }
  return reg.compute(input);
}

// Tên cũ giữ tương thích với bản thiết kế (uehIntegratedScore).
export function uehIntegratedScore(input = {}) {
  return integrated100Score('UEH', input);
}
