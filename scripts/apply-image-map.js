import fs from 'fs/promises';
import path from 'path';
import { loadExamJson, saveExamJson } from './exam-utils.js';

const CONFIG_KEYS = new Set(['parts', 'imageStartAt', 'width', 'align', 'position', 'replace', 'dryRun']);

function printUsage() {
    console.log(`Usage:
  node scripts/apply-image-map.js <subjectFolder> <examPath> <mapFile> [--dry-run]

Map file formats:
  {
    "parts": {
      "part1": ["q1", "q4", "q8"],
      "part2": ["q1", "q3"],
      "part3": ["q1", "q2"]
    }
  }

  or shorthand:
  {
    "part1": ["q1", "q4", "q8"],
    "part2": ["q1", "q3"]
  }

Optional config:
  imageStartAt: 1
  width: 100
  align: "center"
  position: "end" | "start"
  replace: false
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

function normalizeTargets(config) {
    const partMappings = config.parts
        ? Object.entries(config.parts)
        : Object.entries(config).filter(([key]) => !CONFIG_KEYS.has(key));

    const imageStartAt = Number.parseInt(config.imageStartAt, 10) || 1;
    let imageCounter = imageStartAt;
    const targets = [];

    for (const [partId, entries] of partMappings) {
        for (const rawEntry of entries || []) {
            const entry = typeof rawEntry === 'string'
                ? { question: rawEntry }
                : rawEntry;

            const imageName = entry.image || `${imageCounter}.jpg`;
            imageCounter += 1;

            targets.push({
                partId,
                questionId: entry.id || entry.question,
                image: imageName,
                width: entry.width ?? config.width ?? 100,
                align: entry.align ?? config.align ?? 'center',
                position: entry.position ?? config.position ?? 'end',
                replace: entry.replace ?? config.replace ?? false
            });
        }
    }

    return targets;
}

function removeTopLevelImages(content) {
    if (!Array.isArray(content)) {
        return content;
    }

    return content.filter((block) => !(block && typeof block === 'object' && !Array.isArray(block) && block.image));
}

function applyImageToQuestion(question, target) {
    const imageBlock = {
        image: target.image,
        align: target.align,
        width: target.width
    };

    let nextContent;
    if (Array.isArray(question.content)) {
        nextContent = target.replace ? removeTopLevelImages(question.content) : [...question.content];
    } else if (question.content === undefined || question.content === null) {
        nextContent = [];
    } else {
        nextContent = [question.content];
    }

    if (!target.replace) {
        const alreadyHasImage = nextContent.some((block) => block && typeof block === 'object' && !Array.isArray(block) && block.image);
        if (alreadyHasImage) {
            return false;
        }
    }

    if (target.position === 'start') {
        nextContent.unshift(imageBlock);
    } else {
        nextContent.push(imageBlock);
    }

    question.content = nextContent;
    return true;
}

async function main() {
    const { positionals, flags } = parseArgs(process.argv.slice(2));
    const [subjectFolder, examPath, mapFile] = positionals;

    if (!subjectFolder || !examPath || !mapFile) {
        printUsage();
        process.exitCode = 1;
        return;
    }

    const mapFilePath = path.resolve(process.cwd(), mapFile);
    const config = JSON.parse(await fs.readFile(mapFilePath, 'utf-8'));
    const targets = normalizeTargets(config);
    const { examJsonPath, exam } = await loadExamJson(subjectFolder, examPath);

    let updatedCount = 0;
    const warnings = [];

    for (const target of targets) {
        const part = exam.parts?.find((item) => item.id === target.partId);
        if (!part) {
            warnings.push(`Missing part: ${target.partId}`);
            continue;
        }

        const question = part.questions?.find((item) => item.id === target.questionId);
        if (!question) {
            warnings.push(`Missing question: ${target.partId}.${target.questionId}`);
            continue;
        }

        const changed = applyImageToQuestion(question, target);
        if (changed) {
            updatedCount += 1;
        } else {
            warnings.push(`Skipped existing image: ${target.partId}.${target.questionId}`);
        }
    }

    if (!flags.has('dry-run')) {
        await saveExamJson(examJsonPath, exam);
    }

    console.log(`${flags.has('dry-run') ? 'Planned' : 'Applied'} image mapping for ${updatedCount} question(s).`);
    for (const warning of warnings) {
        console.warn(`- ${warning}`);
    }
}

main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
});
