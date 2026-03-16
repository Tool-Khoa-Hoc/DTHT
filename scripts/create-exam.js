/* global process */
import fs from 'fs/promises';
import path from 'path';
import {
    DEFAULT_PART_DESCRIPTIONS,
    buildAnswerKeyFromParts,
    createDefaultExamResources,
    createShortAnswerQuestion,
    createSingleChoiceQuestion,
    createTrueFalseQuestion,
    ensureDirectory,
    inferSubjectLabel,
    resolveExamDir,
    resolveExamJsonPath,
    saveExamJson
} from './exam-utils.js';

function printUsage() {
    console.log(`Usage:
  node scripts/create-exam.js <subjectFolder> <examPath> [options]

Options:
  --title <text>         Exam title
  --subject <text>       Subject label shown in UI
  --description <text>   Exam description
  --time <minutes>       Duration in minutes (default: 50)
  --part1 <count>        Single-choice question count (default: 18)
  --part2 <count>        True/false question count (default: 4)
  --part3 <count>        Short-answer question count (default: 6)
  --force                Overwrite existing exam.json
`);
}

function parseArgs(argv) {
    const flags = {};
    const positionals = [];

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (!arg.startsWith('--')) {
            positionals.push(arg);
            continue;
        }

        const flagName = arg.slice(2);
        if (flagName === 'force') {
            flags.force = true;
            continue;
        }

        const nextValue = argv[index + 1];
        if (!nextValue || nextValue.startsWith('--')) {
            throw new Error(`Missing value for --${flagName}`);
        }

        flags[flagName] = nextValue;
        index += 1;
    }

    return { flags, positionals };
}

function toPositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function createPart(id, name, description, count, factory) {
    return {
        id,
        name,
        description,
        questions: Array.from({ length: count }, (_, index) => factory(index + 1))
    };
}

async function main() {
    const { flags, positionals } = parseArgs(process.argv.slice(2));
    const [subjectFolder, examPath] = positionals;

    if (!subjectFolder || !examPath) {
        printUsage();
        process.exitCode = 1;
        return;
    }

    const examDir = resolveExamDir(subjectFolder, examPath);
    const examJsonPath = resolveExamJsonPath(subjectFolder, examPath);

    const part1Count = toPositiveInteger(flags.part1, 18);
    const part2Count = toPositiveInteger(flags.part2, 4);
    const part3Count = toPositiveInteger(flags.part3, 6);
    const subjectLabel = flags.subject || inferSubjectLabel(subjectFolder);

    const parts = [
        createPart('part1', 'PHẦN I', DEFAULT_PART_DESCRIPTIONS.part1, part1Count, createSingleChoiceQuestion),
        createPart('part2', 'PHẦN II', DEFAULT_PART_DESCRIPTIONS.part2, part2Count, createTrueFalseQuestion),
        createPart('part3', 'PHẦN III', DEFAULT_PART_DESCRIPTIONS.part3, part3Count, createShortAnswerQuestion)
    ].filter((part) => part.questions.length > 0);

    const exam = {
        id: examPath,
        title: flags.title || `Đề thi ${subjectLabel} - ${examPath}`,
        subject: subjectLabel,
        time: toPositiveInteger(flags.time, 50),
        description: flags.description || '',
        resources: createDefaultExamResources(),
        answer_key: buildAnswerKeyFromParts(parts),
        parts
    };

    await ensureDirectory(examDir);

    if (!flags.force) {
        try {
            await fs.access(examJsonPath);
            throw new Error(`exam.json already exists at ${path.relative(process.cwd(), examJsonPath)}. Use --force to overwrite.`);
        } catch (error) {
            if (!String(error.message).includes('already exists')) {
                // File does not exist, continue.
            } else {
                throw error;
            }
        }
    }

    await saveExamJson(examJsonPath, exam);

    console.log(`Created ${path.relative(process.cwd(), examJsonPath)}`);
    console.log(`Parts: part1=${part1Count}, part2=${part2Count}, part3=${part3Count}`);
    console.log('Next: fill content/options, add images, then run sync-answer-key if question structure changes.');
}

main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
});
