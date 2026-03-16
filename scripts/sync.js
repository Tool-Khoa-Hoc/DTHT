/* global process */
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { EXAMS_ROOT, loadExamJson, saveExamJson, buildAnswerKeyFromParts } from './exam-utils.js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getAllExams() {
    const exams = [];
    const subjects = await fs.readdir(EXAMS_ROOT);
    
    for (const subject of subjects) {
        const subjectPath = path.join(EXAMS_ROOT, subject);
        const stats = await fs.stat(subjectPath);
        if (!stats.isDirectory()) continue;
        
        const examFolders = await fs.readdir(subjectPath);
        for (const examFolder of examFolders) {
            const examPath = path.join(subjectPath, examFolder);
            const examStats = await fs.stat(examPath);
            if (examStats.isDirectory()) {
                exams.push({ subject, examFolder });
            }
        }
    }
    return exams;
}

function sanitizeExam(exam) {
    // 1. Remove top-level answer_key and resources (sensitive)
    delete exam.answer_key;
    delete exam.resources;
    
    // 2. Remove correct answers from parts/questions
    if (exam.parts) {
        for (const part of exam.parts) {
            if (part.questions) {
                for (const q of part.questions) {
                    delete q.correct_answer;
                    if (q.statements) {
                        for (const s of q.statements) {
                            delete s.correct;
                        }
                    }
                }
            }
        }
    }
    return exam;
}

async function main() {
    const exams = await getAllExams();
    console.log(`Found ${exams.length} exams to check.`);

    for (const { subject, examFolder } of exams) {
        try {
            const examJsonPath = path.join(EXAMS_ROOT, subject, examFolder, 'exam.json');
            try {
                await fs.access(examJsonPath);
            } catch {
                console.log(`[${subject}/${examFolder}] exam.json not found, skipping.`);
                continue;
            }

            const raw = await fs.readFile(examJsonPath, 'utf-8');
            const exam = JSON.parse(raw);
            const examId = exam.id || examFolder;
            
            const answerKey = buildAnswerKeyFromParts(exam.parts, exam.answer_key || {});
            const resources = exam.resources || {};
            
            // Kiểm tra xem có dữ liệu thực tế không (tránh ghi đè null lên Database nếu file đã bị sanitize)
            const hasRealAnswers = Object.values(answerKey).some(v => v !== null && (typeof v !== 'object' || Object.values(v).some(sv => sv !== null)));
            const hasResources = Object.keys(resources).length > 0 && Object.values(resources).some(v => v !== null);

            if (!hasRealAnswers && !hasResources) {
                console.log(`[${examId}] No real answer key or resources found (possibly already sanitized), skipping sync.`);
                continue;
            }

            console.log(`[${examId}] Syncing to Supabase...`);
            
            const { error } = await supabase
                .from('exam_keys')
                .upsert({
                    exam_id: examId,
                    answer_key: answerKey,
                    resources: resources,
                    created_at: new Date().toISOString()
                });

            if (error) {
                console.error(`[${examId}] Supabase Error:`, error.message);
                continue;
            }

            console.log(`[${examId}] Sanitizing local JSON...`);
            const sanitized = sanitizeExam(exam);
            await fs.writeFile(examJsonPath, `${JSON.stringify(sanitized, null, 2)}\n`);
            
            console.log(`[${examId}] ✓ Done.`);
        } catch (err) {
            console.error(`Error processing ${subject}/${examFolder}:`, err.message);
        }
    }
}

main().catch(console.error);
