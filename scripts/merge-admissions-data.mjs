// Hợp nhất dữ liệu điểm chuẩn score-v3 -> public/data/admissions/cutoffs.json
//
// Nguồn (trong repo, thư mục data/admissions-source/):
//   crawl-thpt.json          280 record THPT_QG
//   crawl-dgnl-tsa.json      201 record HSA/V-ACT/TSA + conversions + distributions
//   crawl-other-methods.json 748 record SPT/H-SCA/V-SAT/BCA/học bạ/tổng hợp
// Cộng 52 record cũ đang nằm trong public/data/admissions/cutoffs.json:
//   record trùng khoá với dữ liệu cào -> BỎ (ưu tiên bản cào có dấu, mới hơn);
//   record cũ duy nhất -> SỬA tên trường/ngành/ghi chú sang tiếng Việt có dấu
//   (bảng OLD_VI_FIX bên dưới) rồi mới giữ. Record "khoảng toàn trường"
//   (__ALL_MAJORS_RANGE__) và record neo chôn trong note bị LOẠI khỏi records
//   (neo đã có bảng conversions riêng — xem RESTRUCTURE-DESIGN.md Mục 3.2).
//
// Chuẩn hoá bắt buộc:
//   - THPT_QG nhưng scale=100 (HCMUT/UEH) -> method COMPOSITE_100.
//   - Khử trùng theo khoá (school_code, major_name chuẩn hoá, combo, method,
//     scale, year) — BCA tách thêm segment giới tính/vùng suy từ tên ngành.
//   - Validate cứng: thiếu source_url -> DỪNG; verified=true mà cutoff=null
//     -> cảnh báo liệt kê; cutoff vượt scale -> GIỮ NGUYÊN + gắn note cảnh báo,
//     tuyệt đối không tự sửa số (vd V-SAT UFM 453,48/450 là số nguồn đã gồm
//     điểm cộng theo đề án của trường).
//
// Chạy: node scripts/merge-admissions-data.mjs [--out <file>]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = resolve(root, 'data/admissions-source');
const outPath =
  process.argv.includes('--out')
    ? resolve(process.argv[process.argv.indexOf('--out') + 1])
    : resolve(root, 'public/data/admissions/cutoffs.json');

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const strip = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const comboKey = (combo) =>
  combo
    ? String(combo)
        .split(/[/,]/)
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean)
        .sort()
        .join('/')
    : '';

// Phân đoạn: khối Công an/Quân đội (và một số trường sư phạm có phân hiệu)
// công bố điểm chuẩn tách theo giới tính / vùng / hệ đào tạo / phân hiệu —
// thông tin nằm trong tên ngành hoặc trong note. Nếu không trích segment,
// bước khử trùng sẽ làm rơi mất các mức điểm khác nhau của cùng một ngành.
// Vùng BCA đổi cách chia 2025 vs 2026 nên segment luôn đi kèm năm ở khoá.
function segmentOf(r) {
  const text = `${r.major_name || ''} ; ${r.note || ''}`;
  const parts = [];
  if (/[Nn]ữ/.test(text)) parts.push('nu');
  else if (/(^|[—–\-;,\s])Nam(?=[,\s])|(?<![\p{L}])nam(?=\s+miền|\s*,)/u.test(text))
    parts.push('nam');
  const vung = text.match(/[Vv]ùng\s*(\d+)/);
  if (vung) parts.push(`vung-${vung[1]}`);
  if (/miền Bắc/.test(text)) parts.push('mien-bac');
  if (/miền Nam/.test(text)) parts.push('mien-nam');
  if (/phía Bắc/.test(text) && !vung) parts.push('phia-bac');
  if (/phía Nam/.test(text) && !vung) parts.push('phia-nam');
  if (/Hệ quân sự/.test(text)) parts.push('he-quan-su');
  if (/Hệ dân sự/.test(text)) parts.push('he-dan-su');
  const ph = text.match(/[Pp]hân hiệu\s+([^;,\)]+)/);
  if (ph) parts.push(`phan-hieu-${strip(ph[1]).replace(/\s+/g, '-')}`);
  return parts.length ? parts.join('-') : 'chung';
}

