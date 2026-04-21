/* global process */
import fs from 'fs/promises';
import path from 'path';

export const EXAMS_ROOT = path.join(process.cwd(), 'public', 'data', 'exams');

export const DEFAULT_PART_DESCRIPTIONS = {
    part1: 'Câu trắc nghiệm nhiều phương án lựa chọn. Mỗi câu hỏi chỉ chọn một phương án.',
    part2: 'Câu trắc nghiệm đúng sai. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.',
    part3: 'Câu trả lời ngắn. Thí sinh điền kết quả vào ô trả lời tương ứng.'
};

export const DEFAULT_EXAM_RESOURCES = {
    exam_file_url: null,
    answer_file_url: null,
    answer_file_name: null,
    video_url: null,
    edit_link: null
};

const SUBJECT_TIME_DEFAULTS = {
    toan: 90,
    math: 90,
    ly: 50,
    physics: 50,
    hoa: 50,
    chemistry: 50,
    sinh: 50,
    biology: 50,
};

export function resolveExamDir(subjectFolder, examPath) {
    return path.join(EXAMS_ROOT, subjectFolder, examPath);
}

export function resolveExamJsonPath(subjectFolder, examPath) {
    return path.join(resolveExamDir(subjectFolder, examPath), 'exam.json');
}

export function createDefaultExamResources() {
    return { ...DEFAULT_EXAM_RESOURCES };
}

export function normalizeSubjectFolder(value) {
    const normalized = String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    if (!normalized) return '';
    if (normalized.includes('toan') || normalized === 'math') return 'toan';
    if (normalized.includes('vat ly') || normalized === 'ly' || normalized === 'physics') return 'ly';
    if (normalized.includes('hoa') || normalized === 'chemistry') return 'hoa';
    if (normalized.includes('sinh') || normalized === 'biology') return 'sinh';
    return normalized;
}

export function getCanonicalExamTimeMinutes(subjectFolder) {
    const normalized = normalizeSubjectFolder(subjectFolder);
    if (!normalized) return null;
    return SUBJECT_TIME_DEFAULTS[normalized] ?? null;
}

export function normalizeExamTimeMinutes(subjectFolder, value, fallback = null) {
    const canonical = getCanonicalExamTimeMinutes(subjectFolder);
    if (canonical !== null) {
        return canonical;
    }

    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
        return Math.trunc(parsed);
    }

    const fallbackParsed = Number(fallback);
    if (Number.isFinite(fallbackParsed) && fallbackParsed >= 0) {
        return Math.trunc(fallbackParsed);
    }

    return null;
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
        const existingArray = Array.isArray(existingEntry) ? existingEntry : null;

        const normalizeBoolean = (value) => {
            if (value === true || value === false || value === null) return value;
            if (value === 1) return true;
            if (value === 0) return false;

            if (typeof value === 'string') {
                const normalized = value.trim().toLowerCase();

                if (!normalized || normalized === 'null') return null;
                if (['true', 't', '1', 'd', 'dung', 'yes', 'y'].includes(normalized)) return true;
                if (['false', 'f', '0', 's', 'sai', 'khong', 'no', 'n'].includes(normalized)) return false;
            }

            return undefined;
        };

        for (const [index, statement] of (question.statements || []).entries()) {
            const objectValue = Object.prototype.hasOwnProperty.call(existingObject, statement.id)
                ? normalizeBoolean(existingObject[statement.id])
                : undefined;
            const arrayValue = existingArray && index < existingArray.length
                ? normalizeBoolean(existingArray[index])
                : undefined;
            const statementValue = normalizeBoolean(statement.correct);

            if (objectValue !== undefined) {
                nextEntry[statement.id] = objectValue;
            } else if (arrayValue !== undefined) {
                nextEntry[statement.id] = arrayValue;
            } else if (statementValue !== undefined) {
                nextEntry[statement.id] = statementValue;
            } else {
                nextEntry[statement.id] = null;
            }
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

export function getDefaultShortAnswerPoints(subjectFolder) {
    const normalized = String(subjectFolder || '').trim().toLowerCase();
    return normalized === 'toan' || normalized === 'math' ? 0.5 : 0.25;
}

export function createShortAnswerQuestion(index, subjectFolder = '') {
    return {
        id: `q${index}`,
        type: 'short_answer',
        content: [''],
        correct_answer: null,
        points: getDefaultShortAnswerPoints(subjectFolder)
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
