#!/usr/bin/env node
/**
 * sync-pdf-supabase.mjs
 * =====================
 * Quét bucket `exams` trên Supabase Storage, tìm file PDF trong mỗi folder,
 * rồi cập nhật `document_url` vào cột `resources` (jsonb) của bảng `exam_keys`.
 *
 * Hỗ trợ 2 kiểu cấu trúc Storage:
 *   A) Flat:   exams/<subject>/<exam-id>.pdf       → document_url = "<subject>/<exam-id>.pdf"
 *   B) Nested: exams/<subject>/<exam-id>/file.pdf  → document_url = "<subject>/<exam-id>/file.pdf"
 *
 * Usage:
 *   node scripts/sync-pdf-supabase.mjs              # Dry-run (chỉ xem, không ghi DB)
 *   node scripts/sync-pdf-supabase.mjs --apply       # Ghi thật vào DB
 *   node scripts/sync-pdf-supabase.mjs --apply --force  # Ghi đè cả những exam đã có document_url
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';

// ─── Load env ────────────────────────────────────────────────
dotenv.config({ path: resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Thiếu VITE_SUPABASE_URL hoặc SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY trong .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});

const BUCKET = 'exams';
const PDF_REGEX = /\.(pdf|PDF)$/;
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const FORCE = args.includes('--force');

// ─── Helpers ─────────────────────────────────────────────────
const log = (icon, msg) => console.log(`  ${icon}  ${msg}`);

/** List all items (files + folders) at a given path in the bucket */
async function listStorage(prefix) {
    const items = [];
    let offset = 0;
    const limit = 100;

    while (true) {
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .list(prefix, { limit, offset, sortBy: { column: 'name', order: 'asc' } });

        if (error) throw new Error(`Storage list error at "${prefix}": ${error.message}`);
        if (!data || data.length === 0) break;

        items.push(...data);
        if (data.length < limit) break;
        offset += limit;
    }

    return items;
}

/** Find PDF files in a folder (one level deep) */
async function findPdfsInFolder(folderPath) {
    const items = await listStorage(folderPath);
    return items
        .filter((item) => !item.id && item.name) // exclude sub-folders (they have no `id` in newer API? check both)
        .filter((item) => PDF_REGEX.test(item.name))
        .map((item) => `${folderPath}/${item.name}`.replace(/\/+/g, '/'));
}

