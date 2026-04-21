import JSZip from 'jszip';
import { buildDraftViaPythonPipeline } from './pythonPipelineImport.js';

const SECTION_RE = /^\s*(?:PHẦN|Phần|PART)\s*([IVXLC\d]+)?\s*[\.\):\-]?\s*(.*)$/i;
const QUESTION_RE = /^\s*(?:Câu|Cau|Question|Q)?\s*(\d{1,4})\s*[\.\):\-]\s*(.*)$/i;
const NUMERIC_QUESTION_RE = /^\s*(\d{1,4})\s*[\.\)]\s+(.+)$/;
const OPTION_RE = /^\s*([A-Ha-h])\s*[\.\):\-]\s*(.*)$/;
const STATEMENT_RE = /^\s*([a-d])\s*[\.\):\-]\s*(.*)$/;
const ANSWER_RE = /^\s*(?:Đáp\s*án|Dap\s*an|Answer)\s*[:\-]\s*(.+)\s*$/i;

function decodeXmlEntities(input) {
  return String(input || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function safeTitleFromFilename(filename) {
  return String(filename || 'Imported Exam')
    .replace(/\.(docx|DOCX)$/g, '')
    .trim() || 'Imported Exam';
}

function inferSectionType(headerText) {
  const t = String(headerText || '').toLowerCase();
  if (/(đúng.*sai|dung.*sai|true.*false)/i.test(t)) return 'true_false_group';
  if (t.includes('trả lời ngắn') || t.includes('tra loi ngan') || t.includes('short answer') || t.includes('điền')) return 'short_answer';
  return 'single_choice';
}

function parseDocxLines(documentXml) {
  const lines = [];
  const paragraphRegex = /<w:p[\s\S]*?<\/w:p>/g;
  const paragraphs = documentXml.match(paragraphRegex) || [];

  for (const paragraphXml of paragraphs) {
    const prepared = paragraphXml
      .replace(/<w:tab\s*\/>/g, '\t')
      .replace(/<w:br[^>]*\/>/g, '\n');
    const textMatches = Array.from(prepared.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g));
    const text = textMatches.map((m) => decodeXmlEntities(m[1])).join('');
    const normalized = text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    if (normalized) lines.push(normalized);
  }

  return lines;
}

function normalizeTextBlock(value) {
  const text = String(value || '').trim();
  if (!text) return [];
  return [{ type: 'text', text }];
}

function extractInlineOptions(line) {
  const matches = Array.from(String(line || '').matchAll(/([A-Ha-h])\s*[\.\):]\s*([\s\S]*?)(?=\s+[A-Ha-h]\s*[\.\):]\s*|$)/g));
  if (matches.length < 2) return [];
  return matches
    .map((match) => ({
      key: match[1].toUpperCase(),
      text: String(match[2] || '').trim(),
    }))
    .filter((item) => item.text);
}

function extractInlineStatements(line) {
  const text = String(line || '');
  const marks = Array.from(text.matchAll(/([a-d])\s*[\.\):]\s*/g));
  if (marks.length < 2) return { prefix: '', statements: [] };

  const prefix = text.substring(0, marks[0].index).trim();
  const statements = [];
  for (let i = 0; i < marks.length; i += 1) {
    const mark = marks[i];
    const start = mark.index + mark[0].length;
    const end = (i + 1 < marks.length) ? marks[i + 1].index : text.length;
    const content = text.substring(start, end).trim();
    if (!content) continue;
    const expectedId = String.fromCharCode(97 + statements.length);
    if (mark[1] !== expectedId) return { prefix: '', statements: [] };
    statements.push({ id: mark[1], text: content });
  }
  if (statements.length < 2) return { prefix: '', statements: [] };
  return { prefix, statements };
}

