import { buildAnswerKeyFromParts, loadExamJson, saveExamJson } from './exam-utils.js';

function printUsage() {
    console.log(`Usage:
  node scripts/sync-answer-key.js <subjectFolder> <examPath> [--dry-run]
`);
}

function parseArgs(argv) {
    const positionals = [];
    const flags = new Set();

    for (const arg of argv) {
        if (arg.startsWith('--')) {
            flags.add(arg.slice(2));
            continue;
        }

        positionals.push(arg);
    }

    return { positionals, flags };
}

async function main() {
    const { positionals, flags } = parseArgs(process.argv.slice(2));
    const [subjectFolder, examPath] = positionals;

    if (!subjectFolder || !examPath) {
        printUsage();
        process.exitCode = 1;
        return;
    }

    const { examJsonPath, exam } = await loadExamJson(subjectFolder, examPath);
    const nextAnswerKey = buildAnswerKeyFromParts(exam.parts, exam.answer_key || {});
    const hasChanges = JSON.stringify(nextAnswerKey) !== JSON.stringify(exam.answer_key || {});

    if (!flags.has('dry-run') && hasChanges) {
        exam.answer_key = nextAnswerKey;
        await saveExamJson(examJsonPath, exam);
    }

    const status = hasChanges ? (flags.has('dry-run') ? 'Would update' : 'Updated') : 'Already synced';
    console.log(`${status} answer_key in ${examJsonPath}`);
    console.log(`Total keys: ${Object.keys(nextAnswerKey).length}`);
}

main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
});
