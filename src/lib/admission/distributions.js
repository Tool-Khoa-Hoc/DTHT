// Phổ điểm chính thức theo kỳ thi × năm — trước score-v3 dữ liệu này nằm
// chết trong JSON (chỉ dùng gắn cờ có/không). Nay là tầng dữ liệu có hàm đọc:
// phân vị của thí sinh, mức bằng chứng phổ cho predict.js, trung bình tổ hợp.
// Dữ liệu hạt giống lấy từ crawl-dgnl-tsa.json (distributions) + phổ THPT
// 2025/2026 của dữ liệu cũ; bản đầy đủ nằm trong cutoffs.json
// (score_distributions) và bảng Supabase admission_score_distributions.
//
// LƯU Ý NGHIỆP VỤ: V-ACT hai đợt thi KHÔNG gộp thô (đợt 2 cao hơn hẳn do thi
// lại) — luôn giữ `session` riêng. TSA chấm IRT: phổ chỉ dùng mô tả phân vị,
// không suy ngược điểm thô.

export const SCORE_DISTRIBUTIONS = [
  { exam: 'hsa', year: 2025, session: 'chung', scale: 150, mean: 78.8, median: 78, sd: 14.3, max: 130, sourceUrl: 'https://xaydungchinhsach.chinhphu.vn/print/pho-diem-ky-thi-danh-gia-nang-luc-hsa-nam-2025-cua-dai-hoc-quoc-gia-ha-noi-119250529223043086.htm', sourceDate: '2025-05-29', reliability: 'A' },
  { exam: 'hsa', year: 2026, session: 'chung', scale: 150, mean: 79.39, median: null, sd: 15.0, max: null, sourceUrl: null, sourceDate: null, reliability: 'B' },
  { exam: 'hsa', year: 2024, session: 'chung', scale: 150, mean: 76.5, median: null, sd: null, max: null, sourceUrl: null, sourceDate: null, reliability: 'B' },
  { exam: 'vact', year: 2025, session: 'chung', scale: 1200, mean: 662.78, median: null, sd: 159.7, max: null, sourceUrl: null, sourceDate: null, reliability: 'A' },
  { exam: 'vact', year: 2026, session: 'chung', scale: 1200, mean: null, median: null, sd: null, max: null, sourceUrl: null, sourceDate: null, reliability: 'B' },
  { exam: 'vact', year: 2024, session: 'chung', scale: 1200, mean: null, median: null, sd: null, max: null, sourceUrl: null, sourceDate: null, reliability: 'B' },
  { exam: 'tsa', year: 2025, session: 'chung', scale: 100, mean: 55.23, median: null, sd: null, max: null, sourceUrl: null, sourceDate: null, reliability: 'A' },
  { exam: 'tsa', year: 2026, session: 'chung', scale: 100, mean: null, median: null, sd: null, max: null, sourceUrl: null, sourceDate: null, reliability: 'B' },
  { exam: 'tsa', year: 2024, session: 'chung', scale: 100, mean: null, median: null, sd: null, max: null, sourceUrl: null, sourceDate: null, reliability: 'B' },
];

export function getDistribution(exam, year, session = 'chung', extra = []) {
  return (
    [...extra, ...SCORE_DISTRIBUTIONS].find(
      (d) => d.exam === exam && d.year === year && (d.session || 'chung') === session,
    ) || null
  );
}

// Mức bằng chứng phổ cho predict.computeConfidence/sigmaEff:
// 'official' (có phổ chính thức kèm trung bình/độ lệch) | 'press' (có dữ liệu
// báo chí/nguồn thứ cấp) | 'none'.
export function spectrumEvidence(exam, year, extra = []) {
  const d = getDistribution(exam, year, 'chung', extra);
  if (!d) return 'none';
  if (d.mean != null && d.reliability === 'A') return 'official';
  if (d.mean != null || d.max != null) return 'press';
  return 'none';
}

export function zOf(score, dist) {
  if (!dist || dist.mean == null || !dist.sd) return null;
  return (score - dist.mean) / dist.sd;
}

// Phân vị gần đúng của điểm trong phổ (xấp xỉ chuẩn khi có mean/sd).
// Trả về số % thí sinh có điểm THẤP HƠN (0-100), hoặc null khi thiếu phổ.
export function percentileOf(exam, year, score, extra = []) {
  const d = getDistribution(exam, year, 'chung', extra);
  const z = zOf(score, d);
  if (z == null) return null;
  // CDF chuẩn tắc (cùng xấp xỉ như predict.phi nhưng viết độc lập để tránh
  // vòng import: distributions không phụ thuộc predict).
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly =
    t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const p = 1 - (Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI)) * poly;
  return Math.round((z >= 0 ? p : 1 - p) * 1000) / 10;
}

export function comboMean(exam, year, combo, extra = []) {
  const d = getDistribution(exam, year, 'chung', extra);
  return d?.combos_mean?.[combo] ?? d?.combosMean?.[combo] ?? null;
}
