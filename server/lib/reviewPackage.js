const BLOCKING_ERROR_CODES = new Set([
  'question_count_mismatch',
  'image_count_mismatch',
  'math_count_mismatch',
  'missing_stem_blocks',
  'broken_question_structure',
]);

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function toSnakeCase(value) {
  const input = String(value || '').trim();
  if (!input) return 'unknown_issue';
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'unknown_issue';
}

function normalizeQuestionType(type) {
  const t = String(type || '').trim().toLowerCase();
  if (!t) return 'unknown';
  if (t === 'true_false') return 'true_false_group';
  return t;
}

function normalizeIssue(level, issue, fallbackQuestionId = null) {
  if (typeof issue === 'string') {
    return {
      level,
      code: 'unknown_issue',
      message: issue,
      source: 'validator',
      question_id: fallbackQuestionId,
    };
  }

  const rawLevel = String(issue?.level || level || '').toLowerCase();
  const normalizedLevel = rawLevel === 'error' ? 'error' : 'warning';
  const message = String(issue?.message || issue?.detail || issue?.text || 'Unknown issue');
  const questionId = issue?.question_id || issue?.questionId || issue?.qid || fallbackQuestionId || null;
  const code = toSnakeCase(issue?.code || issue?.type || issue?.rule || 'unknown_issue');

  return {
    level: normalizedLevel,
    code,
    message,
    source: 'validator',
    question_id: questionId,
  };
}

function collectIssues(validationReport) {
  const byQuestion = new Map();
  const all = [];

  const pushIssue = (issue, explicitQuestionId = null) => {
    const normalized = normalizeIssue(issue.level || 'warning', issue, explicitQuestionId);
    all.push(normalized);
    if (normalized.question_id) {
      if (!byQuestion.has(normalized.question_id)) byQuestion.set(normalized.question_id, []);
      byQuestion.get(normalized.question_id).push({
        level: normalized.level,
        code: normalized.code,
        message: normalized.message,
        source: normalized.source,
      });
    }
  };

  const issueMaps = [
    validationReport?.issues_by_question,
    validationReport?.findings_by_qid,
  ];
  for (const mapValue of issueMaps) {
    if (!mapValue || typeof mapValue !== 'object') continue;
    for (const [questionId, list] of Object.entries(mapValue)) {
      for (const rawIssue of toArray(list)) {
        pushIssue(
          typeof rawIssue === 'object' && rawIssue
            ? { ...rawIssue, level: rawIssue.level || rawIssue.severity || 'warning' }
            : { level: 'warning', message: String(rawIssue || '') },
          questionId,
        );
      }
    }
  }

  for (const rawError of toArray(validationReport?.errors)) {
    pushIssue(
      typeof rawError === 'object' && rawError
        ? { ...rawError, level: 'error' }
        : { level: 'error', message: String(rawError || '') },
    );
  }
  for (const rawWarning of toArray(validationReport?.warnings)) {
    pushIssue(
      typeof rawWarning === 'object' && rawWarning
        ? { ...rawWarning, level: 'warning' }
        : { level: 'warning', message: String(rawWarning || '') },
    );
  }
  for (const rawIssue of toArray(validationReport?.issues)) {
    pushIssue(rawIssue);
  }

  const warningCount = all.filter((item) => item.level === 'warning').length;
  const errorCount = all.filter((item) => item.level === 'error').length;

  return { all, byQuestion, warningCount, errorCount };
}

function getSectionsFromPublic(examPublicJson) {
  if (Array.isArray(examPublicJson?.sections)) return examPublicJson.sections;
  if (Array.isArray(examPublicJson?.parts)) return examPublicJson.parts;
  return [];
}

function normalizeStemBlocks(question) {
  if (Array.isArray(question?.stem_blocks)) return question.stem_blocks;
  if (Array.isArray(question?.content)) return question.content;
  if (typeof question?.content === 'string') return [{ type: 'text', text: question.content }];
  if (typeof question?.stem === 'string') return [{ type: 'text', text: question.stem }];
  return [];
}

function normalizeContentBlocks(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return [{ type: 'text', text: value }];
  if (value && typeof value === 'object') {
    if (Array.isArray(value.content)) return value.content;
    if (Array.isArray(value.content_blocks)) return value.content_blocks;
    if (typeof value.text === 'string') return [{ type: 'text', text: value.text }];
  }
  return [];
}

