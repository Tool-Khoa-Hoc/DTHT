// Thuật toán ước tính khả năng đỗ — implement theo ALGORITHM.md
// (~/workspace/dtht-rebuild/school-finder/ALGORITHM.md)
//
// Nguyên tắc:
// - So TRỰC TIẾP điểm chuẩn riêng từng phương thức khi có (kênh direct).
// - Dự phòng mới quy đổi equiprecentile (khung Bộ GD&ĐT 2025), cấm quy đổi
//   tuyến tính theo tỉ lệ thang làm đường chính.
// - Xác suất = probit P = Φ((điểm - điểm_chuẩn_dự_báo)/σ_eff), σ có SÀN
//   chống xác suất 99,99% giả tạo.
// - Confidence < 50: co xác suất về 50% (shrinkage) và UI không hiện % số.
//
// Mọi điểm đưa vào estimateChannel phải đã ở THANG 30 TƯƠNG ĐƯƠNG
// (điểm thô của kênh direct được chuyển qua toScale30 bằng scale của bản ghi).

import { EXAMS } from './exams.js';

export const WEIGHTS_3Y = [0.5, 0.3, 0.2];
export const SIGMA_CAP = 2.5;
export const SIGMA_DEFAULT_1Y = 1.1;
export const DATA_FACTOR = { 3: 1.0, 2: 1.25, 1: 1.6 };

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Φ(z) — CDF chuẩn tắc qua erf xấp xỉ Abramowitz–Stegun 7.1.26
export function phi(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly =
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const p = 1 - (Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI)) * poly;
  return z >= 0 ? p : 1 - p;
}

function sampleSD(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// Điểm ưu tiên THỰC áp dụng — công thức giảm dần của Bộ khi tổng điểm > 22,5.
// raw30: tổng điểm thô thang 30 CHƯA gồm ưu tiên. Luôn tính trên thang 30,
// khi dùng cho thang khác phải nhân tỉ lệ thang/30 ở nơi gọi.
export function priorityApplied(raw30, region, category) {
  const nominal =
    ({ KV1: 0.75, 'KV2-NT': 0.5, KV2: 0.25, KV3: 0 }[region] || 0) +
    ({ UT1: 2.0, UT2: 1.0, NONE: 0 }[category] || 0);
  if (raw30 <= 22.5 || nominal === 0) return nominal;
  return ((30 - raw30) / 7.5) * nominal;
}

// Quy đổi equiprecentile qua bảng neo.
// anchors: [{ topPct, src, dst }] sắp xếp src GIẢM dần (neo cao -> thấp).
// Ngoài khoảng neo: kẹp (không ngoại suy tuyến tính ra vô hạn).
export function equipercentile(score, anchors) {
  if (!anchors || anchors.length === 0) return { value: null, extrapolated: null };
  if (score >= anchors[0].src) return { value: anchors[0].dst, extrapolated: 'high' };
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (score <= a.src && score >= b.src) {
      const value =
        b.dst + ((score - b.src) * (a.dst - b.dst)) / (a.src - b.src || 1);
      return { value, extrapolated: null };
    }
  }
  const last = anchors[anchors.length - 1];
  return { value: last.dst, extrapolated: 'low' };
}

// Chuyển điểm thô của 1 kênh về thang 30 tương đương để so sánh/phân band.
// Kênh direct có điểm chuẩn riêng thì nơi gọi nên so trực tiếp trên thang gốc
// rồi mới chuẩn hoá margin — hàm này dùng cho quy đổi dự phòng + hiển thị.
export function toScale30(score, scale) {
  if (score == null || !scale) return null;
  return (score / scale) * 30;
}

// Dự báo điểm chuẩn năm nay từ lịch sử (mới -> cũ).
// history: [{ year, cutoff, quota? }] — cutoff đã cùng thang với candidate.
export function forecastCutoff(history, quotaNext, specShift = 0) {
  const cs = history.map((h) => h.cutoff);
  const w =
    cs.length >= 3 ? WEIGHTS_3Y : cs.length === 2 ? [0.65, 0.35] : [1];
  const cBar = cs.reduce((s, c, i) => s + c * (w[i] ?? 0), 0);
  const slope =
    cs.length >= 2 ? (cs[0] - cs[cs.length - 1]) / (cs.length - 1) : 0;
  const trendAdj = clamp(0.5 * slope, -0.75, 0.75);
  const quotaAdj =
    quotaNext && history[0]?.quota
      ? clamp(-0.9 * Math.log(quotaNext / history[0].quota), -1, 1)
      : 0;
  return cBar + trendAdj + quotaAdj + specShift;
}

export function sigmaFloorFor(methodCode) {
  return EXAMS[methodCode]?.sigmaFloor ?? 0.9;
}

// σ hiệu dụng: SD lịch sử nhưng không dưới sàn theo phương thức,
// nới theo hệ số thiếu dữ liệu + chưa có phổ điểm năm nay, chặn trên 2,5.
export function sigmaEff(history, methodCode, { hasCurrentSpectrum = true } = {}) {
  let s;
  if (history.length >= 3) s = sampleSD(history.map((h) => h.cutoff));
  else if (history.length === 2)
    s = Math.abs(history[0].cutoff - history[1].cutoff) / Math.SQRT2;
  else s = SIGMA_DEFAULT_1Y;
  s = Math.max(s, sigmaFloorFor(methodCode));
  s *= DATA_FACTOR[Math.min(history.length, 3)] ?? 1.6;
  if (!hasCurrentSpectrum) s *= 1.2;
  return Math.min(s, SIGMA_CAP);
}