// --- Sửa dấu cho record cũ duy nhất (52 record cũ đều không dấu) -------------
const OLD_SCHOOL_VI = {
  HUST: 'Đại học Bách khoa Hà Nội',
  NEU: 'Trường Đại học Kinh tế Quốc dân',
  FTU: 'Trường Đại học Ngoại thương',
  HMU: 'Trường Đại học Y Hà Nội',
  UMP: 'Trường Đại học Y Dược TP. Hồ Chí Minh',
  HCMUT: 'Trường Đại học Bách khoa – ĐHQG TP. Hồ Chí Minh',
  UEH: 'Đại học Kinh tế TP. Hồ Chí Minh',
  UET: 'Trường Đại học Công nghệ – ĐHQG Hà Nội',
  UIT: 'Trường Đại học Công nghệ Thông tin – ĐHQG TP. Hồ Chí Minh',
  HCMUS: 'Trường Đại học Khoa học Tự nhiên – ĐHQG TP. Hồ Chí Minh',
  HNUE: 'Trường Đại học Sư phạm Hà Nội',
  HCMUE: 'Trường Đại học Sư phạm TP. Hồ Chí Minh',
  ULIS: 'Trường Đại học Ngoại ngữ – ĐHQG Hà Nội',
  HPU2: 'Trường Đại học Sư phạm Hà Nội 2',
  UED: 'Trường Đại học Giáo dục – ĐHQG Hà Nội',
  TMU: 'Trường Đại học Thương mại',
  HLU: 'Trường Đại học Luật Hà Nội',
  ULAW_HCM: 'Trường Đại học Luật TP. Hồ Chí Minh',
  HVCSND: 'Học viện Cảnh sát Nhân dân',
  HVQUANY: 'Học viện Quân y',
  HUTECH: 'Trường Đại học Công nghệ TP. Hồ Chí Minh (HUTECH)',
};
const OLD_MAJOR_VI = [
  [/Khoa hoc du lieu va Tri tue nhan tao/i, 'Khoa học dữ liệu và Trí tuệ nhân tạo'],
  [/Chuong trinh tien tien/i, '(Chương trình tiên tiến)'],
  [/Khoa hoc may tinh/i, 'Khoa học máy tính'],
  [/Ky thuat Dieu khien - Tu dong hoa/i, 'Kỹ thuật Điều khiển – Tự động hoá'],
  [/Thuong mai dien tu/i, 'Thương mại điện tử'],
  [/^Marketing$/i, 'Marketing'],
  [/Kiem toan/i, 'Kiểm toán'],
  [/Kinh doanh quoc te/i, 'Kinh doanh quốc tế'],
  [/Phan tich du lieu kinh d/i, 'Phân tích dữ liệu kinh doanh'],
  [/Kinh te doi ngoai/i, 'Kinh tế đối ngoại'],
  [/^Y khoa$/i, 'Y khoa'],
  [/Rang - Ham - Mat/i, 'Răng – Hàm – Mặt'],
  [/Dieu duong/i, 'Điều dưỡng'],
  [/Tam ly hoc/i, 'Tâm lý học'],
  [/Cong nghe thong tin/i, 'Công nghệ thông tin'],
  [/Tri tue nhan tao/i, 'Trí tuệ nhân tạo'],
  [/Su pham Lich su/i, 'Sư phạm Lịch sử'],
  [/Su pham Toan hoc/i, 'Sư phạm Toán học'],
  [/Su pham Hoa hoc/i, 'Sư phạm Hoá học'],
  [/Su pham tieng Anh/i, 'Sư phạm Tiếng Anh'],
  [/Su pham Ngu van/i, 'Sư phạm Ngữ văn'],
  [/Su pham Lich su - Dia ly/i, 'Sư phạm Lịch sử – Địa lí'],
  [/Logistics va Quan ly chuoi cung ung/i, 'Logistics và Quản lý chuỗi cung ứng'],
];
function fixOldRecord(r) {
  let major = String(r.major_name || '');
  for (const [re, rep] of OLD_MAJOR_VI) major = major.replace(re, rep);
  return {
    ...r,
    school_name: OLD_SCHOOL_VI[r.school_code] || r.school_name,
    major_name: major,
    note: r.note
      ? `${r.note} [Bản ghi cũ được giữ lại và đã sửa sang tiếng Việt có dấu khi hợp nhất score-v3.]`
      : 'Bản ghi cũ được giữ lại và đã sửa sang tiếng Việt có dấu khi hợp nhất score-v3.',
  };
}

// --- Đọc nguồn ---------------------------------------------------------------
const thpt = readJson(resolve(srcDir, 'crawl-thpt.json'));
const dgnl = readJson(resolve(srcDir, 'crawl-dgnl-tsa.json'));
const other = readJson(resolve(srcDir, 'crawl-other-methods.json'));
// Ưu tiên file legacy đã snapshot trong data/admissions-source/ (để quá trình
// tái lập được kể cả sau khi cutoffs.json đã bị ghi đè bởi lần merge trước).
const legacyPath = resolve(srcDir, 'legacy-cutoffs-52.json');
const oldPath = existsSync(legacyPath)
  ? legacyPath
  : resolve(root, 'public/data/admissions/cutoffs.json');
