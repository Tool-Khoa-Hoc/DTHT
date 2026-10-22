// Sinh public/data/admissions/cutoffs.json từ file dữ liệu nguồn đã verify.
// Nguồn seed hiện tại: ~/workspace/dtht-rebuild/school-finder/sample-cutoffs.json
// (52 records, mỗi record có source_url riêng; record cutoff=null = chưa verify,
//  vẫn được giữ trong file runtime kèm verified:false để UI hiện "đang cập nhật",
//  nhưng tầng ước tính sẽ bỏ qua — xem groupHistories trong src/lib/admission/cutoffs.js).
//
// Chạy: node scripts/build-admissions-data.mjs [duong-dan-file-nguon]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcPath =
  process.argv[2] ||
  resolve(root, '../dtht-rebuild/school-finder/sample-cutoffs.json');
const outDir = resolve(root, 'public/data/admissions');
const outPath = resolve(outDir, 'cutoffs.json');

const src = JSON.parse(readFileSync(srcPath, 'utf8'));
const records = src.records || [];
if (records.length === 0) throw new Error('File nguồn không có records');

const missingSource = records.filter((r) => !r.source_url);
if (missingSource.length > 0)
  throw new Error(`${missingSource.length} record thiếu source_url — dừng, không sinh dữ liệu không nguồn.`);

const out = {
  meta: {
    dataset: 'DTHT admissions cutoffs',
    generated_at: new Date().toISOString().slice(0, 10),
    source_file: srcPath,
    base_year: Math.max(...records.map((r) => r.year)),
    record_count: records.length,
    verified_count: records.filter((r) => r.verified && r.cutoff != null).length,
    note: 'Mỗi record giữ nguyên source_url của dữ liệu nguồn. cutoff=null nghĩa là chưa verify được — không dùng để ước tính.',
  },
  records,
  score_distributions: src.score_distributions || [],
};

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, JSON.stringify(out, null, 1));
console.log(`OK -> ${outPath} (${records.length} records, base_year ${out.meta.base_year})`);
