// Sinh public/data/admissions/cutoffs.json từ dữ liệu nguồn trong repo.
//
// Từ score-v3, quá trình sinh dữ liệu là bước HỢP NHẤT nhiều nguồn cào:
//   data/admissions-source/crawl-thpt.json           (280 record THPT)
//   data/admissions-source/crawl-dgnl-tsa.json       (HSA/V-ACT/TSA + quy đổi + phổ)
//   data/admissions-source/crawl-other-methods.json  (SPT/H-SCA/V-SAT/BCA/học bạ/tổng hợp)
//   data/admissions-source/legacy-cutoffs-52.json    (52 record cũ, sửa dấu khi giữ lại)
// Toàn bộ logic (chuẩn hoá phương thức thang 100, khử trùng theo khoá +
// segment, validate source_url, cảnh báo cutoff vượt thang) nằm ở
// scripts/merge-admissions-data.mjs — script này chỉ uỷ quyền sang đó để hai
// đường sinh dữ liệu không bao giờ lệch nhau.
//
// Chạy: node scripts/build-admissions-data.mjs
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mergeScript = resolve(root, 'scripts/merge-admissions-data.mjs');

const res = spawnSync(process.execPath, [mergeScript], { stdio: 'inherit' });
if (res.status !== 0) {
  console.error('build-admissions-data: merge-admissions-data.mjs thất bại.');
  process.exit(res.status ?? 1);
}
console.log('build-admissions-data: xong (logic hợp nhất ở scripts/merge-admissions-data.mjs).');