function parseAnswerForQuestion(question, answerRaw) {
  const answerText = String(answerRaw || '').trim();
  if (!answerText) return { answer_key: null, accepted_answers: null, normalization: null };

  if (question.type === 'single_choice') {
    const match = answerText.match(/[A-H]/i);
    if (match) {
      return {
        answer_key: { selected_option: match[0].toUpperCase() },
        accepted_answers: null,
        normalization: null,
      };
    }
    return { answer_key: null, accepted_answers: null, normalization: null };
  }

  if (question.type === 'true_false_group') {
    const map = {};
    const explicitPairs = Array.from(answerText.matchAll(/([a-d])\s*[:=\-]?\s*(đ|d|t|true|s|f|false)/gi));
    for (const pair of explicitPairs) {
      const key = pair[1].toLowerCase();
      const value = String(pair[2]).toLowerCase();
      map[key] = value === 'đ' || value === 'd' || value === 't' || value === 'true';
    }
    if (Object.keys(map).length > 0) {
      return { answer_key: map, accepted_answers: null, normalization: null };
    }

    const compact = answerText
      .replace(/[^đdsfttruefals]/gi, '')
      .replace(/true/gi, 'd')
      .replace(/false/gi, 's')
      .replace(/t/gi, 'd')
      .replace(/f/gi, 's')
      .toLowerCase();

    const keys = question.statements.map((s) => s.id);
    if (keys.length > 0 && compact.length >= keys.length) {
      for (let i = 0; i < keys.length; i += 1) {
        const c = compact[i];
        if (c === 'đ' || c === 'd') map[keys[i]] = true;
        if (c === 's') map[keys[i]] = false;
      }
      if (Object.keys(map).length > 0) {
        return { answer_key: map, accepted_answers: null, normalization: null };
      }
    }
    return { answer_key: null, accepted_answers: null, normalization: null };
  }

  if (question.type === 'short_answer') {
    const acceptedAnswers = answerText
      .split(/[,\n|]/g)
      .map((item) => item.trim())
      .filter(Boolean);
    return {
      answer_key: null,
      accepted_answers: acceptedAnswers,
      normalization: { trim: true, lowercase: true },
    };
  }

  return { answer_key: null, accepted_answers: null, normalization: null };
}

function buildValidationReport(examPublicJson, examPrivateJson) {
  const sections = Array.isArray(examPublicJson?.sections) ? examPublicJson.sections : [];
  const questions = sections.flatMap((section) => Array.isArray(section?.questions) ? section.questions : []);
  const errors = [];
  const warnings = [];
  const issuesByQuestion = {};

  if (sections.length === 0 || questions.length === 0) {
    errors.push({
      code: 'broken_question_structure',
      message: 'No valid section/question parsed from DOCX.',
    });
  }

  for (const question of questions) {
    const questionId = question.id;
    const stemBlocks = Array.isArray(question.stem_blocks) ? question.stem_blocks : [];
    const hasStem = stemBlocks.some((block) => {
      if (typeof block === 'string') return block.trim().length > 0;
      if (!block || typeof block !== 'object') return false;
      const text = String(block.text || '').trim();
      return text.length > 0;
    });

    if (!hasStem) {
      const issue = {
        level: 'error',
        code: 'missing_stem_blocks',
        message: 'Question stem is empty.',
        question_id: questionId,
      };
      errors.push(issue);
      if (!issuesByQuestion[questionId]) issuesByQuestion[questionId] = [];
      issuesByQuestion[questionId].push(issue);
    }

    if (question.type === 'single_choice' && question.options.length < 2) {
      const issue = {
        level: 'warning',
        code: 'broken_question_structure',
        message: 'Single choice question should have at least 2 options.',
        question_id: questionId,
      };
      warnings.push(issue);
      if (!issuesByQuestion[questionId]) issuesByQuestion[questionId] = [];
      issuesByQuestion[questionId].push(issue);
    }

    if (question.type === 'true_false_group' && question.statements.length < 2) {
      const issue = {
        level: 'warning',
        code: 'broken_question_structure',
        message: 'True/false group should have at least 2 statements.',
        question_id: questionId,
      };
      warnings.push(issue);
      if (!issuesByQuestion[questionId]) issuesByQuestion[questionId] = [];
      issuesByQuestion[questionId].push(issue);
    }
  }

  const stats = {
    section_count: sections.length,
    question_count: questions.length,
    image_count: 0,
    table_count: questions.reduce((acc, q) => acc + (Array.isArray(q.table_blocks) ? q.table_blocks.length : 0), 0),
    math_count: 0,
  };

  const status = errors.length > 0 ? 'error' : 'ok';

  return {
    status,
    stats,
    errors,
    warnings,
    issues_by_question: issuesByQuestion,
    info: {
      private_keys_count: Array.isArray(examPrivateJson?.question_keys) ? examPrivateJson.question_keys.length : 0,
    },
  };
}

