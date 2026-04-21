#!/usr/bin/env node
/**
 * cleanup-exam-assets.mjs
 * 
 * Quét toàn bộ public/data/exams/ và XÓA:
 *   - Tất cả file exam.json
 *   - Tất cả ảnh cắt câu hỏi: .png, .jpg, .jpeg
 *
 * GIỮ LẠI:
 *   - Tất cả thư mục (kể cả rỗng)
 *   - Tất cả file .pdf
 *   - Các loại file khác không nằm trong danh sách xóa
 *
 * Chạy: node scripts/cleanup-exam-assets.mjs
 * Dry run (xem trước, không xóa): node scripts/cleanup-exam-assets.mjs --dry-run
 */

import { readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT      = join(__dirname, '..');
const EXAM_DIR  = join(ROOT, 'public', 'data', 'exams');

// ── Cấu hình ────────────────────────────────────────────────────────────────
const DELETE_EXACT_NAMES = new Set(['exam.json']);           // tên file chính xác
const DELETE_EXTENSIONS  = new Set(['.png', '.jpg', '.jpeg']); // extension (các ảnh cắt câu hỏi)

const isDryRun = process.argv.includes('--dry-run');

// ── Helpers ──────────────────────────────────────────────────────────────────
function shouldDelete(filePath) {
  const name = basename(filePath);
  const ext  = extname(filePath).toLowerCase();
  return DELETE_EXACT_NAMES.has(name) || DELETE_EXTENSIONS.has(ext);
}

function walk(dir, deleted, kept) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    let stat;
    try { stat = statSync(fullPath); } catch { continue; }

    if (stat.isDirectory()) {
      walk(fullPath, deleted, kept);
      continue;
    }

    const rel = relative(ROOT, fullPath);
    if (shouldDelete(fullPath)) {
      deleted.push({ path: fullPath, rel, size: stat.size });
    } else {
      kept.push(rel);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log('\n🧹 DTHT — Exam Asset Cleanup');
console.log('='.repeat(50));
console.log(`📂 Target  : ${EXAM_DIR}`);
console.log(`🔍 Mode    : ${isDryRun ? '⚡ DRY RUN (không xóa thực sự)' : '🔥 LIVE (sẽ xóa vĩnh viễn!)'}`);
console.log('='.repeat(50) + '\n');

const deleted = [];
const kept    = [];
walk(EXAM_DIR, deleted, kept);

if (deleted.length === 0) {
  console.log('✅ Không tìm thấy file nào cần xóa. Thư mục đã sạch!\n');
  process.exit(0);
}

// Hiển thị danh sách sẽ bị xóa
console.log(`📋 Danh sách ${deleted.length} file sẽ bị xóa:\n`);
let totalBytes = 0;
for (const { rel, size } of deleted) {
  const kb = (size / 1024).toFixed(1).padStart(8);
  console.log(`  ❌  ${kb} KB   ${rel}`);
  totalBytes += size;
}

const totalMb = (totalBytes / 1024 / 1024).toFixed(2);
console.log(`\n📊 Tổng dung lượng giải phóng: ${totalMb} MB\n`);

if (isDryRun) {
  console.log('⚡ DRY RUN — Không có file nào bị xóa.');
  console.log('   Chạy lại không có --dry-run để xóa thực sự:\n');
  console.log('   node scripts/cleanup-exam-assets.mjs\n');
  process.exit(0);
}

// Xác nhận trước khi xóa
process.stdout.write(`⚠️  Xác nhận xóa ${deleted.length} file? [y/N] `);

process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.once('data', (input) => {
  process.stdin.pause();
  const answer = input.toString().trim().toLowerCase();

  if (answer !== 'y' && answer !== 'yes') {
    console.log('\n🚫 Đã hủy. Không có gì bị xóa.\n');
    process.exit(0);
  }

  let successCount = 0;
  let errorCount   = 0;

  for (const { path, rel } of deleted) {
    try {
      unlinkSync(path);
      console.log(`  ✅  Đã xóa: ${rel}`);
      successCount++;
    } catch (err) {
      console.error(`  ❌  Lỗi xóa ${rel}: ${err.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Thành công : ${successCount} file`);
  if (errorCount > 0) console.log(`❌ Lỗi       : ${errorCount} file`);
  console.log(`💾 Giải phóng: ${totalMb} MB`);
  console.log('='.repeat(50) + '\n');
});
