import { parseDocx } from './docxParser';
import {
  buildAssetListFromContent,
  editableTextToBlocks,
  extractTableBlocksFromBlocks,
} from './examBlockText';
import { linesToExam } from './examStructure';
import { stripRawMarkupToText } from './examReviewDerived';
const OPTION_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function normalizeAssetBundle(input) {
  const images = (input && typeof input.images === 'object' && input.images) ? input.images : {};
  const math = (input && typeof input.math === 'object' && input.math) ? input.math : {};
  return { images, math };
}

function mapType(qtype, choices) {
  if (qtype === 'true_false' || qtype === 'true_false_group') return 'true_false_group';
  if (Array.isArray(choices) && choices.length >= 2) return 'single_choice';
  if (qtype === 'single_choice') return 'single_choice';
  if (qtype === 'short_answer') return 'short_answer';
  return 'short_answer';
}

function parseAnswerForType(questionType, rawAnswer, statementCount = 0) {
  const answer = String(rawAnswer || '').trim();
  if (!answer) return { has_answer_key: false, answer_key: null };

  if (questionType === 'single_choice') {
    const match = answer.match(/[A-H]/i);
    if (!match) return { has_answer_key: false, answer_key: null };
    return {
      has_answer_key: true,
      answer_key: { selected_option: match[0].toUpperCase() },
    };
  }

  if (questionType === 'true_false_group') {
    const normalized = answer
      .replace(/true/gi, 'D')
      .replace(/false/gi, 'S')
      .replace(/T/gi, 'D')
      .replace(/F/gi, 'S')
      .replace(/[^DSĐ]/gi, '')
      .toUpperCase();
    if (!normalized) return { has_answer_key: false, answer_key: null };
    const key = {};
    for (let i = 0; i < statementCount; i += 1) {
      const c = normalized[i];
      if (!c) break;
      key[String.fromCharCode(97 + i)] = c === 'D' || c === 'Đ';
    }
    if (Object.keys(key).length === 0) return { has_answer_key: false, answer_key: null };
    return { has_answer_key: true, answer_key: key };
  }

  const accepted = answer
    .split(/[,\n|]/g)
    .map((item) => item.trim())
    .filter(Boolean);
  if (accepted.length === 0) return { has_answer_key: false, answer_key: null };
  return {
    has_answer_key: true,
    answer_key: {
      accepted_answers: accepted,
      normalization: { trim: true, lowercase: true },
    },
  };
}

function teacherActionsByType(type) {
  if (type === 'single_choice') {
    return {
      can_edit_content: true,
      can_select_correct_option: true,
      can_edit_statements: false,
      can_edit_short_answer_keys: false,
    };
  }
  if (type === 'true_false_group') {
    return {
      can_edit_content: true,
      can_select_correct_option: false,
      can_edit_statements: true,
      can_edit_short_answer_keys: false,
    };
  }
  if (type === 'short_answer') {
    return {
      can_edit_content: true,
      can_select_correct_option: false,
      can_edit_statements: false,
      can_edit_short_answer_keys: true,
    };
  }
  return {
    can_edit_content: true,
    can_select_correct_option: false,
    can_edit_statements: false,
    can_edit_short_answer_keys: false,
  };
}

function normalizeRawLines(rawText) {
  return String(rawText || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => String(line || '').trim())
    .filter(Boolean);
}

function explodeForRetry(lines) {
  const output = [];
  for (const rawLine of lines || []) {
    const line = String(rawLine || '');
    if (/^\s*(?:\[\*.*\*\]|\|.*\|)\s*$/.test(line.trim())) {
      output.push(line.trim());
      continue;
    }
    const expanded = line
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/\s*\|\s*/g, '\n')
      .split('\n')
      .map((item) => String(item || '').trim())
      .filter(Boolean);
    output.push(...expanded);
  }
  return output;
}

function buildStructuredFromLines(lines, assetsInput = null) {
  const baseAssets = normalizeAssetBundle(assetsInput);
  let structured = linesToExam(lines, baseAssets);
  if ((structured?.questions?.length || 0) === 0) {
    const retryLines = explodeForRetry(lines);
    structured = linesToExam(retryLines, baseAssets);
  }
  return structured;
}

