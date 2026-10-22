// Bảng neo quy đổi bách phân vị (equipercentile) — DỮ LIỆU HẠNG NHẤT.
// Trước score-v3, neo HSA chỉ sống trong file test và trong chuỗi `note` của
// một bản ghi giả, bị trích bằng regex ở trang Tìm trường. Nay neo là cấu
// trúc có nguồn (sourceUrl/sourceDate/reliability) ngay trong code + trong
// cutoffs.json (trường `conversions`) + bảng Supabase admission_conversion_anchors.
//
// QUY TẮC CỨNG (thiết kế Mục 2.4):
// - Chỉ dùng bảng quy đổi ĐÚNG NĂM của nó — cấm quy đổiข้าม năm (đặc biệt TSA:
//   mức quy đổi lao dốc theo năm).
// - Chưa có neo chính thức -> trả { value: null, reason: 'no-anchor' } và UI
//   nói rõ "chưa có neo", TUYỆT ĐỐI không rơi về quy đổi tuyến tính theo thang.
// - Ngoài khoảng neo: KẸP tại mốc biên + cờ extrapolated, không ngoại suy.
// - Bộ neo phải đơn điệu (src giảm -> dst giảm) và có tối thiểu 3 mốc;
//   bộ neo 1-2 mốc trong dữ liệu cào chỉ là khoảng tham khảo của trường,
//   không đủ chuẩn để nội suy nên bị đánh dấu 'khoang-tham-khao'.

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

export function validateAnchorSet(set) {
  const a = set?.anchors || [];
  if (a.length < 3) return { ok: false, reason: 'too-few-anchors' };
  for (let i = 0; i < a.length - 1; i++) {
    if (!(a[i].src > a[i + 1].src)) return { ok: false, reason: 'src-not-monotonic' };
    if (!(a[i].dst >= a[i + 1].dst)) return { ok: false, reason: 'dst-not-monotonic' };
  }
  return { ok: true };
}

const HSA_BO_2025_URL =
  'https://cdn.thuvienphapluat.vn/uploads/tintuc/2025/07/21/phu-luc-thong-bao-quy-doi-diem-hsa-thpt.pdf';

