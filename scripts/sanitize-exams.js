/**
 * sanitize-exams.js
 * Xóa ngay các trường nhạy cảm khỏi tất cả file exam.json tĩnh.
 * Không cần Supabase / Service Key.
 * Chạy: node scripts/sanitize-exams.js
 */
/* global process */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXAMS_ROOT = path.join(__dirname, '..', 'public', 'data', 'exams');

async function getAllExamJsonFiles() {
    const results = [];
    const subjects = await fs.readdir(EXAMS_ROOT);
    for (const subject of subjects) {
        const subjectPath = path.join(EXAMS_ROOT, subject);
        const stat = await fs.stat(subjectPath);
        if (!stat.isDirectory()) continue;
        const examFolders = await fs.readdir(subjectPath);
        for (const folder of examFolders) {
            const jsonPath = path.join(subjectPath, folder, 'exam.json');
            try {
                await fs.access(jsonPath);
                results.push(jsonPath);
            } catch {
                // no exam.json, skip
            }
        }
    }
    return results;
}

async function main() {
    const files = await getAllExamJsonFiles();
    console.log(`Found ${files.length} exam.json files to sanitize.\n`);

    for (const filePath of files) {
        const raw = await fs.readFile(filePath, 'utf-8');
        const exam = JSON.parse(raw);
        let changed = false;

        // Remove top-level sensitive fields
        if ('answer_key' in exam) { delete exam.answer_key; changed = true; }
        if ('resources' in exam) { delete exam.resources; changed = true; }

        // Remove correct answers inside questions
        for (const part of exam.parts || []) {
            for (const q of part.questions || []) {
                if ('correct_answer' in q) { delete q.correct_answer; changed = true; }
                for (const s of q.statements || []) {
                    if ('correct' in s) { delete s.correct; changed = true; }
                }
            }
        }

        if (changed) {
            await fs.writeFile(filePath, `${JSON.stringify(exam, null, 2)}\n`);
            console.log(`✓ Sanitized: ${path.relative(EXAMS_ROOT, filePath)}`);
        } else {
            console.log(`– Already clean: ${path.relative(EXAMS_ROOT, filePath)}`);
        }
    }

    console.log('\nDone! All sensitive data removed from static JSON files.');
}

main().catch(err => { console.error(err); process.exit(1); });
