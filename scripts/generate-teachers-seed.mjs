#!/usr/bin/env node
/**
 * generate-teachers-seed.mjs — sinh src/config/teachers.seed.json cho DTHT.
 *
 * Nguồn sự thật: tool/all-pairs.json của hệ drive-to-sheet (47 cặp GV ↔ Sheet).
 * Title hiển thị: ghép theo sheetId từ onlineLearning.js HIỆN TẠI (bản hardcode cũ).
 * Nếu onlineLearning.js đã ở dạng mới (import seed), script tự lấy title từ
 * teachers.seed.json đang có → chạy lại bao nhiêu lần cũng cho kết quả như nhau.
 *
 * Cách chạy:
 *   node scripts/generate-teachers-seed.mjs [--pairs <đường-dẫn-all-pairs.json>]
 * Mặc định pairs: ../agents-claude/tool/all-pairs.json (tính từ gốc repo DTHT-app).
 * Không dùng dependency ngoài — chỉ Node stdlib.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = resolve(repoRoot, 'src/config/onlineLearning.js');
const SEED_PATH = resolve(repoRoot, 'src/config/teachers.seed.json');

const args = process.argv.slice(2);
const pairsFlagIdx = args.indexOf('--pairs');
const PAIRS_PATH =
  pairsFlagIdx >= 0
    ? resolve(args[pairsFlagIdx + 1])
    : resolve(repoRoot, '../agents-claude/tool/all-pairs.json');

// Sheet HOCMAI "Nền tảng 12" dùng chung 6 môn — không thuộc hệ 47 GV, loại hẳn.
const EXCLUDED_SHEET_IDS = new Set(['1Wx8nitI3rOzBtUPhKuaFXJV-IBPzI-1Hvs8RKkHd2lI']);

// 4 GV có trong all-pairs nhưng chưa từng có title trên web → title tạm theo mã.
const PLACEHOLDER_TITLES = {
  'TOAN SHIPPER': 'TOÁN ANH SHIPPER 2K9', // theo tên tab thật trong sheet
  'VAN LINH': 'VĂN LINH 2K9',
  'SU LH': 'SỬ LH 2K9',
  'DIA TUNG': 'ĐỊA LÝ TÙNG 2K9',
};

// Nhãn môn chuẩn hoá có dấu. icon/color lấy từ file cũ (fallback = giá trị cũ bên dưới).
const SUBJECT_DEFS = [
  { id: 'TOAN', label: 'Môn Toán', shortLabel: 'Toán', icon: 'calculate', color: '#0ea5e9' },
  { id: 'LY', label: 'Môn Vật Lí', shortLabel: 'Vật Lí', icon: 'science', color: '#6366f1' },
  { id: 'HOA', label: 'Môn Hoá học', shortLabel: 'Hoá học', icon: 'science', color: '#f59e0b' },
  { id: 'ANH', label: 'Tiếng Anh', shortLabel: 'Tiếng Anh', icon: 'translate', color: '#7c3aed' },
  { id: 'SINH', label: 'Môn Sinh học', shortLabel: 'Sinh học', icon: 'biotech', color: '#10b981' },
  { id: 'VAN', label: 'Môn Ngữ Văn', shortLabel: 'Ngữ Văn', icon: 'auto_stories', color: '#ec4899' },
  { id: 'SU', label: 'Môn Lịch Sử', shortLabel: 'Lịch Sử', icon: 'history_edu', color: '#b45309' },
  { id: 'DIA', label: 'Môn Địa Lí', shortLabel: 'Địa Lí', icon: 'map', color: '#14b8a6' },
  { id: 'DGNL', label: 'Đánh giá năng lực', shortLabel: 'ĐGNL', icon: 'psychology', color: '#ef4444' },
  { id: 'DGTD', label: 'Đánh giá tư duy', shortLabel: 'ĐGTD', icon: 'track_changes', color: '#f97316' },
];

function fail(msg) {
  console.error(`generate-teachers-seed: ${msg}`);
  process.exit(1);
}

/** Parse các entry hardcode trong onlineLearning.js cũ → Map sheetId → {title, url, order} + icon/color theo môn. */
function parseLegacyConfig(source) {
  const bySheetId = new Map();
  const teacherRe =
    /title:\s*'((?:[^'\\]|\\.)*)',\s*\n\s*sheetId:\s*'([^']+)',\s*\n\s*url:\s*'([^']+)'/g;
  let m;
  let order = 0;
  while ((m = teacherRe.exec(source)) !== null) {
    bySheetId.set(m[2], {
      title: m[1].replace(/\\'/g, "'"),
      url: m[3],
      order: order++,
    });
  }
  const subjectStyle = new Map();
  const subjectRe =
    /id:\s*'([A-Z]+)',\s*\n\s*label:\s*'[^']*',\s*\n\s*shortLabel:\s*'[^']*',\s*\n\s*icon:\s*'([^']*)',\s*\n\s*color:\s*'([^']*)'/g;
  while ((m = subjectRe.exec(source)) !== null) {
    subjectStyle.set(m[1], { icon: m[2], color: m[3] });
  }
  return { bySheetId, subjectStyle };
}

function subtypeFromCode(code) {
  for (const prefix of ['HSA', 'TSA', 'VACT', 'SPT', 'HSCA']) {
    if (code.startsWith(prefix)) return prefix;
  }
  return null;
}

function main() {
  if (!existsSync(PAIRS_PATH)) fail(`không thấy all-pairs.json tại ${PAIRS_PATH}`);
  const pairsDoc = JSON.parse(readFileSync(PAIRS_PATH, 'utf8'));
  const pairs = pairsDoc.pairs;
  if (!Array.isArray(pairs) || pairs.length === 0) fail('all-pairs.json không có mảng pairs');

  // --- Nguồn title: ưu tiên bản hardcode trong onlineLearning.js; nếu file đã
  // chuyển sang dạng import seed thì lấy từ seed hiện hữu (chạy lại = idempotent).
  const configSource = readFileSync(CONFIG_PATH, 'utf8');
  const legacy = parseLegacyConfig(configSource);
  let titleBySheetId = legacy.bySheetId;
  let styleBySubject = legacy.subjectStyle;
  if (titleBySheetId.size === 0) {
    if (!existsSync(SEED_PATH)) {
      fail('onlineLearning.js không còn entry hardcode mà teachers.seed.json cũng chưa có — không có nguồn title');
    }
    const prevSeed = JSON.parse(readFileSync(SEED_PATH, 'utf8'));
    titleBySheetId = new Map(
      prevSeed.teachers.map((t, i) => [
        t.sheetId,
        { title: t.title, url: t.url, order: i, code: t.code, placeholder: Boolean(t.titleIsPlaceholder) },
      ]),
    );
    styleBySubject = new Map(prevSeed.subjects.map((s) => [s.id, { icon: s.icon, color: s.color }]));
    console.log('onlineLearning.js đã ở dạng mới → lấy title từ teachers.seed.json hiện hữu');
  }

  const subjectOrder = new Map(SUBJECT_DEFS.map((s, i) => [s.id, i]));

  const teachers = [];
  for (const pair of pairs) {
    const code = pair.gv_name;
    const sheetId = pair.sheet_id;
    const rawSubject = pair.subject_name; // TOAN|LY|HOA|ANH|SINH|VAN|SU|DIA|DGNL
    const subtype = rawSubject === 'DGNL' ? subtypeFromCode(code) : null;
    // TSA tách nhóm DGTD, các subtype ĐGNL còn lại giữ DGNL.
    const subjectId = rawSubject === 'DGNL' ? (subtype === 'TSA' ? 'DGTD' : 'DGNL') : rawSubject;

    const known = titleBySheetId.get(sheetId);
    let title;
    let url;
    let titleIsPlaceholder = false;
    let legacyOrder = Number.MAX_SAFE_INTEGER;
    if (known) {
      title = known.title;
      url = known.url;
      legacyOrder = known.order;
      // GV trước đây chỉ tồn tại trong seed với title tạm (khi chạy lại script).
      if (known.placeholder) titleIsPlaceholder = true;
    } else if (PLACEHOLDER_TITLES[code]) {
      title = PLACEHOLDER_TITLES[code];
      url = `https://docs.google.com/spreadsheets/d/${sheetId}/edit?usp=drive_link`;
      titleIsPlaceholder = true;
    } else {
      fail(`GV ${code} (${sheetId}) không có title trong web cũ và không có title tạm — dừng để tránh bịa title`);
    }
    // Sửa lỗi chính tả duy nhất đã chốt: "HSA /QDA" → "HSA".
    title = title.replace('HSA /QDA ', 'HSA ');

    const teacher = { code, title, subjectId, subtype, sheetId, url, gvFolderId: pair.gv_folder_id };
    if (titleIsPlaceholder) teacher.titleIsPlaceholder = true;
    teachers.push({ ...teacher, _sort: [subjectOrder.get(subjectId) ?? 99, legacyOrder, code] });
  }

  teachers.sort((a, b) => {
    for (let i = 0; i < 3; i++) {
      if (a._sort[i] < b._sort[i]) return -1;
      if (a._sort[i] > b._sort[i]) return 1;
    }
    return 0;
  });
  for (const t of teachers) delete t._sort;

  // Chặn sheet bị loại nếu chẳng may xuất hiện trong all-pairs.
  const kept = teachers.filter((t) => !EXCLUDED_SHEET_IDS.has(t.sheetId));

  const subjects = SUBJECT_DEFS.map((def) => {
    const style = styleBySubject.get(def.id);
    return {
      id: def.id,
      label: def.label,
      shortLabel: def.shortLabel,
      icon: style?.icon ?? def.icon,
      color: style?.color ?? def.color,
    };
  });

  const seed = {
    version: '2026-10-22',
    source: 'agents-claude/tool/all-pairs.json (47 pairs) + titles from previous src/config/onlineLearning.js',
    subjects,
    teachers: kept,
  };

  writeFileSync(SEED_PATH, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');

  // --- Tự kiểm tra nhanh ngay trong script ---
  const ids = kept.map((t) => t.sheetId);
  const pairIds = new Set(pairs.map((p) => p.sheet_id));
  const problems = [];
  if (kept.length !== pairs.length) problems.push(`số GV seed=${kept.length} ≠ pairs=${pairs.length}`);
  if (new Set(ids).size !== ids.length) problems.push('có sheetId trùng trong seed');
  if (ids.some((id) => !pairIds.has(id))) problems.push('có sheetId trong seed không thuộc all-pairs');
  if (ids.some((id) => EXCLUDED_SHEET_IDS.has(id))) problems.push('sheet HOCMAI bị loại vẫn còn trong seed');
  if (problems.length) fail(`seed sinh ra không đạt: ${problems.join('; ')}`);

  const perSubject = {};
  for (const t of kept) perSubject[t.subjectId] = (perSubject[t.subjectId] ?? 0) + 1;
  console.log(`Đã sinh ${SEED_PATH}`);
  console.log(`Tổng GV: ${kept.length} · theo môn:`, perSubject);
  console.log(`Title tạm (placeholder): ${kept.filter((t) => t.titleIsPlaceholder).map((t) => t.code).join(', ') || 'không có'}`);
}

main();
