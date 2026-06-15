#!/usr/bin/env node
/**
 * migrate-answers-to-supabase.js
 *
 * Đọc toàn bộ exam_keys từ Supabase (nguồn thực), convert format cũ
 * (part-1.X, part-2.X, part-3.X) sang flat ({ "1":"A", "2":"B",
 * "25":{"a":true,"b":false}, "29":"1.5" }), rồi upsert lại.
 *
 * Chạy: node scripts/migrate-answers-to-supabase.js
 * Dry run: node scripts/migrate-answers-to-supabase.js --dry-run
 *
 * Yêu cầu: SUPABASE_SECRET_KEY hoặc SUPABASE_SERVICE_ROLE_KEY trong .env
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT      = join(__dirname, '..');

// ── Supabase (service role — bypass RLS) ─────────────────────────────────────
const SUPABASE_URL              = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Thiếu VITE_SUPABASE_URL hoặc SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY trong .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
});

const isDryRun = process.argv.includes('--dry-run');

// ── Mapper: Index câu hỏi → số thứ tự tuyệt đối ────────────────────────────
//
// Format cũ trong DB:  { "part-1.1": 0, "part-1.2": 2, ..., "part-2.1": {...}, "part-3.1": "75" }
//
// Quy ước THPTQG 2025/2026:
//   Phần I  (trắc nghiệm 1 đáp án): câu 1 → 18  (18 câu, part-1.X)
//   Phần II (đúng/sai):              câu 19 → 22  (4 câu, part-2.X)
//   Phần III (trả lời ngắn):         câu 23 → 28  (6 câu, part-3.X)
//
// Tuy nhiên, số câu có thể thay đổi tuỳ đề. Ta dùng offset thực tế.
//
// Quy tắc convert:
//   part-1.N  → flat key = N                  (giữ nguyên số câu)
//   part-2.N  → flat key = (part1_count + N)  giá trị là object {a, b, c, d}
//   part-3.N  → flat key = (part1_count + part2_count + N)
//
// Value mapping:
//   part-1: 0=A, 1=B, 2=C, 3=D  → "A"/"B"/"C"/"D"
//   part-2: object {a:bool, b:bool, c:bool, d:bool} → giữ nguyên
//   part-3: string số → giữ nguyên string

function convertLegacyToFlat(legacyKey) {
    if (!legacyKey || typeof legacyKey !== 'object' || Array.isArray(legacyKey)) {
        return null;
    }

    const CHOICE_MAP = { 0: 'A', 1: 'B', 2: 'C', 3: 'D' };
    
    // Nhóm các key theo part
    const part1 = {}; // { 1: 0, 2: 2, ... }   value = 0-3
    const part2 = {}; // { 1: {a,b,c,d}, ... }   value = object
    const part3 = {}; // { 1: "75", ... }         value = string

    for (const [rawKey, value] of Object.entries(legacyKey)) {
        const key = rawKey.toLowerCase().trim();

        // part-1.N hoặc part_1.N hoặc part1.N ...
        const m1 = key.match(/^part[_-]?1[.:](\d+)$/);
        if (m1) { part1[parseInt(m1[1])] = value; continue; }

        const m2 = key.match(/^part[_-]?2[.:](\d+)$/);
        if (m2) { part2[parseInt(m2[1])] = value; continue; }

        const m3 = key.match(/^part[_-]?3[.:](\d+)$/);
        if (m3) { part3[parseInt(m3[1])] = value; continue; }

        // Đã là flat (key = pure number "1", "2", ...)
        if (/^\d+$/.test(key)) {
            // Sẽ được xử lý bên dưới: nếu toàn bộ là flat, trả về ngay
        }
    }

    // Nếu KHÔNG có key nào theo format part-X.Y → có thể đã là flat
    const hasLegacyKeys = Object.keys(part1).length > 0
                       || Object.keys(part2).length > 0
                       || Object.keys(part3).length > 0;

    if (!hasLegacyKeys) {
        // Kiểm tra xem có phải flat không
        const allNumeric = Object.keys(legacyKey).every(k => /^\d+$/.test(k));
        if (allNumeric) {
            // Đã flat — chuẩn hóa value của part1 (0→A, 1→B, ...) nếu cần
            const flat = {};
            for (const [k, v] of Object.entries(legacyKey)) {
                if (typeof v === 'number' && v >= 0 && v <= 3) {
                    flat[k] = CHOICE_MAP[v] ?? String(v);
                } else {
                    flat[k] = v;
                }
            }
            return flat;
        }
        // Format không nhận ra
        return null;
    }

    // Tính offset
    const p1Count = Object.keys(part1).length;
    const p2Count = Object.keys(part2).length;

    const flat = {};

    // Phần I
    for (const [n, val] of Object.entries(part1)) {
        const idx = parseInt(n);
        const flatKey = String(idx);
        if (typeof val === 'number' && val >= 0 && val <= 3) {
            flat[flatKey] = CHOICE_MAP[val];
        } else if (typeof val === 'string' && /^[A-Da-d]$/.test(val.trim())) {
            flat[flatKey] = val.trim().toUpperCase();
        } else {
            flat[flatKey] = val; // giữ nguyên nếu không nhận ra
        }
    }

    // Phần II (offset = số câu Phần I)
    for (const [n, val] of Object.entries(part2)) {
        const idx    = parseInt(n);
        const flatKey = String(p1Count + idx);
        // val = { a: true/false, b: true/false, c: true/false, d: true/false }
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            flat[flatKey] = val;
        } else {
            flat[flatKey] = val;
        }
    }

    // Phần III (offset = số câu Phần I + Phần II)
    for (const [n, val] of Object.entries(part3)) {
        const idx    = parseInt(n);
        const flatKey = String(p1Count + p2Count + idx);
        // val = "75" hoặc ["75","7,5"] — giữ nguyên
        flat[flatKey] = Array.isArray(val) ? val : String(val);
    }

    return flat;
}

// ── Source 1: Quét exam.json local (nếu còn) ────────────────────────────────
function scanLocalExamJsons() {
    const examDir = join(ROOT, 'public', 'data', 'exams');
    const results = [];

    function walk(dir, subjectFolder) {
        let entries;
        try { entries = readdirSync(dir); } catch { return; }
        for (const entry of entries) {
            const fullPath = join(dir, entry);
            const stat = statSync(fullPath);
            if (stat.isDirectory()) {
                // First level = subject folder (hoa, toan, sinh, ...)
                const nextSubject = subjectFolder || entry;
                walk(fullPath, nextSubject);
            } else if (entry === 'exam.json' && subjectFolder) {
                const examPath = basename(dirname(fullPath));
                results.push({ path: fullPath, examId: examPath, subjectFolder });
            }
        }
    }

    walk(examDir, null);
    return results;
}

// ── Source 2: Lấy từ Supabase exam_keys ──────────────────────────────────────
async function loadAllFromSupabase() {
    const { data, error } = await supabase
        .from('exam_keys')
        .select('exam_id, answer_key, subject_folder, scoring_format, resources');

    if (error) throw new Error(`Supabase fetch error: ${error.message}`);
    return data || [];
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log('\n🔄 DTHT — Migrate Answer Keys → Flat Format');
    console.log('='.repeat(55));
    console.log(`Mode: ${isDryRun ? '⚡ DRY RUN (không ghi)' : '🔥 LIVE'}`);
    console.log('='.repeat(55) + '\n');

    // ── Phase 1: Collect from local exam.json files ──
    const localFiles = scanLocalExamJsons();
    const localRecords = [];

    if (localFiles.length > 0) {
        console.log(`📂 Tìm thấy ${localFiles.length} file exam.json local...\n`);
        for (const { path, examId, subjectFolder } of localFiles) {
            try {
                const raw  = JSON.parse(readFileSync(path, 'utf8'));
                let answerKey = {};

                // Trích xuất từ cấu trúc parts -> questions
                const parts = raw.parts || raw.questions || [];
                let globalIdx = 0;

                for (const part of parts) {
                    const questions = part.questions || [];
                    for (const q of questions) {
                        globalIdx++;
                        const qId  = String(globalIdx);
                        const ans  = q.correct_answer ?? q.correctAnswer
                                  ?? q.answer_key    ?? q.answer;

                        if (ans === undefined || ans === null) continue;

                        // True/false part (có sub-answers)
                        if (q.sub_answers || q.statements) {
                            const statements = q.sub_answers || q.statements;
                            const obj = {};
                            for (const s of statements) {
                                const sid = (s.id || s.label || '').toLowerCase();
                                if (sid) obj[sid] = !!s.correct_answer;
                            }
                            if (Object.keys(obj).length > 0) {
                                answerKey[qId] = obj;
                                continue;
                            }
                        }

                        // Single choice: number → A/B/C/D
                        const CMAP = { 0: 'A', 1: 'B', 2: 'C', 3: 'D' };
                        if (typeof ans === 'number' && ans >= 0 && ans <= 3) {
                            answerKey[qId] = CMAP[ans];
                        } else {
                            answerKey[qId] = ans;
                        }
                    }
                }

                if (Object.keys(answerKey).length > 0) {
                    localRecords.push({
                        exam_id:        examId,
                        subject_folder: subjectFolder,
                        answer_key:     answerKey,
                        scoring_format: 'flat',
                    });
                    console.log(`  ✅ ${examId} (${subjectFolder}) — ${Object.keys(answerKey).length} câu`);
                } else {
                    console.log(`  ⚠️  ${examId} — không trích xuất được đáp án`);
                }
            } catch (e) {
                console.log(`  ❌ ${examId}: ${e.message}`);
            }
        }
    } else {
        console.log('📂 Không có exam.json local. Chuyển sang migrate từ Supabase...\n');
    }

    // ── Phase 2: Convert legacy DB records ──────────────────────────────────
    const dbRecords = await loadAllFromSupabase();
    console.log(`☁️  Loaded ${dbRecords.length} records từ Supabase exam_keys\n`);

    const toUpsert = [];
    let alreadyFlat = 0, converted = 0, skipped = 0, noKey = 0;

    for (const row of dbRecords) {
        // Kiểm tra: answer_key có phải đã flat thực sự chưa?
        const hasLegacyPattern = Object.keys(row.answer_key || {})
            .some(k => /^part[_-]?[123][.:]/.test(k));

        const subjectFolder = row.subject_folder
            || row.resources?.subject_folder
            || row.resources?.subjectFolder
            || row.resources?.subject
            || 'unknown';

        if (!row.answer_key || Object.keys(row.answer_key).length === 0) {
            console.log(`  ⚠️  ${row.exam_id}: answer_key rỗng — bỏ qua`);
            noKey++;
            continue;
        }

        if (!hasLegacyPattern && row.scoring_format === 'flat') {
            // Kiểm tra giá trị: nếu là số 0-3 thay vì A-D → vẫn cần convert
            const hasNumericValues = Object.values(row.answer_key)
                .some(v => typeof v === 'number' && v >= 0 && v <= 3);
            
            if (!hasNumericValues) {
                console.log(`  ✓  ${row.exam_id}: đã flat & đúng format — bỏ qua`);
                alreadyFlat++;
                continue;
            }
        }

        // Cần convert
        const flat = convertLegacyToFlat(row.answer_key);
        if (!flat || Object.keys(flat).length === 0) {
            console.log(`  ❌ ${row.exam_id}: không convert được — bỏ qua`);
            skipped++;
            continue;
        }

        toUpsert.push({
            exam_id:        row.exam_id,
            subject_folder: subjectFolder,
            answer_key:     flat,
            scoring_format: 'flat',
            last_synced_at: new Date().toISOString(),
        });
        console.log(`  🔄 ${row.exam_id} (${subjectFolder}) — ${Object.keys(row.answer_key).length} → ${Object.keys(flat).length} câu`);
        converted++;
    }

    // Thêm local records vào batch
    for (const rec of localRecords) {
        const exists = toUpsert.find(r => r.exam_id === rec.exam_id);
        if (!exists) {
            toUpsert.push({
                exam_id:        rec.exam_id,
                subject_folder: rec.subject_folder,
                answer_key:     rec.answer_key,
                scoring_format: 'flat',
                last_synced_at: new Date().toISOString(),
            });
        }
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(55));
    console.log(`📊 Tổng kết:`);
    console.log(`  ✅ Đã flat (bỏ qua): ${alreadyFlat}`);
    console.log(`  🔄 Cần convert:      ${converted}`);
    console.log(`  ⚠️  Không có đáp án: ${noKey}`);
    console.log(`  ❌ Không convert đc: ${skipped}`);
    console.log(`  📤 Sẽ upsert:        ${toUpsert.length} records`);
    console.log('='.repeat(55) + '\n');

    if (toUpsert.length === 0) {
        console.log('✅ Không có gì để upsert. Hoàn thành!\n');
        return;
    }

    if (isDryRun) {
        console.log('⚡ DRY RUN — không ghi vào DB.');
        console.log('  Chạy lại không có --dry-run để ghi thực sự:\n');
        console.log('  node scripts/migrate-answers-to-supabase.js\n');
        return;
    }

    // ── Upsert lên Supabase (batch 50) ────────────────────────────────────────
    const BATCH = 50;
    let successCount = 0;
    let errorCount   = 0;

    for (let i = 0; i < toUpsert.length; i += BATCH) {
        const batch = toUpsert.slice(i, i + BATCH);
        const { error } = await supabase
            .from('exam_keys')
            .upsert(batch, {
                onConflict:        'exam_id',
                ignoreDuplicates:  false,
            });

        if (error) {
            console.error(`  ❌ Batch ${i/BATCH + 1} lỗi: ${error.message}`);
            errorCount += batch.length;
        } else {
            console.log(`  ✅ Batch ${Math.floor(i/BATCH) + 1}: upsert ${batch.length} records`);
            successCount += batch.length;
        }
    }

    console.log('\n' + '='.repeat(55));
    console.log(`🎉 Hoàn thành!`);
    console.log(`  ✅ Thành công: ${successCount} records`);
    if (errorCount > 0) console.log(`  ❌ Lỗi:       ${errorCount} records`);
    console.log('='.repeat(55) + '\n');
}

main().catch(err => {
    console.error('\n💥 Fatal error:', err.message);
    process.exit(1);
});