const oldData = existsSync(oldPath) ? readJson(oldPath) : { records: [], score_distributions: [] };

const warnings = [];
const crawled = [
  ...(thpt.records || []),
  ...(dgnl.records || []),
  ...(other.records || []),
];

// Ngày nguồn chỉ hợp lệ khi đủ YYYY-MM-DD. Nguồn cào đôi khi chỉ ghi năm
// ('2024') hoặc để trống ('') — các giá trị đó phải thành null, nếu không
// khi nạp vào cột date của admission_cutoffs sẽ lỗi 22007 (đã gặp khi seed
// lần đầu 22/10/2026: 26 bản ghi '' + 63 bản ghi chỉ có năm).
const validDate = (v) =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;

function normalizeRecord(r, origin) {
  const out = { ...r };
  out.source_date = validDate(out.source_date);
  // Chuẩn hoá phương thức: THPT_QG thang 100 là điểm TỔNG HỢP của trường
  // (HCMUT/UEH 2026), không phải điểm THPT thang 30.
  if (String(out.method).toUpperCase() === 'THPT_QG' && Number(out.scale) === 100) {
    out.method = out.school_code === 'UEH' ? 'INTEGRATED_100' : 'COMPOSITE_100';
    out.note = `${out.note || ''} [Đã chuẩn hoá phương thức: nguồn ghi THPT nhưng thang 100 là điểm tổng hợp của trường.]`.trim();
  }
  out.segment = segmentOf(out);
  out._origin = origin;
  return out;
}

const keyOf = (r) =>
  [
    String(r.school_code || '').toUpperCase(),
    strip(r.major_name),
    comboKey(r.combo),
    String(r.method || '').toUpperCase(),
    Number(r.scale),
    Number(r.year),
    r.segment || 'chung',
  ].join('|');

// Bản ghi khoảng toàn trường (__ALL_MAJORS_RANGE__) và bản ghi "phương thức
// có nhưng chưa có điểm theo ngành" (major_name=null) KHÔNG phải điểm chuẩn
// theo ngành — tách sang mảng school_ranges/annotations riêng, không trộn
// vào records (thiết kế Mục 3.2; nếu lẫn vào, trang Tìm trường sẽ hiện một
// "ngành" giả cho học sinh).
const schoolRanges = [];
const realCrawled = [];
for (const raw of crawled) {
  if (String(raw.major_name || '').startsWith('__') || raw.major_name == null) {
    schoolRanges.push(raw);
  } else {
    realCrawled.push(raw);
  }
}

const byKey = new Map();
for (const raw of realCrawled) {
  const r = normalizeRecord(raw, 'crawl-v3');
  const k = keyOf(r);
  if (byKey.has(k)) {
    const prev = byKey.get(k);
    // Trường hợp ngoại lệ: bản ghi trước ghi chú mâu thuẫn thang điểm
    // (vd "thang 10" trong khi scale=100) còn bản ghi sau khớp thang -> thay.
    if (
      Number(r.cutoff) === Number(prev.cutoff) &&
      String(prev.note || '').includes('thang 10') &&
      Number(r.scale) === 100 &&
      String(r.note || '').includes('thang 100')
    ) {
      byKey.set(k, r);
      warnings.push(`Trùng khoá, thay bằng bản ghi có ghi chú khớp thang điểm: ${k}`);
      continue;
    }
    warnings.push(
      `Trùng khoá trong dữ liệu cào, giữ bản đầu: ${k} (cutoff giữ ${prev.cutoff}, bản trùng ${r.cutoff})`,
    );
    continue;
  }
  byKey.set(k, r);
}

// Record cũ: bỏ record khoảng + record neo; trùng -> bỏ; duy nhất -> sửa dấu, giữ.
let oldKept = 0;
let oldDroppedDup = 0;
let oldDroppedMeta = 0;
for (const raw of oldData.records || []) {
  if (
    String(raw.major_name || '').startsWith('__') ||
    String(raw.major_code || '') === '__RANGE__'
  ) {
    oldDroppedMeta++;
    continue;
  }
  const fixed = normalizeRecord(fixOldRecord(raw), 'legacy-fixed');
  const k = keyOf(fixed);
  if (byKey.has(k)) {
    oldDroppedDup++;
    continue;
  }
  byKey.set(k, fixed);
  oldKept++;
}