// Confidence 0–100 theo 6 thành phần (ALGORITHM.md §5.1).
// ctx: { hasSpectrum: 'official'|'press'|'none', channel: 'direct'|'equi-official'|'equi-est'|'linear',
//        quotaYears: 0|1|2, latestYearIsCurrentSeason: boolean, sigmaHist: number }
export function computeConfidence(history, ctx = {}) {
  let score = 0;
  const years = history.length;
  score += years >= 3 ? 30 : years === 2 ? 18 : years === 1 ? 8 : 0;
  score += ctx.hasSpectrum === 'official' ? 15 : ctx.hasSpectrum === 'press' ? 8 : 0;
  score +=
    ctx.channel === 'direct'
      ? 20
      : ctx.channel === 'equi-official'
        ? 16
        : ctx.channel === 'equi-est'
          ? 10
          : ctx.channel === 'linear'
            ? 3
            : 10;
  const sd = ctx.sigmaHist ?? (years >= 2 ? sampleSD(history.map((h) => h.cutoff)) : SIGMA_DEFAULT_1Y);
  score += 15 * Math.max(0, 1 - sd / 2.5);
  score += ctx.quotaYears >= 2 ? 10 : ctx.quotaYears === 1 ? 5 : 0;
  score += ctx.latestYearIsCurrentSeason ? 10 : 4;
  return Math.round(clamp(score, 0, 100));
}

export function bandOf(p) {
  if (p >= 0.9) return { code: 'safe', label: 'An toàn' };
  if (p >= 0.7) return { code: 'likely', label: 'Khá an toàn' };
  if (p >= 0.4) return { code: 'borderline', label: 'Cân nhắc' };
  if (p >= 0.15) return { code: 'reach', label: 'Thử thách' };
  return { code: 'far', label: 'Xa tầm' };
}

// Ước tính cho 1 kênh (ngành x phương thức).
// candidate30 & history[].cutoff phải CÙNG thang (khuyến nghị: thang gốc của
// phương thức đã chuẩn hoá về 30 qua forecast trên thang gốc rồi quy đổi,
// hoặc mọi thứ ở thang 30 tương đương — nơi gọi chịu trách nhiệm nhất quán;
// sigmaFloor tra theo methodCode trên thang 30).
export function estimateChannel(candidate, history, methodCode, ctx = {}) {
  if (!history || history.length === 0 || candidate == null) return null;
  const cutoffHat = forecastCutoff(history, ctx.quotaNext, ctx.specShift ?? 0);
  const sig = sigmaEff(history, methodCode, {
    hasCurrentSpectrum: ctx.hasSpectrum != null && ctx.hasSpectrum !== 'none',
  });
  const z = (candidate - cutoffHat) / sig;
  let p = phi(z);
  const confidence = computeConfidence(history, ctx);
  if (confidence < 50) p = 0.5 + (p - 0.5) * (confidence / 50); // shrinkage
  const band = bandOf(p);
  return {
    probability: p,
    probabilityRounded: Math.round(p * 20) * 5, // bội 5% khi hiển thị
    pLow: phi(z - 1),
    pHigh: phi(z + 1),
    band: band.code,
    bandLabel: band.label,
    cutoffForecast: cutoffHat,
    sigma: sig,
    margin: candidate - cutoffHat,
    confidence,
    confidenceLabel: confidence >= 75 ? 'Cao' : confidence >= 50 ? 'Trung bình' : 'Thấp',
    showPercent: confidence >= 50,
    yearsUsed: history.map((h) => h.year),
  };
}

// Sức khoẻ danh sách nguyện vọng (ALGORITHM.md §4).
// list: [{ probability, schoolCode, majorGroup }] theo thứ tự NV1..NVn.
export function portfolioHealth(list) {
  const warnings = [];
  if (!list || list.length === 0) return { score: 0, warnings };
  if (!list.some((x) => x.probability >= 0.7))
    warnings.push({
      level: 'red',
      code: 'NO_SAFE',
      text: 'Chưa có nguyện vọng nào Khá an toàn trở lên — hãy thêm 1–2 ngành có điểm chuẩn thấp hơn điểm của bạn khoảng 1,5–2 điểm.',
    });
  const last = list[list.length - 1];
  if (last && last.probability < 0.7)
    warnings.push({
      level: 'red',
      code: 'WEAK_FLOOR',
      text: 'Nguyện vọng cuối (sàn đỡ) chưa an toàn — nếu các nguyện vọng trên trượt, nguyện vọng này cũng có thể trượt.',
    });
  const sumP = list.reduce((s, x) => s + x.probability, 0);
  if (sumP < 1.5)
    warnings.push({
      level: 'orange',
      code: 'LOW_EXPECTED',
      text: 'Tổng kỳ vọng đỗ của cả danh sách đang thấp — cân nhắc thêm nguyện vọng vừa sức.',
    });
  let score = 0;
  if (list.some((x) => x.probability >= 0.7)) score += 30;
  if (sumP >= 2) score += 20;
  else if (sumP >= 1.5) score += 10;
  if (last && bandOf(last.probability).code === 'safe') score += 10;
  // Phân bổ mềm 30/40/30 (an toàn / cân nhắc / thử thách) — đủ gần là đạt
  const safe = list.filter((x) => x.probability >= 0.7).length / list.length;
  if (safe >= 0.2 && safe <= 0.5) score += 25;
  else if (safe > 0) score += 10;
  const schools = new Set(list.map((x) => x.schoolCode)).size;
  if (schools >= Math.min(3, list.length)) score += 15;
  return { score, warnings, expectedAdmissionsProxy: sumP };
}

export const DISCLAIMER =
  'Kết quả là ước tính thống kê từ điểm chuẩn các năm trước. Điểm chuẩn thật phụ thuộc phổ điểm, số hồ sơ và chỉ tiêu của năm nay — chỉ công bố khi xét tuyển. Hãy luôn giữ ít nhất 1–2 nguyện vọng an toàn.';