// Neo HSA → THPT khung Bộ GD&ĐT 2025 (Thông báo 205/TB-ĐTSKT, ĐHQGHN).
// Tổ hợp A00: bộ neo rút gọn đã kiểm chứng và khoá cứng bởi test TC-05
// (102 → 27,50). B00/C00/D01: bảng đầy đủ 14 mốc tốp 0,5%–90% của cùng văn bản
// (nguồn: crawl-dgnl-tsa.json, reliability A).
export const CONVERSION_SETS = [
  {
    fromExam: 'hsa', toExam: 'thpt', combo: 'A00', year: 2025,
    framework: 'bo-gddt-2025', scope: 'national', status: 'verified',
    anchors: [
      { topPct: 0.5, src: 130, dst: 30.0 },
      { topPct: 1, src: 120, dst: 29.5 },
      { topPct: 3, src: 110, dst: 28.5 },
      { topPct: 5, src: 102, dst: 27.5 },
      { topPct: 10, src: 100, dst: 27.25 },
      { topPct: 20, src: 90, dst: 25.5 },
      { topPct: null, src: 80, dst: 23.25 },
    ],
    sourceUrl: HSA_BO_2025_URL, sourceDate: '2025-07-18', reliability: 'A',
  },
  {
    fromExam: 'hsa', toExam: 'thpt', combo: 'B00', year: 2025,
    framework: 'bo-gddt-2025', scope: 'national', status: 'verified',
    anchors: [
      { topPct: 0.5, src: 114, dst: 28.25 }, { topPct: 1, src: 111, dst: 28.0 },
      { topPct: 2, src: 108, dst: 27.57 }, { topPct: 3, src: 105, dst: 27.25 },
      { topPct: 5, src: 102, dst: 26.75 }, { topPct: 10, src: 98, dst: 26.25 },
      { topPct: 20, src: 91, dst: 25.0 }, { topPct: 30, src: 86, dst: 23.75 },
      { topPct: 40, src: 82, dst: 22.85 }, { topPct: 50, src: 78, dst: 21.75 },
      { topPct: 60, src: 74, dst: 20.5 }, { topPct: 70, src: 70, dst: 19.25 },
      { topPct: 80, src: 66, dst: 18.1 }, { topPct: 90, src: 60, dst: 15.99 },
    ],
    sourceUrl: HSA_BO_2025_URL, sourceDate: '2025-07-18', reliability: 'A',
  },
  {
    fromExam: 'hsa', toExam: 'thpt', combo: 'C00', year: 2025,
    framework: 'bo-gddt-2025', scope: 'national', status: 'verified',
    anchors: [
      { topPct: 0.5, src: 114, dst: 28.75 }, { topPct: 1, src: 111, dst: 28.5 },
      { topPct: 2, src: 108, dst: 28.5 }, { topPct: 3, src: 105, dst: 28.25 },
      { topPct: 5, src: 102, dst: 28.0 }, { topPct: 10, src: 98, dst: 27.5 },
      { topPct: 20, src: 91, dst: 26.75 }, { topPct: 30, src: 86, dst: 26.25 },
      { topPct: 40, src: 82, dst: 25.75 }, { topPct: 50, src: 78, dst: 25.0 },
      { topPct: 60, src: 74, dst: 24.5 }, { topPct: 70, src: 70, dst: 23.5 },
      { topPct: 80, src: 66, dst: 22.6 }, { topPct: 90, src: 60, dst: 21.0 },
    ],
    sourceUrl: HSA_BO_2025_URL, sourceDate: '2025-07-18', reliability: 'A',
  },
  {
    fromExam: 'hsa', toExam: 'thpt', combo: 'D01', year: 2025,
    framework: 'bo-gddt-2025', scope: 'national', status: 'verified',
    anchors: [
      { topPct: 0.5, src: 114, dst: 26.25 }, { topPct: 1, src: 111, dst: 25.75 },
      { topPct: 2, src: 108, dst: 25.5 }, { topPct: 3, src: 105, dst: 25.0 },
      { topPct: 5, src: 102, dst: 24.5 }, { topPct: 10, src: 98, dst: 24.0 },
      { topPct: 20, src: 91, dst: 22.75 }, { topPct: 30, src: 86, dst: 22.0 },
      { topPct: 40, src: 82, dst: 21.35 }, { topPct: 50, src: 78, dst: 20.75 },
      { topPct: 60, src: 74, dst: 20.0 }, { topPct: 70, src: 70, dst: 19.35 },
      { topPct: 80, src: 66, dst: 18.6 }, { topPct: 90, src: 60, dst: 17.5 },
    ],
    sourceUrl: HSA_BO_2025_URL, sourceDate: '2025-07-18', reliability: 'A',
  },
  {
    // Neo CẤP TRƯỜNG (Trường Đại học Đồng Tháp công bố theo phân vị ĐHQG-HCM):
    // chỉ dùng tham khảo/kiểm chứng chéo cho trường đó, KHÔNG dùng làm neo
    // toàn hệ thống cho V-ACT. Trạng thái neo toàn cục V-ACT: chưa có.
    fromExam: 'vact', toExam: 'thpt', combo: null, year: 2025,
    framework: 'truong-cong-bo', scope: 'school', schoolCode: null,
    schoolLabel: 'Trường Đại học Đồng Tháp', status: 'verified',
    anchors: [
      { topPct: 3, src: 1200, dst: 30.0 }, { topPct: 3, src: 958, dst: 26.43 },
      { topPct: 5, src: 932, dst: 25.36 }, { topPct: 10, src: 886, dst: 23.89 },
      { topPct: 20, src: 815, dst: 21.83 }, { topPct: 30, src: 755, dst: 20.16 },
      { topPct: 40, src: 701, dst: 18.85 }, { topPct: 50, src: 652, dst: 17.56 },
      { topPct: 60, src: 605, dst: 16.31 }, { topPct: 70, src: 600, dst: 15.0 },
    ],
    sourceUrl:
      'https://media.dthu.edu.vn//Media\\1_DTHUTS\\FolderFunc\\202508\\Documents/4990-quy-t',
    sourceDate: '2025-08-01', reliability: 'A',
  },
  // TSA: hệ thống CHƯA có bộ neo toàn cục đủ chuẩn (>= 3 mốc, văn bản chính
  // thức). Các khoảng TSA trong cutoffs.json (conversions) chỉ có 1-2 mốc do
  // trường công bố dạng khoảng — trạng thái đúng là "chưa có neo" minh bạch.
  {
    fromExam: 'tsa', toExam: 'thpt', combo: null, year: 2025,
    framework: null, scope: 'national', status: 'chua-co-neo-chinh-thuc',
    anchors: null,
    sourceUrl: null, sourceDate: null, reliability: null,
    note: 'Chưa có bảng quy đổi TSA → THPT chính thức đủ mốc để nội suy. Chỉ ước tính được ở ngành có điểm chuẩn TSA riêng. Cấm dùng bảng của năm khác (quy đổi TSA lao dốc theo năm).',
  },
  {
    fromExam: 'vact', toExam: 'thpt', combo: null, year: 2025,
    framework: null, scope: 'national', status: 'chua-co-neo-chinh-thuc',
    anchors: null,
    sourceUrl: null, sourceDate: null, reliability: null,
    note: 'Chưa có bảng quy đổi V-ACT → THPT toàn cục chính thức trong hệ thống (chỉ có neo cấp trường). Chỉ ước tính được ở ngành có điểm chuẩn V-ACT riêng.',
  },
];

export function findAnchorSet({ fromExam, toExam = 'thpt', combo = null, year = 2025, scope = 'national' }) {
  const sets = CONVERSION_SETS.filter(
    (s) =>
      s.fromExam === fromExam &&
      s.toExam === toExam &&
      s.year === year &&
      s.scope === scope &&
      s.status === 'verified',
  );
  if (sets.length === 0) return null;
  // Ưu tiên bộ neo đúng tổ hợp; sau đó mới tới bộ neo không phân tổ hợp.
  return (
    sets.find((s) => s.combo === combo) ||
    sets.find((s) => s.combo == null) ||
    null
  );
}

// Quy đổi 1 điểm qua neo chính thức. Trả { value, extrapolated, anchorSet }
// hoặc { value: null, reason: 'no-anchor' } khi chưa có neo — nơi gọi phải
// hiển thị trạng thái này minh bạch, không tự chế đường quy đổi khác.
export function convertScore(score, opts = {}) {
  const set = findAnchorSet(opts);
  if (!set) return { value: null, reason: 'no-anchor', extrapolated: null, anchorSet: null };
  const check = validateAnchorSet(set);
  if (!check.ok) return { value: null, reason: check.reason, extrapolated: null, anchorSet: set };
  const { value, extrapolated } = equipercentile(score, set.anchors);
  return { value, extrapolated, anchorSet: set };
}

export function anchorStatus(fromExam, year = 2025) {
  const national = CONVERSION_SETS.find(
    (s) => s.fromExam === fromExam && s.year === year && s.scope === 'national',
  );
  if (!national) return { status: 'chua-co-neo-chinh-thuc', set: null };
  return { status: national.status, set: national.status === 'verified' ? national : null, note: national.note || null };
}