const records = [...byKey.values()].map(({ _origin, ...r }) => r);

// --- Validate cứng -----------------------------------------------------------
const missingSource = records.filter((r) => !r.source_url);
if (missingSource.length > 0) {
  console.error(`DỪNG: ${missingSource.length} record thiếu source_url:`);
  for (const r of missingSource.slice(0, 20))
    console.error(' -', r.school_code, r.major_name, r.method, r.year);
  process.exit(1);
}
const verifiedNull = records.filter((r) => r.verified && r.cutoff == null);
for (const r of verifiedNull)
  warnings.push(
    `verified=true nhưng cutoff=null: ${r.school_code} | ${r.major_name} | ${r.method} ${r.year} — ${r.note || 'không có ghi chú giải thích'}`,
  );
for (const r of records) {
  if (r.cutoff != null && r.scale != null && Number(r.cutoff) > Number(r.scale)) {
    const warn = `[Cảnh báo: điểm chuẩn ${r.cutoff} vượt thang ${r.scale} — giữ nguyên số nguồn (đã gồm điểm cộng/quy đổi theo đề án của trường), không tự sửa.]`;
    if (!String(r.note || '').includes('vượt thang')) r.note = `${r.note || ''} ${warn}`.trim();
    warnings.push(`cutoff vượt scale: ${r.school_code} | ${r.major_name} | ${r.method} ${r.year}: ${r.cutoff}/${r.scale}`);
  }
}

// --- Conversions + distributions từ crawl-dgnl-tsa.json ----------------------
// Neo trong conversions là dữ liệu hạng nhất (không chôn trong note nữa).
// Bộ neo có < 3 mốc chỉ là KHOẢNG tham khảo của trường -> status riêng,
// conversions.js sẽ không dùng để nội suy (cấm quy đổi bằng 1-2 mốc).
const conversions = (dgnl.conversions || []).map((c) => {
  const exam = String(c.exam || '').toUpperCase();
  const isPlainCombo = /^(A|B|C|D)\d{2}$/.test(String(c.base_combo || ''));
  const isNationalHsa2025 = exam === 'HSA' && c.year === 2025 && isPlainCombo;
  return {
    from_exam: exam === 'VACT' ? 'vact' : exam.toLowerCase(),
    to_exam: 'thpt',
    combo: isPlainCombo ? c.base_combo : null,
    combo_label: isPlainCombo ? null : c.base_combo || null,
    year: c.year,
    // Bảng HSA A00 đầy đủ 14 mốc của văn bản Bộ giữ framework riêng; bộ neo
    // rút gọn đã khoá trong thiết kế (mục 2.4) mang framework 'bo-gddt-2025'
    // và được bổ sung ngay bên dưới để conversions.js dùng làm mặc định.
    framework: isNationalHsa2025
      ? c.base_combo === 'A00'
        ? 'bo-gddt-2025-phu-luc-day-du'
        : 'bo-gddt-2025'
      : 'truong-cong-bo',
    scope: isNationalHsa2025 ? 'national' : 'school',
    status:
      (c.anchors || []).length >= 3 ? 'verified' : 'khoang-tham-khao-chua-du-moc',
    warning:
      exam === 'TSA'
        ? 'Điểm TSA quy đổi lao dốc theo năm — cấm dùng bảng quy đổi này cho năm khác.'
        : 'Chỉ dùng bảng quy đổi đúng năm của nó — cấm quy đổiข้าม năm.',
    anchors: [...(c.anchors || [])].sort((a, b) => b.src - a.src),
    source_url: c.source_url,
    source_date: validDate(c.source_date),
    reliability: c.reliability || null,
    note: c.note || null,
  };
});
// Bổ sung bộ neo HSA -> A00 khung Bộ 2025 dạng rút gọn đã khoá trong thiết kế
// (RESTRUCTURE-DESIGN.md Mục 2.4) nếu chưa có: đây là bộ neo mà conversions.js
// dùng làm mặc định cho tổ hợp A00 và test TC-05 khoá cứng.
if (!conversions.some((c) => c.from_exam === 'hsa' && c.combo === 'A00' && c.framework === 'bo-gddt-2025')) {
  conversions.unshift({
    from_exam: 'hsa', to_exam: 'thpt', combo: 'A00', combo_label: null, year: 2025,
    framework: 'bo-gddt-2025', scope: 'national', status: 'verified',
    warning: 'Chỉ dùng bảng quy đổi đúng năm của nó — cấm quy đổiข้าม năm.',
    anchors: [
      { topPct: 0.5, src: 130, dst: 30.0 }, { topPct: 1, src: 120, dst: 29.5 },
      { topPct: 3, src: 110, dst: 28.5 }, { topPct: 5, src: 102, dst: 27.5 },
      { topPct: 10, src: 100, dst: 27.25 }, { topPct: 20, src: 90, dst: 25.5 },
      { topPct: null, src: 80, dst: 23.25 },
    ],
    source_url: 'https://cdn.thuvienphapluat.vn/uploads/tintuc/2025/07/21/phu-luc-thong-bao-quy-doi-diem-hsa-thpt.pdf',
    source_date: '2025-07-18', reliability: 'A',
    note: 'Bộ neo HSA → THPT tổ hợp A00, khung quy đổi bách phân vị Bộ GD&ĐT 2025 (bản rút gọn đã kiểm chứng trong thiết kế score-v3). Bảng đầy đủ 14 mốc của cùng văn bản nằm ở bản ghi conversions HSA 2025 A00 framework truong-cong-bo đi kèm.',
  });
}