// ─── Main ────────────────────────────────────────────────────
async function main() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║   📄  Sync PDF URLs → exam_keys.resources           ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log(`  Mode: ${APPLY ? (FORCE ? '⚡ APPLY + FORCE' : '✏️  APPLY') : '👀 DRY-RUN (thêm --apply để ghi DB)'}`);
    console.log('');

    // 1. Lấy danh sách exam_keys hiện có
    const { data: examRows, error: dbError } = await supabase
        .from('exam_keys')
        .select('exam_id, resources');

    if (dbError) {
        console.error('❌ Lỗi truy vấn exam_keys:', dbError.message);
        process.exit(1);
    }

    const examMap = new Map();
    for (const row of examRows) {
        examMap.set(row.exam_id, row);
    }
    log('📋', `Tìm thấy ${examMap.size} exam trong DB`);

    // 2. Quét Storage: liệt kê top-level folders (= subject folders)
    const topLevelItems = await listStorage('');
    // Supabase list('') returns both files and "folders" represented as { name, id: null }
    // Folders have id === null, files have a real id
    const subjectFolders = topLevelItems
        .filter((item) => item.id === null || (item.metadata === null && !PDF_REGEX.test(item.name)))
        .map((item) => item.name);

    if (subjectFolders.length === 0) {
        // Fallback: try to infer from existing data
        const subjects = [...new Set(examRows.map((r) => r.resources?.subject_folder).filter(Boolean))];
        subjectFolders.push(...subjects);
    }

    log('📁', `Subject folders trong Storage: [${subjectFolders.join(', ')}]`);
    console.log('');

    // 3. Duyệt từng subject folder
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalOrphaned = 0;

    for (const subject of subjectFolders) {
        console.log(`  ── 📂 ${subject}/ ──────────────────────────────`);

        const subjectItems = await listStorage(subject);

        // Tách files (PDF trực tiếp) và sub-folders
        const directPdfs = subjectItems
            .filter((item) => PDF_REGEX.test(item.name))
            .map((item) => ({
                storagePath: `${subject}/${item.name}`,
                fileName: item.name,
                // Suy ra exam_id từ tên file (bỏ đuôi .pdf)
                inferredExamId: item.name.replace(/\.(pdf|PDF)$/, ''),
            }));

        const subFolders = subjectItems
            .filter((item) => !PDF_REGEX.test(item.name) && !item.name.includes('.'));

        // 3a. Xử lý PDF flat (sinh/exam-id.pdf)
        for (const pdf of directPdfs) {
            await processPdfMatch(pdf.storagePath, pdf.inferredExamId, subject, examMap);
        }

        // 3b. Xử lý sub-folders (hoa/38-thpt-le-quy-don/file.pdf)
        for (const folder of subFolders) {
            const folderPath = `${subject}/${folder.name}`;
            const pdfsInFolder = await findPdfsInFolder(folderPath);

            if (pdfsInFolder.length === 0) {
                log('⚪', `${folderPath}/ → Không có PDF`);
                continue;
            }

            // Lấy PDF đầu tiên (hoặc lớn nhất nếu có nhiều)
            const pdfPath = pdfsInFolder[0];
            await processPdfMatch(pdfPath, folder.name, subject, examMap);
        }

        console.log('');
    }

    // Track results
    async function processPdfMatch(storagePath, candidateExamId, subject, examMap) {
        // Tìm exam_id match trong DB
        let matchedExamId = null;

        // Thử exact match trước
        if (examMap.has(candidateExamId)) {
            matchedExamId = candidateExamId;
        } else {
            // Thử tìm exam_id chứa candidate hoặc ngược lại
            for (const [examId] of examMap) {
                const examSubject = examMap.get(examId)?.resources?.subject_folder;
                if (examSubject && examSubject !== subject) continue;

                if (examId === candidateExamId ||
                    examId.includes(candidateExamId) ||
                    candidateExamId.includes(examId)) {
                    matchedExamId = examId;
                    break;
                }
            }
        }

        if (!matchedExamId) {
            log('🟡', `${storagePath} → Không tìm thấy exam_id khớp trong DB (candidate: "${candidateExamId}")`);
            totalOrphaned++;
            return;
        }

        const row = examMap.get(matchedExamId);
        const currentDocUrl = row?.resources?.document_url;

        if (currentDocUrl && !FORCE) {
            log('⏭️', `${matchedExamId} → Đã có document_url: "${currentDocUrl}" (skip, dùng --force để ghi đè)`);
            totalSkipped++;
            return;
        }

        const newDocUrl = storagePath;

        if (!APPLY) {
            log('👀', `${matchedExamId} → sẽ set document_url = "${newDocUrl}" [DRY-RUN]`);
            totalUpdated++;
            return;
        }

        // Ghi vào DB
        const updatedResources = {
            ...(row?.resources || {}),
            document_url: newDocUrl,
            subject_folder: subject,
        };

        const { error } = await supabase
            .from('exam_keys')
            .update({
                resources: updatedResources,
                last_synced_at: new Date().toISOString(),
            })
            .eq('exam_id', matchedExamId);

        if (error) {
            log('❌', `${matchedExamId} → Lỗi cập nhật DB: ${error.message}`);
        } else {
            log('✅', `${matchedExamId} → document_url = "${newDocUrl}"`);
            totalUpdated++;
        }
    }

    // 4. Summary
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log(`║  📊  Kết quả:                                       ║`);
    console.log(`║     ✅ Cập nhật: ${String(totalUpdated).padEnd(5)} exams                        ║`);
    console.log(`║     ⏭️  Bỏ qua:  ${String(totalSkipped).padEnd(5)} exams (đã có document_url)   ║`);
    console.log(`║     🟡 Orphan:  ${String(totalOrphaned).padEnd(5)} PDFs (không khớp exam_id)   ║`);
    console.log('╚══════════════════════════════════════════════════════╝');

    if (!APPLY && totalUpdated > 0) {
        console.log('');
        console.log('  💡 Chạy lại với --apply để ghi thật vào DB:');
        console.log('     node scripts/sync-pdf-supabase.mjs --apply');
    }
}

main().catch((err) => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});
