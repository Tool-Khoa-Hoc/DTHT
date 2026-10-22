// Tổ hợp xét tuyển — NGUỒN SỰ THẬT DUY NHẤT (trước đây chỉ có 8 tổ hợp và bị
// sao chép ở 2 trang). Danh mục dưới đây là các tổ hợp truyền thống + các tổ
// hợp Bộ GD&ĐT công bố cho tuyển sinh 2025-2026 và các tổ hợp đang xuất hiện
// thật trong dữ liệu điểm chuẩn của hệ thống (A00..D15, K01, X-series...).
// Khoá môn lấy từ subjects.js. Tổ hợp có môn chính nhân hệ số khai `weights`.

export const COMBOS = {
  A00: { subjects: ['toan', 'ly', 'hoa'] },
  A01: { subjects: ['toan', 'ly', 'anh'] },
  A02: { subjects: ['toan', 'ly', 'sinh'] },
  A03: { subjects: ['toan', 'ly', 'su'] },
  A04: { subjects: ['toan', 'ly', 'dia'] },
  A05: { subjects: ['toan', 'hoa', 'su'] },
  A06: { subjects: ['toan', 'hoa', 'dia'] },
  A07: { subjects: ['toan', 'su', 'dia'] },
  A08: { subjects: ['toan', 'su', 'gdkp'] },
  A09: { subjects: ['toan', 'dia', 'gdkp'] },
  A10: { subjects: ['toan', 'ly', 'gdkp'] },
  A11: { subjects: ['toan', 'hoa', 'gdkp'] },
  B00: { subjects: ['toan', 'hoa', 'sinh'] },
  B01: { subjects: ['toan', 'sinh', 'su'] },
  B02: { subjects: ['toan', 'sinh', 'dia'] },
  B03: { subjects: ['toan', 'sinh', 'van'] },
  B04: { subjects: ['toan', 'sinh', 'gdkp'] },
  B05: { subjects: ['toan', 'sinh', 'anh'] },
  B06: { subjects: ['toan', 'sinh', 'hoa'] },
  B07: { subjects: ['toan', 'sinh', 'dia'] },
  B08: { subjects: ['toan', 'sinh', 'anh'] },
  C00: { subjects: ['van', 'su', 'dia'] },
  C01: { subjects: ['van', 'toan', 'ly'] },
  C02: { subjects: ['van', 'toan', 'hoa'] },
  C03: { subjects: ['van', 'toan', 'su'] },
  C04: { subjects: ['van', 'toan', 'dia'] },
  C05: { subjects: ['van', 'ly', 'hoa'] },
  C06: { subjects: ['van', 'ly', 'sinh'] },
  C07: { subjects: ['van', 'ly', 'su'] },
  C08: { subjects: ['van', 'hoa', 'sinh'] },
  C09: { subjects: ['van', 'ly', 'dia'] },
  C10: { subjects: ['van', 'su', 'hoa'] },
  C12: { subjects: ['van', 'su', 'sinh'] },
  C13: { subjects: ['van', 'su', 'gdkp'] },
  C14: { subjects: ['van', 'toan', 'gdkp'] },
  C15: { subjects: ['van', 'toan', 'anh'] },
  C16: { subjects: ['van', 'ly', 'gdkp'] },
  C17: { subjects: ['van', 'hoa', 'gdkp'] },
  C19: { subjects: ['van', 'su', 'gdkp'] },
  C20: { subjects: ['van', 'dia', 'gdkp'] },
  D01: { subjects: ['toan', 'van', 'anh'] },
  D02: { subjects: ['toan', 'van', 'nga'] },
  D03: { subjects: ['toan', 'van', 'phap'] },
  D04: { subjects: ['toan', 'van', 'trung'] },
  D05: { subjects: ['toan', 'van', 'duc'] },
  D06: { subjects: ['toan', 'van', 'nhat'] },
  D07: { subjects: ['toan', 'hoa', 'anh'] },
  D08: { subjects: ['toan', 'sinh', 'anh'] },
  D09: { subjects: ['toan', 'su', 'anh'] },
  D10: { subjects: ['toan', 'dia', 'anh'] },
  D11: { subjects: ['van', 'ly', 'anh'] },
  D12: { subjects: ['van', 'hoa', 'anh'] },
  D13: { subjects: ['van', 'sinh', 'anh'] },
  D14: { subjects: ['van', 'su', 'anh'] },
  D15: { subjects: ['van', 'dia', 'anh'] },
  D66: { subjects: ['van', 'gdkp', 'anh'] },
  D78: { subjects: ['van', 'anh', 'su'] },
  D84: { subjects: ['toan', 'gdkp', 'anh'] },
  D90: { subjects: ['toan', 'anh', 'tin'] },
  D91: { subjects: ['toan', 'anh', 'ly'] },
  D96: { subjects: ['toan', 'anh', 'gdkp'] },
  K01: { subjects: ['toan', 'van', 'ly'] },
  K02: { subjects: ['toan', 'van', 'hoa'] },
  X01: { subjects: ['toan', 'van', 'tin'] },
  X02: { subjects: ['toan', 'tin', 'anh'] },
  X06: { subjects: ['toan', 'ly', 'tin'] },
  X25: { subjects: ['toan', 'anh', 'gdkp'] },
  X26: { subjects: ['toan', 'anh', 'tin'] },
};