function normalizeOptions(question) {
  if (Array.isArray(question?.options)) {
    return question.options.map((option, index) => {
      if (typeof option === 'string') {
        return {
          key: String.fromCharCode(65 + index),
          content: [{ type: 'text', text: option }],
        };
      }
      return {
        ...option,
        key: option?.key || option?.id || String.fromCharCode(65 + index),
        content: normalizeContentBlocks(option),
      };
    });
  }
  if (Array.isArray(question?.choices)) {
    return question.choices.map((choice, index) => {
      if (typeof choice === 'string') {
        return {
          key: String.fromCharCode(65 + index),
          content: [{ type: 'text', text: choice }],
        };
      }
      return {
        ...choice,
        key: choice?.key || choice?.id || String.fromCharCode(65 + index),
        content: normalizeContentBlocks(choice),
      };
    });
  }
  return [];
}

function normalizeStatements(question) {
  if (Array.isArray(question?.statements)) {
    return question.statements.map((statement, index) => ({
      ...statement,
      id: statement?.id || String.fromCharCode(97 + index),
      content: normalizeContentBlocks(statement),
    }));
  }
  return [];
}

function normalizeAnswerSlots(question, type) {
  if (Array.isArray(question?.answer_slots)) return question.answer_slots;
  if (type === 'short_answer') return [{}];
  return [];
}

function normalizeTableBlocks(question, stemBlocks) {
  if (Array.isArray(question?.table_blocks)) return question.table_blocks;
  return stemBlocks.filter((block) => block && typeof block === 'object' && (block.type === 'table' || block.table_row));
}

function collectAssetRefs(value, target) {
  if (typeof value === 'string') {
    const imageMatches = value.match(/\[img:\$([^$]+)\$\]/g) || [];
    const mathMatches = value.match(/\[!m:\$([^$]+)\$\]/g) || [];
    for (const token of imageMatches) {
      const match = token.match(/\[img:\$([^$]+)\$\]/);
      if (match?.[1]) target.add(`image:${match[1]}`);
    }
    for (const token of mathMatches) {
      const match = token.match(/\[!m:\$([^$]+)\$\]/);
      if (match?.[1]) target.add(`math:${match[1]}`);
    }
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) collectAssetRefs(item, target);
    return;
  }
  for (const nested of Object.values(value)) {
    collectAssetRefs(nested, target);
  }
}

function normalizeAssets(question, stemBlocks, options, statements, answerSlots, tableBlocks) {
  if (Array.isArray(question?.assets) && question.assets.length > 0) return question.assets;

  const refs = new Set();
  collectAssetRefs(stemBlocks, refs);
  collectAssetRefs(options, refs);
  collectAssetRefs(statements, refs);
  collectAssetRefs(answerSlots, refs);
  collectAssetRefs(tableBlocks, refs);

  return Array.from(refs).map((ref) => {
    const [kind, id] = ref.split(':');
    return { type: kind, id };
  });
}

function getTeacherActionsByType(type) {
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

function buildPrivateKeyLookup(examPrivateJson) {
  const map = new Map();

  const sourceKeys = examPrivateJson?.question_keys;
  if (Array.isArray(sourceKeys)) {
    for (const entry of sourceKeys) {
      if (!entry?.question_id) continue;
      map.set(entry.question_id, entry);
    }
  } else if (sourceKeys && typeof sourceKeys === 'object') {
    for (const [questionId, entry] of Object.entries(sourceKeys)) {
      if (!entry || typeof entry !== 'object') continue;
      map.set(questionId, { question_id: questionId, ...entry });
    }
  }

  const answerKeyMap = examPrivateJson?.answer_key;
  if (answerKeyMap && typeof answerKeyMap === 'object') {
    for (const [questionId, entry] of Object.entries(answerKeyMap)) {
      if (map.has(questionId)) continue;
      map.set(questionId, { question_id: questionId, answer_key: entry });
    }
  }

  return map;
}

function toOptionLabel(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String.fromCharCode(64 + Math.max(1, Math.min(26, value)));
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().toUpperCase();
    if (/^[A-Z]$/.test(trimmed)) return trimmed;
    if (/^\d+$/.test(trimmed)) return toOptionLabel(Number(trimmed));
  }
  return null;
}

