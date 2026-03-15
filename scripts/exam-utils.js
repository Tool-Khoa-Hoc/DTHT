/* global process */
import fs from 'fs/promises';
import path from 'path';

export const EXAMS_ROOT = path.join(process.cwd(), 'public', 'data', 'exams');

export const DEFAULT_PART_DESCRIPTIONS = {
    part1: 'Câu trắc nghiệm nhiều phương án lựa chọn. Mỗi câu hỏi chỉ chọn một phương án.',
    part2: 'Câu trắc nghiệm đúng sai. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.',
    part3: 'Câu trả lời ngắn. Thí sinh điền kết quả vào ô trả lời tương ứng.'
};

export function resolveExamDir(subjectFolder, examPath) {
    return path.join(EXAMS_ROOT, subjectFolder, examPath);
}

export function resolveExamJsonPath(subjectFolder, examPath) {
    return path.join(resolveExamDir(subjectFolder, examPath), 'exam.json');
}

export async function loadExamJson(subjectFolder, examPath) {
    const examJsonPath = resolveExamJsonPath(subjectFolder, examPath);
    const raw = await fs.readFile(examJsonPath, 'utf-8');
    return { examJsonPath, exam: JSON.parse(raw) };
}

export async function saveExamJson(examJsonPath, exam) {
    await fs.writeFile(examJsonPath, `${JSON.stringify(exam, null, 2)}\n`);
}

export function getQuestionKey(partId, questionId) {
    return `${partId}.${questionId}`;
}

function buildAnswerEntry(question, existingEntry) {
    if (question.type === 'true_false') {
        const nextEntry = {};
        const existingObject = existingEntry && typeof existingEntry === 'object' && !Array.isArray(existingEntry)
            ? existingEntry
            : {};

        for (const statement of question.statements || []) {
            nextEntry[statement.id] = Object.prototype.hasOwnProperty.call(existingObject, statement.id)
                ? existingObject[statement.id]
                : (statement.correct ?? null);
        }

        return nextEntry;
    }

    if (existingEntry !== undefined) {
        return existingEntry;
    }

    if (question.correct_answer !== undefined) {
        return question.correct_answer;
    }

    return null;
}

export function buildAnswerKeyFromParts(parts, existingAnswerKey = {}) {
    const nextAnswerKey = {};

    for (const part of parts || []) {
        for (const question of part.questions || []) {
            const key = getQuestionKey(part.id, question.id);
            nextAnswerKey[key] = buildAnswerEntry(question, existingAnswerKey[key]);
        }
    }

    return nextAnswerKey;
}

export function createSingleChoiceQuestion(index) {
    return {
        id: `q${index}`,
        type: 'single_choice',
        content: [''],
        options: [[''], [''], [''], ['']],
        correct_answer: null,
        points: 0.25
    };
}

export function createTrueFalseQuestion(index) {
    const questionId = `q${index}`;

    return {
        id: questionId,
        type: 'true_false',
        content: [''],
        statements: ['a', 'b', 'c', 'd'].map((suffix) => ({
            id: `${questionId}${suffix}`,
            content: [''],
            correct: null
        })),
        points: [0.1, 0.25, 0.5, 1]
    };
}

export function createShortAnswerQuestion(index) {
    return {
        id: `q${index}`,
        type: 'short_answer',
        content: [''],
        correct_answer: null,
        points: 0.5
    };
}

export function inferSubjectLabel(subjectFolder) {
    const subjectMap = {
        toan: 'Toán học',
        ly: 'Vật lý',
        hoa: 'Hóa học',
        sinh: 'Sinh học',
        van: 'Ngữ văn',
        anh: 'Tiếng Anh'
    };

    return subjectMap[subjectFolder] || subjectFolder;
}

export async function ensureDirectory(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}