export const COMBO_CODES = Object.keys(COMBOS);

// Điểm tổ hợp: cộng theo hệ số (mặc định 1). Thiếu 1 môn -> null
// (KHÔNG BAO GIỜ thay môn thiếu bằng 0 — lỗi im lặng cũ).
export function comboScore(subjects, comboCode, { weights } = {}) {
  const def = COMBOS[comboCode];
  if (!def || !subjects) return null;
  const w = weights || def.weights || {};
  let sum = 0;
  let maxW = 0;
  for (const key of def.subjects) {
    const v = subjects[key];
    if (v == null || !Number.isFinite(Number(v))) return null;
    const weight = w[key] ?? 1;
    sum += Number(v) * weight;
    maxW += weight;
  }
  // Tổ hợp có hệ số: quy về thang 30 theo tổng hệ số (trừ khi nơi gọi muốn
  // giữ tổng thô — xem sptComboScore trong formulas.js).
  return maxW === 3 ? sum : (sum / maxW) * 3;
}

// Tổng thô (không quy thang) — dùng cho SPT/H-SCA khi trường cộng trực tiếp.
export function comboRawScore(subjects, comboCode, { weights } = {}) {
  const def = COMBOS[comboCode];
  if (!def || !subjects) return null;
  const w = weights || def.weights || {};
  let sum = 0;
  for (const key of def.subjects) {
    const v = subjects[key];
    if (v == null || !Number.isFinite(Number(v))) return null;
    sum += Number(v) * (w[key] ?? 1);
  }
  return sum;
}

// Mọi tổ hợp tính được từ bộ điểm theo môn đã nhập.
export function allComboScores(subjects) {
  const out = {};
  for (const code of COMBO_CODES) {
    const s = comboScore(subjects, code);
    if (s != null) out[code] = s;
  }
  return out;
}

export function bestComboFor(subjects, allowedCombos) {
  const list = allowedCombos && allowedCombos.length ? allowedCombos : COMBO_CODES;
  let best = null;
  for (const code of list) {
    const s = comboScore(subjects, code);
    if (s != null && (!best || s > best.score)) best = { combo: code, score: s };
  }
  return best;
}

// Nơi DUY NHẤT còn biết định dạng chuỗi cũ "A00/A01/K01" (và dạng "A00,A01"
// trong dữ liệu cào): chuyển về mảng mã tổ hợp chuẩn.
export function parseComboField(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((c) => String(c).trim().toUpperCase()).filter(Boolean);
  return String(raw)
    .split(/[/;,]/)
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
}