function normalizeAcceptedAnswers(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|\||,\s+/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (value === null || value === undefined) return [];
  return [String(value)];
}

function resolveCurrentKeyState(type, questionId, privateLookup) {
  const entry = privateLookup.get(questionId) || null;
  if (!entry) {
    return { has_answer_key: false, answer_key: null };
  }

  if (type === 'single_choice') {
    const selected = toOptionLabel(
      entry?.answer_key?.selected_option ??
      entry?.selected_option ??
      entry?.answer_key,
    );
    if (!selected) return { has_answer_key: false, answer_key: null };
    return {
      has_answer_key: true,
      answer_key: { selected_option: selected },
    };
  }

  if (type === 'true_false_group') {
    const answerObject = entry?.answer_key && typeof entry.answer_key === 'object'
      ? entry.answer_key
      : (entry && typeof entry === 'object' && !Array.isArray(entry) ? entry.answer_key : null);
    if (!answerObject || typeof answerObject !== 'object' || Array.isArray(answerObject)) {
      return { has_answer_key: false, answer_key: null };
    }
    const normalized = {};
    for (const [k, v] of Object.entries(answerObject)) {
      if (v === true || v === false) normalized[k] = v;
    }
    if (Object.keys(normalized).length === 0) {
      return { has_answer_key: false, answer_key: null };
    }
    return { has_answer_key: true, answer_key: normalized };
  }

  if (type === 'short_answer') {
    const accepted = normalizeAcceptedAnswers(
      entry?.accepted_answers ??
      entry?.answer_key?.accepted_answers ??
      entry?.answer_key,
    );
    if (accepted.length === 0) return { has_answer_key: false, answer_key: null };
    return {
      has_answer_key: true,
      answer_key: {
        accepted_answers: accepted,
        normalization: entry?.normalization || null,
      },
    };
  }

  if (entry?.answer_key !== undefined && entry?.answer_key !== null) {
    return { has_answer_key: true, answer_key: entry.answer_key };
  }
  return { has_answer_key: false, answer_key: null };
}

function countRenderKinds(sections) {
  let imageCount = 0;
  let tableCount = 0;
  let mathCount = 0;
  for (const section of sections) {
    for (const question of toArray(section?.questions)) {
      const stemBlocks = normalizeStemBlocks(question);
      const tableBlocks = normalizeTableBlocks(question, stemBlocks);
      tableCount += tableBlocks.length;
      const assets = normalizeAssets(
        question,
        stemBlocks,
        normalizeOptions(question),
        normalizeStatements(question),
        normalizeAnswerSlots(question, normalizeQuestionType(question?.type)),
        tableBlocks,
      );
      for (const asset of assets) {
        const assetType = String(asset?.type || '').toLowerCase();
        if (assetType === 'image') imageCount += 1;
        if (assetType === 'math') mathCount += 1;
      }
    }
  }
  return { imageCount, tableCount, mathCount };
}