const newDists = (dgnl.distributions || []).map((d) => ({
  exam: String(d.exam || '').toUpperCase() === 'VACT' ? 'vact' : String(d.exam || '').toLowerCase(),
  year: d.year,
  session: d.session || 'chung',
  scale: d.scale ?? null,
  mean: d.mean ?? null,
  median: d.median ?? null,
  sd: d.sd ?? null,
  max: d.max ?? null,
  min: d.min ?? null,
  n_candidates: d.n_candidates ?? null,
  percentiles: d.top_percentile || d.percentiles || null,
  subjects: d.subjects || null,
  combos_mean: d.combos_mean || null,
  source_url: d.source_url,
  source_date: validDate(d.source_date),
  reliability: d.reliability || null,
  note: d.note || null,
}));
const distKeys = new Set(newDists.map((d) => `${d.exam}|${d.year}|${d.session}`));
const oldDists = (oldData.score_distributions || []).filter((d) => {
  const exam = String(d.exam || '').toUpperCase() === 'THPT_QG' ? 'thpt' : String(d.exam || '').toLowerCase();
  return !distKeys.has(`${exam}|${d.year}|chung`);
});
const scoreDistributions = [...newDists, ...oldDists];

// --- Meta + ghi ra -------------------------------------------------------------
const byMethod = {};
const byYear = {};
for (const r of records) {
  byMethod[r.method] = (byMethod[r.method] || 0) + 1;
  byYear[r.year] = (byYear[r.year] || 0) + 1;
}
const out = {
  meta: {
    dataset: 'DTHT admissions cutoffs — score-v3 (hợp nhất dữ liệu cào 22/10/2026)',
    generated_at: new Date().toISOString().slice(0, 10),
    base_year: Math.max(...records.map((r) => r.year)),
    record_count: records.length,
    verified_count: records.filter((r) => r.verified && r.cutoff != null).length,
    schools_count: new Set(records.map((r) => r.school_code)).size,
    by_method: byMethod,
    by_year: byYear,
    conversions_count: conversions.length,
    distributions_count: scoreDistributions.length,
    merge_report: {
      crawled_input: crawled.length,
      school_ranges_separated: schoolRanges.length,
      old_input: (oldData.records || []).length,
      old_kept_after_vi_fix: oldKept,
      old_dropped_duplicate: oldDroppedDup,
      old_dropped_range_or_anchor: oldDroppedMeta,
      warnings_count: warnings.length,
    },
    note: 'Mỗi record giữ nguyên source_url của nguồn. cutoff=null nghĩa là chưa kiểm chứng được — không dùng để ước tính. Record cutoff vượt scale được giữ nguyên kèm cảnh báo trong note (số nguồn đã gồm điểm cộng/quy đổi).',
  },
  records,
  school_ranges: schoolRanges,
  conversions,
  score_distributions: scoreDistributions,
  warnings,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out, null, 1));
console.log(`OK -> ${outPath}`);
console.log(
  `records=${records.length} verified=${out.meta.verified_count} schools=${out.meta.schools_count} conversions=${conversions.length} distributions=${scoreDistributions.length}`,
);
console.log('by_method=', JSON.stringify(byMethod));
console.log('by_year=', JSON.stringify(byYear));
console.log(
  `old: kept=${oldKept} dup=${oldDroppedDup} meta=${oldDroppedMeta}; warnings=${warnings.length}`,
);
for (const w of warnings.slice(0, 30)) console.log('  !', w);
