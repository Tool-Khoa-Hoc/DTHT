/* global process */
import fs from 'fs/promises';
import path from 'path';

const EXAMS_DIR = path.join(process.cwd(), 'public', 'data', 'exams');
const OUTPUT_FILE = path.join(EXAMS_DIR, 'index.json');

async function collectExamDirectories(dirPath) {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    const hasExamJson = items.some((item) => item.isFile() && item.name === 'exam.json');

    if (hasExamJson) {
        return [dirPath];
    }

    const examDirectories = [];

    for (const item of items) {
        if (!item.isDirectory()) {
            continue;
        }

        const itemPath = path.join(dirPath, item.name);
        examDirectories.push(...await collectExamDirectories(itemPath));
    }

    return examDirectories;
}

function getQuestionCount(json) {
    if (!Array.isArray(json.parts)) {
        return 0;
    }

    return json.parts.reduce((sum, part) => sum + (part.questions?.length || 0), 0);
}

function getSubjectUiMeta(subject = '') {
    const subjectText = String(subject).toLowerCase();

    if (subjectText.includes('toán')) {
        return { icon: 'functions', color: 'from-blue-500 to-indigo-600' };
    }
    if (subjectText.includes('lý')) {
        return { icon: 'architecture', color: 'from-emerald-500 to-teal-600' };
    }
    if (subjectText.includes('anh')) {
        return { icon: 'language', color: 'from-rose-500 to-pink-600' };
    }
    if (subjectText.includes('hóa')) {
        return { icon: 'science', color: 'from-amber-500 to-orange-600' };
    }
    if (subjectText.includes('sinh')) {
        return { icon: 'biotech', color: 'from-green-500 to-lime-600' };
    }

    return { icon: 'quiz', color: 'from-slate-500 to-slate-600' };
}

async function buildIndex() {
    try {
        const indexData = [];
        const items = await fs.readdir(EXAMS_DIR, { withFileTypes: true });

        for (const item of items) {
            if (item.isDirectory()) {
                const subjectFolder = item.name;
                const subjectPath = path.join(EXAMS_DIR, subjectFolder);
                const examDirectories = await collectExamDirectories(subjectPath);

                for (const examFolderPath of examDirectories) {
                    try {
                        const examFilePath = path.join(examFolderPath, 'exam.json');
                        const fileContent = await fs.readFile(examFilePath, 'utf-8');
                        const json = JSON.parse(fileContent);
                        const relativeExamPath = path.relative(subjectPath, examFolderPath).split(path.sep).join('/');
                        const fallbackId = relativeExamPath.replace(/[\\/]+/g, '--') || subjectFolder;
                        const examId = json.route_id || json.id || fallbackId;
                        const uiMeta = getSubjectUiMeta(json.subject);

                        indexData.push({
                            id: examId,
                            title: json.title,
                            subject: json.subject,
                            subjectFolder,
                            examPath: relativeExamPath,
                            time: json.time,
                            questions: getQuestionCount(json),
                            participants: json.participants ?? Math.floor(Math.random() * 2000) + 100,
                            status: json.status || 'ongoing',
                            color: json.color || uiMeta.color,
                            icon: json.icon || uiMeta.icon
                        });
                    } catch {
                        // Skip invalid exam files so one bad file does not break the index build.
                    }
                }
            }
        }

        indexData.sort((a, b) => (
            a.subject.localeCompare(b.subject, 'vi') || a.title.localeCompare(b.title, 'vi')
        ));

        await fs.writeFile(OUTPUT_FILE, JSON.stringify(indexData, null, 2));
        console.log(`Successfully built exam index with ${indexData.length} exams.`);
    } catch (err) {
        console.error("Failed to build index:", err);
    }
}

buildIndex();