export function buildExamReviewPackage({ examPublicJson, examPrivateJson, validationReport }) {
  const sectionsSource = getSectionsFromPublic(examPublicJson);
  const privateLookup = buildPrivateKeyLookup(examPrivateJson);
  const issuesState = collectIssues(validationReport || {});

  const sections = [];
  const questionStates = [];

  sectionsSource.forEach((section, sectionIndex) => {
    const questionsSource = Array.isArray(section?.questions) ? section.questions : [];
    const sectionId = section?.id || `section_${sectionIndex + 1}`;
    const sectionTitle = section?.title || section?.name || `PHẦN ${sectionIndex + 1}`;
    const declaredSectionType = normalizeQuestionType(section?.question_type || section?.type);

    const questions = questionsSource.map((question, questionIndex) => {
      const questionId = question?.question_id || question?.id || `sec_${sectionIndex + 1}_q_${questionIndex + 1}`;
      const type = normalizeQuestionType(question?.type || declaredSectionType || 'unknown');
      const no = Number.isFinite(Number(question?.no)) ? Number(question.no) : (questionIndex + 1);

      const stemBlocks = normalizeStemBlocks(question);
      const options = normalizeOptions(question);
      const statements = normalizeStatements(question);
      const answerSlots = normalizeAnswerSlots(question, type);
      const tableBlocks = normalizeTableBlocks(question, stemBlocks);
      const assets = normalizeAssets(question, stemBlocks, options, statements, answerSlots, tableBlocks);
      const renderData = {
        stem_blocks: stemBlocks,
        options,
        statements,
        answer_slots: answerSlots,
        table_blocks: tableBlocks,
        assets,
      };

      const issues = issuesState.byQuestion.get(questionId) || [];
      const currentKeyState = resolveCurrentKeyState(type, questionId, privateLookup);

      let reviewStatus = 'ok';
      if (issues.some((item) => item.level === 'error')) reviewStatus = 'error';
      else if (issues.some((item) => item.level === 'warning')) reviewStatus = 'warning';
      else if (!currentKeyState.has_answer_key) reviewStatus = 'missing_key';

      const normalizedQuestion = {
        question_id: questionId,
        no,
        type,
        render_data: renderData,
        review_status: reviewStatus,
        issues,
        teacher_actions: getTeacherActionsByType(type),
        current_key_state: currentKeyState,
      };

      questionStates.push(normalizedQuestion);
      return normalizedQuestion;
    });

    sections.push({
      section_id: sectionId,
      title: sectionTitle,
      question_type: declaredSectionType || 'unknown',
      questions,
    });
  });

  const derivedCounts = {
    section_count: sections.length,
    question_count: questionStates.length,
    ...(() => {
      const renderCounts = countRenderKinds(sectionsSource);
      return {
        image_count: renderCounts.imageCount,
        table_count: renderCounts.tableCount,
        math_count: renderCounts.mathCount,
      };
    })(),
  };

  const reportStats = validationReport?.stats && typeof validationReport.stats === 'object'
    ? validationReport.stats
    : {};

  const summary = {
    section_count: Number(reportStats.section_count ?? derivedCounts.section_count) || 0,
    question_count: Number(reportStats.question_count ?? derivedCounts.question_count) || 0,
    image_count: Number(reportStats.image_count ?? derivedCounts.image_count) || 0,
    table_count: Number(reportStats.table_count ?? derivedCounts.table_count) || 0,
    math_count: Number(reportStats.math_count ?? derivedCounts.math_count) || 0,
    warning_count: issuesState.warningCount,
    error_count: issuesState.errorCount,
  };

  const requiredKeyTypes = new Set(['single_choice', 'true_false_group', 'short_answer']);
  const allRequiredAnswerKeysSet = questionStates
    .filter((question) => requiredKeyTypes.has(question.type))
    .every((question) => question.current_key_state.has_answer_key);

  const blockingErrors = issuesState.all
    .filter((issue) => issue.level === 'error' && BLOCKING_ERROR_CODES.has(issue.code))
    .map((issue) => ({
      level: issue.level,
      code: issue.code,
      message: issue.message,
      source: issue.source,
    }));

  const hasImageMappingError = issuesState.all.some((issue) => {
    if (issue.level !== 'error') return false;
    if (issue.code === 'image_count_mismatch') return true;
    return issue.code.includes('missing_image') || issue.code.includes('image_missing') || issue.code.includes('unmapped_image');
  });

  const allQuestionsPresent = !issuesState.all.some((issue) => (
    issue.level === 'error' &&
    (issue.code === 'question_count_mismatch' || issue.code === 'broken_question_structure')
  ));

  const publishChecks = {
    all_questions_present: allQuestionsPresent,
    all_required_images_mapped: !hasImageMappingError,
    all_required_answer_keys_set: allRequiredAnswerKeysSet,
    blocking_errors: blockingErrors,
  };

  const reviewFlags = {
    needs_manual_review: summary.warning_count > 0 || summary.error_count > 0,
    needs_answer_key_setup: !publishChecks.all_required_answer_keys_set,
    has_blocking_errors: publishChecks.blocking_errors.length > 0 || String(validationReport?.status || '').toLowerCase() === 'error',
  };

  const canPublish =
    publishChecks.blocking_errors.length === 0 &&
    publishChecks.all_questions_present === true &&
    publishChecks.all_required_answer_keys_set === true;

  return {
    exam_review_package: {
      meta: {
        title: examPublicJson?.title ?? null,
        subject: examPublicJson?.meta?.subject ?? null,
        duration_minutes: examPublicJson?.meta?.duration_minutes ?? null,
        status: 'draft_review',
        can_publish: canPublish,
      },
      summary,
      review_flags: reviewFlags,
      sections,
      publish_checks: publishChecks,
    },
  };
}