function buildLocalReviewPayloadFromLines(lines, titleHint, assetsInput = null) {
  const structured = buildStructuredFromLines(lines, assetsInput);
  const assets = normalizeAssetBundle(structured?.assets || assetsInput);
  const rawMarkup = lines.join('\n');
  const rawText = stripRawMarkupToText(rawMarkup);
  const examId = `local-${Date.now()}`;

  const groupedByPart = new Map();
  for (const q of structured.questions || []) {
    const partId = q.part_id || 'part1';
    if (!groupedByPart.has(partId)) groupedByPart.set(partId, []);
    groupedByPart.get(partId).push(q);
  }

  const sections = [];
  let warningCount = 0;
  let errorCount = 0;
  let totalQuestions = 0;
  let allRequiredAnswerKeysSet = true;

  let sectionIndex = 0;
  for (const [partId, questions] of groupedByPart.entries()) {
    sectionIndex += 1;
    const sectionId = `section_${sectionIndex}`;
    const first = questions[0] || {};
    const sectionTitle = first.section || `PHẦN ${sectionIndex}`;
    const sectionQuestions = [];

    for (const [qIndex, q] of questions.entries()) {
      totalQuestions += 1;
      const type = mapType(q.qtype, q.choices);
      const stemBlocks = editableTextToBlocks(q.stem || '');
      const tableBlocks = extractTableBlocksFromBlocks(stemBlocks);
      const options = type === 'single_choice'
        ? (q.choices || []).map((choice, idx) => ({
          key: choice?.label || OPTION_LABELS[idx] || String(idx + 1),
          content: editableTextToBlocks(choice?.content || ''),
        }))
        : [];

      const statements = type === 'true_false_group'
        ? (q.choices || []).map((choice, idx) => ({
          id: String(choice?.label || String.fromCharCode(97 + idx)).toLowerCase(),
          content: editableTextToBlocks(choice?.content || ''),
        }))
        : [];
      const answerSlots = type === 'short_answer' ? [{ id: 'slot_1' }] : [];
      const questionAssets = buildAssetListFromContent(
        stemBlocks,
        options,
        statements,
        answerSlots,
        tableBlocks,
      );

      const currentKeyState = parseAnswerForType(type, q.answer, statements.length);
      if (!currentKeyState.has_answer_key) allRequiredAnswerKeysSet = false;

      const issues = [];
      if (!q.stem || !String(q.stem).trim()) {
        issues.push({
          level: 'error',
          code: 'missing_stem_blocks',
          message: 'Question stem is empty.',
          source: 'validator',
        });
        errorCount += 1;
      }
      if (type === 'single_choice' && options.length < 2) {
        issues.push({
          level: 'warning',
          code: 'broken_question_structure',
          message: 'Single choice should have at least 2 options.',
          source: 'validator',
        });
        warningCount += 1;
      }

      let reviewStatus = 'ok';
      if (issues.some((item) => item.level === 'error')) reviewStatus = 'error';
      else if (issues.some((item) => item.level === 'warning')) reviewStatus = 'warning';
      else if (!currentKeyState.has_answer_key) reviewStatus = 'missing_key';

      sectionQuestions.push({
        question_id: q.qid || `sec_${sectionIndex}_q_${qIndex + 1}`,
        no: q.source_number || qIndex + 1,
        type,
        render_data: {
          stem_blocks: stemBlocks,
          options,
          statements,
          answer_slots: answerSlots,
          table_blocks: tableBlocks,
          assets: questionAssets,
        },
        review_status: reviewStatus,
        issues,
        teacher_actions: teacherActionsByType(type),
        current_key_state: currentKeyState,
      });
    }

    sections.push({
      section_id: sectionId,
      title: sectionTitle,
      question_type: mapType(first.qtype, first.choices),
      questions: sectionQuestions,
      _part_id: partId,
    });
  }

  const hasBlockingErrors = sections.some((section) =>
    (section.questions || []).some((q) => q.issues.some((issue) => issue.level === 'error')),
  );
  const imageCount = Object.keys(assets.images || {}).length;
  const mathCount = Object.keys(assets.math || {}).length;
  const tableCount = sections.reduce(
    (total, section) => total + (section.questions || []).reduce(
      (sectionTotal, question) => sectionTotal + (question.render_data?.table_blocks?.length || 0),
      0,
    ),
    0,
  );
  const canPublish = !hasBlockingErrors && allRequiredAnswerKeysSet && totalQuestions > 0;

  const questionSolutionUrls = {};
  for (const section of sections) {
    for (const question of section.questions || []) {
      questionSolutionUrls[question.question_id] = null;
    }
  }

  return {
    exam_id: examId,
    exam_status: 'draft_review',
    exam_solution_url: null,
    question_solution_urls: questionSolutionUrls,
    raw_markup: rawMarkup,
    raw_text: rawText,
    assets,
    _local_mode: true,
    import_debug: {
      import_meta: {
        engine: 'frontend_local_fallback',
      },
      full_raw_markup: rawMarkup,
      exam_public_json: null,
      exam_private_json: null,
      validation_report: null,
    },
    exam_review_package: {
      meta: {
        title: String(titleHint || 'Imported Exam').replace(/\.docx$/i, ''),
        subject: null,
        duration_minutes: null,
        status: 'draft_review',
        can_publish: canPublish,
      },
      summary: {
        section_count: sections.length,
        question_count: totalQuestions,
        image_count: imageCount,
        table_count: tableCount,
        math_count: mathCount,
        warning_count: warningCount,
        error_count: errorCount,
      },
      review_flags: {
        needs_manual_review: warningCount > 0 || errorCount > 0,
        needs_answer_key_setup: !allRequiredAnswerKeysSet,
        has_blocking_errors: hasBlockingErrors,
      },
      sections,
      publish_checks: {
        all_questions_present: totalQuestions > 0,
        all_required_images_mapped: true,
        all_required_answer_keys_set: allRequiredAnswerKeysSet,
        blocking_errors: [],
      },
    },
  };
}

export async function buildLocalReviewPayloadFromRawText(rawText, titleHint = 'Imported Exam') {
  const lines = normalizeRawLines(rawText);
  return buildLocalReviewPayloadFromLines(lines, titleHint, { images: {}, math: {} });
}

export async function buildLocalReviewPayloadFromDocx(file) {
  const { lines, assets } = await parseDocx(file);
  return buildLocalReviewPayloadFromLines(lines, file?.name || 'Imported Exam', assets);
}