function buildExamJsonFromLines(lines, filename) {
  const sections = [];
  let sectionIndex = 0;
  let questionCounterBySection = new Map();
  let currentSection = null;
  let currentQuestion = null;
  let pendingAnswerRaw = null;

  const privateQuestionMap = new Map();

  const ensureSection = (headerLine = null) => {
    if (currentSection) return currentSection;
    sectionIndex += 1;
    const sectionId = `section_${sectionIndex}`;
    const section = {
      id: sectionId,
      title: headerLine || `PHẦN ${sectionIndex}`,
      question_type: inferSectionType(headerLine),
      questions: [],
    };
    sections.push(section);
    questionCounterBySection.set(sectionId, 0);
    currentSection = section;
    return currentSection;
  };

  const finalizeQuestion = () => {
    if (!currentQuestion || !currentSection) return;

    if (currentQuestion.statements.length >= 2) currentQuestion.type = 'true_false_group';
    else if (currentQuestion.options.length >= 2) currentQuestion.type = 'single_choice';
    else if (currentQuestion.type !== 'single_choice') currentQuestion.type = 'short_answer';
    else currentQuestion.type = 'short_answer';

    if (currentQuestion.type === 'short_answer' && currentQuestion.answer_slots.length === 0) {
      currentQuestion.answer_slots = [{ id: 'slot_1' }];
    }

    currentSection.questions.push(currentQuestion);

    const parsedAnswer = parseAnswerForQuestion(currentQuestion, pendingAnswerRaw);
    privateQuestionMap.set(currentQuestion.id, {
      question_id: currentQuestion.id,
      type: currentQuestion.type,
      answer_key: parsedAnswer.answer_key,
      accepted_answers: parsedAnswer.accepted_answers,
      normalization: parsedAnswer.normalization,
      scoring: {
        method: 'exact',
        points: 1,
      },
    });

    currentQuestion = null;
    pendingAnswerRaw = null;
  };

  for (const rawLine of lines) {
    const line = String(rawLine || '').trim();
    if (!line) continue;

    if (SECTION_RE.test(line)) {
      finalizeQuestion();
      sectionIndex += 1;
      const sectionId = `section_${sectionIndex}`;
      currentSection = {
        id: sectionId,
        title: line,
        question_type: inferSectionType(line),
        questions: [],
      };
      sections.push(currentSection);
      questionCounterBySection.set(sectionId, 0);
      continue;
    }

    const qMatch = QUESTION_RE.exec(line) || NUMERIC_QUESTION_RE.exec(line);
    if (qMatch) {
      finalizeQuestion();
      const section = ensureSection();
      const nextNo = (questionCounterBySection.get(section.id) || 0) + 1;
      questionCounterBySection.set(section.id, nextNo);

      const questionId = `sec_${sectionIndex}_q_${nextNo}`;
      const stemText = String(qMatch[2] || '').trim();
      currentQuestion = {
        id: questionId,
        no: Number(qMatch[1]) || nextNo,
        display_no: String(Number(qMatch[1]) || nextNo),
        type: section.question_type || 'single_choice',
        stem_blocks: normalizeTextBlock(stemText),
        options: [],
        statements: [],
        answer_slots: [],
        table_blocks: [],
        assets: [],
        solution_url: null,
      };
      if (currentQuestion.type === 'short_answer') currentQuestion.answer_slots = [{ id: 'slot_1' }];
      pendingAnswerRaw = null;
      continue;
    }

    if (!currentQuestion) continue;

    const answerMatch = ANSWER_RE.exec(line);
    if (answerMatch) {
      pendingAnswerRaw = answerMatch[1];
      continue;
    }

    const statementMatch = STATEMENT_RE.exec(line);
    if (statementMatch) {
      currentQuestion.type = 'true_false_group';
      currentQuestion.statements.push({
        id: statementMatch[1].toLowerCase(),
        content: normalizeTextBlock(statementMatch[2]),
      });
      continue;
    }

    const inlineStatements = extractInlineStatements(line);
    if (inlineStatements.statements.length >= 2) {
      currentQuestion.type = 'true_false_group';
      if (inlineStatements.prefix) {
        const previous = currentQuestion.stem_blocks?.[0]?.text || '';
        currentQuestion.stem_blocks = normalizeTextBlock(
          previous ? `${previous}\n${inlineStatements.prefix}` : inlineStatements.prefix,
        );
      }
      for (const statement of inlineStatements.statements) {
        currentQuestion.statements.push({
          id: statement.id,
          content: normalizeTextBlock(statement.text),
        });
      }
      continue;
    }

    const optionMatch = OPTION_RE.exec(line);
    if (optionMatch) {
      const inlineOptions = extractInlineOptions(line);
      if (inlineOptions.length > 0) {
        for (const option of inlineOptions) {
          currentQuestion.options.push({
            key: option.key,
            content: normalizeTextBlock(option.text),
          });
        }
      } else {
        currentQuestion.options.push({
          key: optionMatch[1].toUpperCase(),
          content: normalizeTextBlock(optionMatch[2]),
        });
      }
      continue;
    }

    const nextText = line.trim();
    if (nextText) {
      if (currentQuestion.stem_blocks.length === 0) {
        currentQuestion.stem_blocks = normalizeTextBlock(nextText);
      } else {
        const previous = currentQuestion.stem_blocks[0]?.text || '';
        currentQuestion.stem_blocks = normalizeTextBlock(`${previous}\n${nextText}`);
      }
    }
  }

  finalizeQuestion();

  const examPublicJson = {
    document_type: 'exam',
    title: safeTitleFromFilename(filename),
    meta: {
      organization: null,
      exam_name: safeTitleFromFilename(filename),
      subject: null,
      duration_minutes: null,
      exam_code: null,
    },
    assets: [],
    solution_url: null,
    sections,
  };

  const examPrivateJson = {
    document_type: 'exam_private',
    question_keys: Array.from(privateQuestionMap.values()),
    import_data: {
      raw_markup: lines.join('\n'),
      raw_text: lines.join('\n'),
      parser_notes: [],
      validation_hints: [],
    },
  };

  return { examPublicJson, examPrivateJson };
}

async function buildDraftFromDocxJsFallback(buffer, filename) {
  const zip = await JSZip.loadAsync(buffer);
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) {
    throw new Error('Invalid DOCX: word/document.xml not found.');
  }

  const documentXml = await docXmlFile.async('string');
  const lines = parseDocxLines(documentXml);
  const fullRawMarkup = lines.join('\n');

  const { examPublicJson, examPrivateJson } = buildExamJsonFromLines(lines, filename);
  const validationReport = buildValidationReport(examPublicJson, examPrivateJson);

  return {
    import_engine: 'legacy_js_fallback',
    full_raw_markup: fullRawMarkup,
    exam_public_json: examPublicJson,
    exam_private_json: examPrivateJson,
    validation_report: validationReport,
  };
}

export async function buildDraftFromDocx(buffer, filename) {
  try {
    return await buildDraftViaPythonPipeline(buffer, filename);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[docxImport] python pipeline unavailable, falling back to legacy JS parser:', error?.message || error);
    return buildDraftFromDocxJsFallback(buffer, filename);
  }
}
