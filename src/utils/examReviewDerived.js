export function prettyJson(value) {
  if (value === null || value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function stripRawMarkupToText(rawMarkup) {
  const lines = String(rawMarkup || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => {
      let out = String(line || '');
      for (let i = 0; i < 12; i += 1) {
        const next = out
          .replace(/\[!(?:b|i|sup|sub):\$([\s\S]*?)\$\]/gi, '$1')
          .replace(/\[!(?:b|i|sup|sub):([^\]]*)\]/gi, '$1');
        if (next === out) break;
        out = next;
      }
      out = out.replace(/\[(?:!m|math):\$([\s\S]*?)\$\]/gi, '$1');
      out = out.replace(/\[img:\$([^$]+)\$\]/gi, (_match, imageId) => `[img:$${imageId}$]`);
      out = out.replace(/\[br\]/gi, '\n');
      return out
        .split('\n')
        .map((part) => part.replace(/[ \t]+/g, ' ').trim())
        .filter(Boolean)
        .join('\n');
    });
  return lines.filter(Boolean).join('\n');
}

export function buildDerivedExamPublicJson(reviewPayload) {
  const review = reviewPayload?.exam_review_package;
  if (!review || !Array.isArray(review.sections)) return null;
  return {
    document_type: 'exam',
    title: review?.meta?.title ?? null,
    meta: {
      organization: null,
      exam_name: review?.meta?.title ?? null,
      subject: review?.meta?.subject ?? null,
      duration_minutes: review?.meta?.duration_minutes ?? null,
      exam_code: null,
    },
    assets: (reviewPayload?.assets && typeof reviewPayload.assets === 'object')
      ? reviewPayload.assets
      : { images: {}, math: {} },
    solution_url: reviewPayload?.exam_solution_url || null,
    sections: review.sections.map((section, sectionIndex) => ({
      id: section?.section_id || `section_${sectionIndex + 1}`,
      title: section?.title || `PHẦN ${sectionIndex + 1}`,
      question_type: section?.question_type || 'unknown',
      questions: (section?.questions || []).map((question, questionIndex) => ({
        id: question?.question_id || `sec_${sectionIndex + 1}_q_${questionIndex + 1}`,
        no: Number(question?.no || questionIndex + 1),
        display_no: String(question?.no || questionIndex + 1),
        type: question?.type || 'unknown',
        stem_blocks: Array.isArray(question?.render_data?.stem_blocks) ? question.render_data.stem_blocks : [],
        options: Array.isArray(question?.render_data?.options) ? question.render_data.options : [],
        statements: Array.isArray(question?.render_data?.statements) ? question.render_data.statements : [],
        answer_slots: Array.isArray(question?.render_data?.answer_slots) ? question.render_data.answer_slots : [],
        table_blocks: Array.isArray(question?.render_data?.table_blocks) ? question.render_data.table_blocks : [],
        assets: Array.isArray(question?.render_data?.assets) ? question.render_data.assets : [],
        solution_url: reviewPayload?.question_solution_urls?.[question?.question_id] || null,
      })),
    })),
  };
}

export function buildDerivedExamPrivateJson(reviewPayload) {
  const review = reviewPayload?.exam_review_package;
  if (!review || !Array.isArray(review.sections)) return null;
  const questionKeys = [];
  for (const section of review.sections) {
    for (const question of section?.questions || []) {
      const keyState = question?.current_key_state || {};
      const qType = String(question?.type || '');
      const currentKey = keyState?.answer_key;
      questionKeys.push({
        question_id: question?.question_id || null,
        type: qType,
        answer_key:
          qType === 'short_answer'
            ? null
            : (currentKey ?? null),
        accepted_answers:
          qType === 'short_answer'
            ? (Array.isArray(currentKey?.accepted_answers) ? currentKey.accepted_answers : [])
            : null,
        normalization:
          qType === 'short_answer'
            ? (currentKey?.normalization || null)
            : null,
        scoring: { method: 'exact', points: 1 },
      });
    }
  }
  const rawMarkup = String(reviewPayload?.raw_markup || '');
  return {
    document_type: 'exam_private',
    question_keys: questionKeys,
    import_data: {
      raw_markup: rawMarkup,
      raw_text: String(reviewPayload?.raw_text || stripRawMarkupToText(rawMarkup)),
      assets: (reviewPayload?.assets && typeof reviewPayload.assets === 'object')
        ? reviewPayload.assets
        : { images: {}, math: {} },
      parser_notes: [],
      validation_hints: [],
    },
  };
}

export function buildDerivedValidationReport(reviewPayload) {
  const review = reviewPayload?.exam_review_package;
  if (!review || !Array.isArray(review.sections)) return null;
  const errors = [];
  const warnings = [];
  const issuesByQuestion = {};

  for (const section of review.sections) {
    for (const question of section?.questions || []) {
      const qid = question?.question_id;
      const qIssues = Array.isArray(question?.issues) ? question.issues : [];
      if (qIssues.length > 0) issuesByQuestion[qid] = qIssues;
      for (const issue of qIssues) {
        const normalized = {
          level: issue?.level || 'warning',
          code: issue?.code || 'unknown_issue',
          message: issue?.message || '',
          source: issue?.source || 'review',
          question_id: qid,
        };
        if (normalized.level === 'error') errors.push(normalized);
        else warnings.push(normalized);
      }
    }
  }

  return {
    status: errors.length > 0 ? 'error' : 'ok',
    stats: {
      section_count: Number(review?.summary?.section_count || 0),
      question_count: Number(review?.summary?.question_count || 0),
      image_count: Number(review?.summary?.image_count || 0),
      table_count: Number(review?.summary?.table_count || 0),
      math_count: Number(review?.summary?.math_count || 0),
    },
    errors,
    warnings,
    issues_by_question: issuesByQuestion,
  };
}

export function getImportedAssets(payload) {
  const candidate =
    (payload?.assets && typeof payload.assets === 'object' && payload.assets) ||
    (payload?.exam_private_json?.import_data?.assets && typeof payload.exam_private_json.import_data.assets === 'object' && payload.exam_private_json.import_data.assets) ||
    (payload?.exam_public_json?.assets && typeof payload.exam_public_json.assets === 'object' && payload.exam_public_json.assets) ||
    null;
  if (!candidate) return { images: {}, math: {} };
  return {
    images: (candidate.images && typeof candidate.images === 'object') ? candidate.images : {},
    math: (candidate.math && typeof candidate.math === 'object') ? candidate.math : {},
  };
}

export function getImportDebugInfo(payload) {
  const importDebug = (payload?.import_debug && typeof payload.import_debug === 'object')
    ? payload.import_debug
    : {};
  return {
    import_meta:
      (importDebug.import_meta && typeof importDebug.import_meta === 'object')
        ? importDebug.import_meta
        : (payload?.import_meta && typeof payload.import_meta === 'object' ? payload.import_meta : null),
    full_raw_markup:
      String(
        importDebug.full_raw_markup ||
        payload?.full_raw_markup ||
        payload?.raw_markup ||
        payload?.exam_private_json?.import_data?.raw_markup ||
        '',
      ),
    exam_public_json: importDebug.exam_public_json || payload?.exam_public_json || null,
    exam_private_json: importDebug.exam_private_json || payload?.exam_private_json || null,
    validation_report: importDebug.validation_report || payload?.validation_report || null,
  };
}

export function getImportedRawPayload(payload) {
  const rawMarkup = String(
    payload?.raw_markup ||
    payload?.full_raw_markup ||
    payload?.exam_private_json?.import_data?.raw_markup ||
    payload?.raw_text ||
    payload?.exam_private_json?.import_data?.raw_text ||
    '',
  ).trim();

  const rawText = String(
    payload?.raw_text ||
    payload?.exam_private_json?.import_data?.raw_text ||
    stripRawMarkupToText(rawMarkup) ||
    '',
  ).trim();

  return {
    rawMarkup,
    rawText,
    rawSource: rawMarkup || rawText,
  };
}

export function deriveReviewArtifacts(reviewPayload) {
  const renderAssets = getImportedAssets(reviewPayload);
  const importDebug = getImportDebugInfo(reviewPayload);
  const { rawMarkup, rawText } = getImportedRawPayload(reviewPayload);
  const examPublicJson = importDebug.exam_public_json || buildDerivedExamPublicJson(reviewPayload);
  const examPrivateJson = importDebug.exam_private_json || buildDerivedExamPrivateJson(reviewPayload);
  const validationReport = importDebug.validation_report || buildDerivedValidationReport(reviewPayload);

  return {
    renderAssets,
    importDebug,
    rawMarkup,
    rawText,
    rawLines: rawMarkup ? rawMarkup.split('\n') : [],
    examPublicJson,
    examPrivateJson,
    validationReport,
    importMetaText: prettyJson(importDebug.import_meta),
    validationJsonText: prettyJson(validationReport),
    publicJsonText: prettyJson(examPublicJson),
    privateJsonText: prettyJson(examPrivateJson),
  };
}
