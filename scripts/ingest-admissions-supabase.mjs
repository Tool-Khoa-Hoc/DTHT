// Nạp dữ liệu điểm chuẩn vào Supabase (bảng admission_cutoffs và các bảng phụ
// của migration 20261022110000_admission_cutoffs.sql).
//
// Nguồn: public/data/admissions/cutoffs.json (sinh bởi merge-admissions-data.mjs).
// Cách dùng:
//   node scripts/ingest-admissions-supabase.mjs            -> DRY-RUN (mặc định, chỉ in báo cáo)
//   node scripts/ingest-admissions-supabase.mjs --apply    -> ghi thật qua REST (service role)
// Env bắt buộc khi --apply: VITE_SUPABASE_URL (hoặc SUPABASE_URL) +
//   SUPABASE_SERVICE_ROLE_KEY (hoặc SUPABASE_SECRET_KEY).
// Thiếu env / bảng chưa tồn tại -> in rõ trạng thái, KHÔNG coi là đã nạp.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const validDate = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apply = process.argv.includes('--apply');
const data = JSON.parse(
  readFileSync(resolve(root, 'public/data/admissions/cutoffs.json'), 'utf8'),
);
const records = data.records || [];

const METHOD_MAP = {
  THPT_QG: 'thpt', HOC_BA: 'hocba', HSA: 'hsa', VACT: 'vact', 'V-ACT': 'vact',
  TSA: 'tsa', SPT: 'spt', HSCA: 'hsca', 'H-SCA': 'hsca', BCA: 'bca',
  BCA_COMBINED: 'bca', VSAT: 'vsat', 'V-SAT': 'vsat',
  COMPOSITE_100: 'combined', INTEGRATED_100: 'combined', COMBINED: 'combined',
};
const methodOf = (raw) =>
  METHOD_MAP[String(raw || '').trim().toUpperCase()] ||
  String(raw || 'other').trim().toLowerCase();
const comboArray = (raw) => {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  const arr = String(raw).split(/[/;,]/).map((c) => c.trim().toUpperCase()).filter(Boolean);
  return arr.length ? arr : null;
};

// Trường: suy từ chính dữ liệu bản ghi (tên có dấu trong bản ghi là chuẩn).
const schools = new Map();
for (const r of records) {
  if (!schools.has(r.school_code)) {
    schools.set(r.school_code, { code: r.school_code, name_vi: r.school_name });
  }
}

const cutoffRows = records.map((r) => ({
  school_code: r.school_code,
  major_code: r.major_code || null,
  major_name: r.major_name,
  combo: comboArray(r.combo),
  method: methodOf(r.method),
  scale: r.scale,
  cutoff: r.cutoff ?? null,
  year: r.year,
  quota: r.quota ?? null,
  segment: r.segment || 'chung',
  verified: !!r.verified,
  reliability: r.reliability || 'C',
  source_url: r.source_url,
  source_date: validDate(r.source_date),
  note: r.note || null,
}));

const anchorRows = [];
for (const c of data.conversions || []) {
  for (const a of c.anchors || []) {
    anchorRows.push({
      from_exam: c.from_exam, to_exam: c.to_exam, combo: c.combo || null,
      year: c.year, framework: c.framework || 'bo-gddt-2025',
      scope: c.scope || 'national', school_code: c.school_code || null,
      src: a.src, dst: a.dst, top_pct: a.topPct ?? null,
      source_url: c.source_url, source_date: validDate(c.source_date),
      reliability: c.reliability || 'C',
    });
  }
}

const distRows = (data.score_distributions || []).map((d) => ({
  exam: d.exam === 'THPT_QG' ? 'thpt' : String(d.exam).toLowerCase(),
  year: d.year, session: d.session || 'chung', scale: d.scale ?? null,
  mean: d.mean ?? null, median: d.median ?? null, sd: d.sd ?? null,
  max_score: d.max ?? null,
  subject_stats: d.subjects || null, combos_mean: d.combos_mean || null,
  percentiles: d.percentiles || d.top_percentile || null,
  source_url: d.source_url, source_date: validDate(d.source_date),
  reliability: d.reliability || 'C', note: d.note || null,
}));

console.log('== Ingest điểm chuẩn DTHT -> Supabase ==');
console.log(`Trường: ${schools.size} · Bản ghi điểm chuẩn: ${cutoffRows.length} · Mốc neo quy đổi: ${anchorRows.length} · Phổ điểm: ${distRows.length}`);
console.log(`Đã kiểm chứng (verified & có điểm): ${cutoffRows.filter((r) => r.verified && r.cutoff != null).length}`);

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!apply) {
  console.log('\nDRY-RUN (mặc định): chưa ghi gì vào Supabase. Thêm --apply để ghi thật.');
  if (!url || !key) {
    console.log('Trạng thái env: THIẾU VITE_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY trong môi trường hiện tại — khi chạy --apply cần nạp env trước.');
  }
  process.exit(0);
}
if (!url || !key) {
  console.error('\nCHƯA ÁP ĐƯỢC: thiếu env VITE_SUPABASE_URL (hoặc SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY (hoặc SUPABASE_SECRET_KEY). Không có bản ghi nào được ghi.');
  process.exit(2);
}

async function upsert(table, rows, onConflict, chunk = 200) {
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(part),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Upsert ${table} thất bại (HTTP ${res.status}): ${body.slice(0, 400)} — bảng đã được tạo bằng migration 20261022110000 chưa?`);
    }
    console.log(`  ${table}: đã upsert ${Math.min(i + chunk, rows.length)}/${rows.length}`);
  }
}

try {
  await upsert('admission_schools', [...schools.values()], 'code');
  await upsert('admission_cutoffs', cutoffRows, 'school_code,major_code,major_name,method,year,segment');
  await upsert('admission_conversion_anchors', anchorRows, 'from_exam,to_exam,combo,year,framework,scope,school_code,src');
  await upsert('admission_score_distributions', distRows, 'exam,year,session');
  console.log('\nĐÃ NẠP XONG vào Supabase.');
} catch (err) {
  console.error('\nCHƯA NẠP ĐƯỢC:', err.message);
  process.exit(1);
}
