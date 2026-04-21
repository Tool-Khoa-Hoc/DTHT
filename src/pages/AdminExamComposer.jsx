import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import RichTextRenderer from '../components/exam/RichTextRenderer';
import {
  getExamReview,
  importExamDocx,
  patchExamSolution,
  patchQuestion,
  patchQuestionKey,
  publishExam,
  saveDraft,
  syncLocalDraft,
} from '../services/examReviewApi';
import {
  blocksToEditableText,
  buildAssetListFromContent,
  editableTextToBlocks,
  extractTableBlocksFromBlocks,
} from '../utils/examBlockText';
import { buildLocalReviewPayloadFromDocx, buildLocalReviewPayloadFromRawText } from '../utils/localImportFallback';
import {
  deriveReviewArtifacts,
  getImportDebugInfo as resolveImportDebugInfo,
  getImportedAssets as resolveImportedAssets,
  getImportedRawPayload as resolveImportedRawPayload,
} from '../utils/examReviewDerived';

const OPTION_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const KEY_REQUIRED_TYPES = new Set(['single_choice', 'true_false_group', 'short_answer']);
const LOCAL_BLOCKING_ERROR_CODES = new Set([
  'question_count_mismatch',
  'image_count_mismatch',
  'math_count_mismatch',
  'missing_stem_blocks',
  'broken_question_structure',
]);

function optionToText(option) {
  if (typeof option === 'string') return option;
  if (Array.isArray(option)) return blocksToEditableText(option);
  if (!option || typeof option !== 'object') return '';
  if (Array.isArray(option.content)) return blocksToEditableText(option.content);
  return String(option.text || option.label || '');
}

function statementToText(statement) {
  if (!statement || typeof statement !== 'object') return '';
  if (Array.isArray(statement.content)) return blocksToEditableText(statement.content);
  if (typeof statement.content === 'string') return statement.content;
  return '';
}

function normalizeAcceptedAnswersInput(value) {
  return String(value || '')
    .split(/\r?\n|\||,\s+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function statusBadgeClass(status) {
  if (status === 'ok') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'warning') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (status === 'missing_key') return 'bg-indigo-100 text-indigo-700 border-indigo-200';
  return 'bg-rose-100 text-rose-700 border-rose-200';
}

function hasQuestionKey(question) {
  const state = question?.current_key_state || {};
  if (state.has_answer_key === true) return true;
  const qType = String(question?.type || '');
  const key = state?.answer_key;
  if (qType === 'single_choice') return Boolean(key?.selected_option);
  if (qType === 'true_false_group') return key && typeof key === 'object' && Object.keys(key).length > 0;
  if (qType === 'short_answer') return Array.isArray(key?.accepted_answers) && key.accepted_answers.length > 0;
  return key !== null && key !== undefined;
}

function recomputeLocalReviewPayload(payload) {
  if (!payload?.exam_review_package) return payload;

  const next = structuredClone(payload);
  const pkg = next.exam_review_package;
  const sections = Array.isArray(pkg.sections) ? pkg.sections : [];
  let warningCount = 0;
  let errorCount = 0;
  let questionCount = 0;
  const blockingErrors = [];
  let allQuestionsPresent = true;
  let allRequiredAnswerKeysSet = true;

  for (const section of sections) {
    for (const question of Array.isArray(section?.questions) ? section.questions : []) {
      questionCount += 1;
      const issues = Array.isArray(question.issues) ? question.issues : [];
      const hasError = issues.some((item) => item?.level === 'error');
      const hasWarning = issues.some((item) => item?.level === 'warning');
      warningCount += issues.filter((item) => item?.level === 'warning').length;
      errorCount += issues.filter((item) => item?.level === 'error').length;

      for (const issue of issues) {
        if (issue?.level === 'error' && LOCAL_BLOCKING_ERROR_CODES.has(issue?.code)) {
          blockingErrors.push({
            level: 'error',
            code: issue.code,
            message: issue.message || 'Blocking error',
            source: issue.source || 'validator',
          });
        }
      }

      const keyOk = hasQuestionKey(question);
      question.current_key_state = {
        ...(question.current_key_state || {}),
        has_answer_key: keyOk,
        answer_key: question.current_key_state?.answer_key ?? null,
      };

      if (hasError) question.review_status = 'error';
      else if (hasWarning) question.review_status = 'warning';
      else if (!keyOk) question.review_status = 'missing_key';
      else question.review_status = 'ok';

      const qType = String(question?.type || '');
      if (KEY_REQUIRED_TYPES.has(qType) && !keyOk) {
        allRequiredAnswerKeysSet = false;
      }
    }
  }

  if (questionCount === 0) {
    allQuestionsPresent = false;
    allRequiredAnswerKeysSet = false;
  }

  pkg.summary = {
    ...(pkg.summary || {}),
    section_count: sections.length,
    question_count: questionCount,
    warning_count: warningCount,
    error_count: errorCount,
  };

  pkg.publish_checks = {
    ...(pkg.publish_checks || {}),
    all_questions_present: allQuestionsPresent,
    all_required_images_mapped: pkg.publish_checks?.all_required_images_mapped ?? true,
    all_required_answer_keys_set: allRequiredAnswerKeysSet,
    blocking_errors: blockingErrors,
  };

  const hasBlockingErrors = blockingErrors.length > 0;
  pkg.review_flags = {
    ...(pkg.review_flags || {}),
    needs_manual_review: warningCount > 0 || errorCount > 0,
    needs_answer_key_setup: !allRequiredAnswerKeysSet,
    has_blocking_errors: hasBlockingErrors,
  };

  pkg.meta = {
    ...(pkg.meta || {}),
    can_publish: !hasBlockingErrors && allQuestionsPresent && allRequiredAnswerKeysSet,
    status: 'draft_review',
  };

  return next;
}

function hasUsableReviewPackage(payload) {
  const sections = Array.isArray(payload?.exam_review_package?.sections)
    ? payload.exam_review_package.sections
    : [];
  return sections.some((section) => Array.isArray(section?.questions) && section.questions.length > 0);
}

async function hydrateImportedPayload(payload, titleHint = 'Imported Exam') {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload import không hợp lệ.');
  }

  if (hasUsableReviewPackage(payload)) {
    return {
      payload: {
        ...recomputeLocalReviewPayload(payload),
        import_debug: resolveImportDebugInfo(payload),
      },
      localMode: Boolean(payload?._local_mode),
      notice: '',
    };
  }

  const { rawMarkup, rawText, rawSource } = resolveImportedRawPayload(payload);
  if (!rawSource) {
    throw new Error('Backend import trả payload không có review package và cũng không có raw markup.');
  }

  const rebuilt = await buildLocalReviewPayloadFromRawText(
    rawSource,
    payload?.exam_review_package?.meta?.title ||
      payload?.exam_public_json?.title ||
      payload?.exam_id ||
      titleHint,
  );

  return {
    payload: recomputeLocalReviewPayload({
      ...rebuilt,
      exam_id: payload?.exam_id || rebuilt.exam_id,
      exam_status: payload?.exam_status || rebuilt.exam_status,
      exam_solution_url:
        payload?.exam_solution_url ??
        payload?.exam_public_json?.solution_url ??
        rebuilt.exam_solution_url,
      question_solution_urls:
        (payload?.question_solution_urls && typeof payload.question_solution_urls === 'object')
          ? payload.question_solution_urls
          : rebuilt.question_solution_urls,
      raw_markup: rawMarkup || rebuilt.raw_markup,
      raw_text: rawText || rebuilt.raw_text,
      assets: resolveImportedAssets(payload),
      import_debug: resolveImportDebugInfo(payload),
      _local_mode: true,
    }),
    localMode: true,
    notice: 'Payload import không theo schema review mới, đã parse lại local từ raw text. Hãy Save Draft để đồng bộ.',
  };
}

function PreviewQuestionCard({ question, assets }) {
  const typeLabel = question?.type === 'single_choice'
    ? 'Trắc nghiệm'
    : question?.type === 'true_false_group'
      ? 'Đúng / Sai'
      : 'Trả lời ngắn';

  return (
    <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
            Câu {question?.display_no || question?.no || '?'}.
          </span>
          <span className="text-sm text-slate-500">{typeLabel}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <RichTextRenderer content={question?.stem_blocks || []} assets={assets} />
      </div>

      {question?.type === 'single_choice' && (
        <div className="space-y-2">
          {(question?.options || []).map((option, index) => (
            <div key={option?.key || index} className="flex items-start gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white font-bold text-slate-700">
                {option?.key || OPTION_LABELS[index] || index + 1}
              </div>
              <div className="min-h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <RichTextRenderer content={option?.content || []} assets={assets} />
              </div>
            </div>
          ))}
        </div>
      )}

      {question?.type === 'true_false_group' && (
        <div className="space-y-2">
          {(question?.statements || []).map((statement, index) => (
            <div key={statement?.id || index} className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-semibold text-slate-600">
                {(statement?.id || String.fromCharCode(97 + index)).toLowerCase()}
              </div>
              <div className="min-w-0 flex-1">
                <RichTextRenderer content={statement?.content || []} assets={assets} />
              </div>
            </div>
          ))}
        </div>
      )}

      {question?.type === 'short_answer' && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-400">
          Ô trả lời ngắn
        </div>
      )}
    </article>
  );
}

function PreviewExamPane({ examPublicJson, assets }) {
  const sections = Array.isArray(examPublicJson?.sections) ? examPublicJson.sections : [];
  if (sections.length === 0) {
    return (
      <div className="h-full p-6">
        <div className="flex h-full items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white text-sm text-slate-500">
          Nhập file Word (.docx) để xem preview đề online.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_transparent_38%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-[32px] border border-slate-200 bg-white/90 px-6 py-5 shadow-lg shadow-slate-200/60 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Exam Preview</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">
            {examPublicJson?.title || examPublicJson?.meta?.exam_name || 'Imported exam'}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1">{sections.length} phần</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              {sections.reduce((total, section) => total + (section?.questions?.length || 0), 0)} câu
            </span>
          </div>
        </section>

        {sections.map((section, sectionIndex) => (
          <section key={section?.id || sectionIndex} className="space-y-4">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Section {sectionIndex + 1}</p>
                <h3 className="text-lg font-bold text-slate-900">{section?.title || `PHẦN ${sectionIndex + 1}`}</h3>
              </div>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
                {section?.questions?.length || 0} câu
              </span>
            </div>

            <div className="space-y-4">
              {(section?.questions || []).map((question) => (
                <PreviewQuestionCard key={question?.id || question?.question_id} question={question} assets={assets} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export default function AdminExamComposer() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const isAdmin = profile?.role === 'admin';

  const [examId, setExamId] = useState('');
  const [reviewPayload, setReviewPayload] = useState(null);
  const [activeTab, setActiveTab] = useState('review');
  const [loading, setLoading] = useState(false);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const [examSolutionUrl, setExamSolutionUrl] = useState('');
  const [questionForms, setQuestionForms] = useState({});
  const examIdFromQuery = searchParams.get('examId') || '';

  const examReviewPackage = reviewPayload?.exam_review_package || null;
  const sections = examReviewPackage?.sections || [];
  const derivedArtifacts = useMemo(() => deriveReviewArtifacts(reviewPayload), [reviewPayload]);

  const flatQuestions = useMemo(() => (
    sections.flatMap((section) =>
      (section.questions || []).map((question) => ({
        sectionId: section.section_id,
        sectionTitle: section.title,
        question,
      })))
  ), [sections]);

  useEffect(() => {
    setQuestionForms((prev) => {
      const next = {};
      for (const item of flatQuestions) {
        const question = item.question;
        const questionId = question.question_id;
        const options = (question.render_data?.options || []).map(optionToText);
        const statements = (question.render_data?.statements || []).map((statement, index) => ({
          id: statement?.id || String.fromCharCode(97 + index),
          text: statementToText(statement),
        }));
        const acceptedAnswers = question.current_key_state?.answer_key?.accepted_answers || [];
        const baseForm = {
          stem: blocksToEditableText(question.render_data?.stem_blocks || []),
          options,
          statements,
          shortAnswers: acceptedAnswers.join('\n'),
        };
        next[questionId] = prev[questionId]
          ? { ...baseForm, ...prev[questionId] }
          : baseForm;
      }
      return next;
    });
  }, [flatQuestions]);

  useEffect(() => {
    setExamSolutionUrl(reviewPayload?.exam_solution_url || '');
  }, [reviewPayload]);

  useEffect(() => {
    if (!examIdFromQuery) return;
    setExamId((prev) => prev || examIdFromQuery);
  }, [examIdFromQuery]);

  useEffect(() => {
    if (!isAdmin || !examIdFromQuery || reviewPayload || loading) return;

    let cancelled = false;
    setLoading(true);
    setError('');
    setNotice('');

    getExamReview(examIdFromQuery)
      .then((remote) => hydrateImportedPayload(
        remote,
        remote?.exam_review_package?.meta?.title || remote?.exam_id || 'Imported Exam',
      ))
      .then((hydrated) => {
        if (cancelled || !hydrated) return;
        setReviewPayload(hydrated.payload);
        setExamId(hydrated.payload?.exam_id || examIdFromQuery);
        setIsLocalMode(hydrated.localMode);
        setNotice(hydrated.notice || 'Đã tải draft đề online từ server.');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Không thể tải draft từ server.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [examIdFromQuery, isAdmin, loading, reviewPayload]);

  const withTask = async (fn, successMessage = '') => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const data = await fn();
      if (data) {
        setReviewPayload(data);
        setIsLocalMode(Boolean(data?._local_mode));
      }
      if (successMessage) setNotice(successMessage);
      return data;
    } catch (err) {
      setError(err?.message || 'Unexpected error.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateLocalPayload = (mutator, successMessage = 'Đã cập nhật bản local.') => {
    setReviewPayload((prev) => {
      if (!prev) return prev;
      const draft = structuredClone(prev);
      mutator(draft);
      return recomputeLocalReviewPayload(draft);
    });
    setNotice(successMessage);
    setError('');
  };

  const updateQuestionForm = (questionId, patch) => {
    setQuestionForms((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || { stem: '', options: [], statements: [], shortAnswers: '' }),
        ...patch,
      },
    }));
  };

  const syncLocalToServer = async () => {
    if (!reviewPayload?.exam_review_package) {
      throw new Error('Không có dữ liệu local để đồng bộ.');
    }
    const synced = await syncLocalDraft({
      exam_review_package: reviewPayload.exam_review_package,
      raw_markup: reviewPayload.raw_markup || '',
      raw_text: reviewPayload.raw_text || '',
      assets: reviewPayload.assets || { images: {}, math: {} },
      exam_solution_url: reviewPayload.exam_solution_url || null,
      question_solution_urls: reviewPayload.question_solution_urls || {},
    });
    setReviewPayload(synced);
    setExamId(synced.exam_id || '');
    setIsLocalMode(false);
    return synced;
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    setNotice('');

    try {
      const imported = await importExamDocx(file);
      const hydrated = await hydrateImportedPayload(imported, file.name || 'Imported Exam');
      setReviewPayload(hydrated.payload);
      setExamId(hydrated.payload?.exam_id || imported.exam_id || '');
      setIsLocalMode(hydrated.localMode);
      setNotice(hydrated.notice || 'Đã import qua backend bằng pipeline chuẩn.');
    } catch (err) {
      try {
        const localPayload = await buildLocalReviewPayloadFromDocx(file);
        setReviewPayload(recomputeLocalReviewPayload(localPayload));
        setExamId(localPayload.exam_id || '');
        setIsLocalMode(true);
        setNotice(`Backend import lỗi, đã fallback local parse. ${err?.message || ''}`.trim());
      } catch (fallbackErr) {
        setError(fallbackErr?.message || err?.message || 'Không thể parse DOCX.');
      }
    } finally {
      setLoading(false);
    }
    event.target.value = '';
  };

  const handleLoadReview = async () => {
    if (!examId.trim()) {
      setError('Nhập examId trước khi tải review.');
      return;
    }
    if (examId.startsWith('local-')) {
      setError('Draft local không có trên server. Upload lại hoặc chạy backend rồi import.');
      return;
    }
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const remote = await getExamReview(examId.trim());
      const hydrated = await hydrateImportedPayload(
        remote,
        remote?.exam_review_package?.meta?.title || remote?.exam_id || 'Imported Exam',
      );
      setReviewPayload(hydrated.payload);
      setExamId(hydrated.payload?.exam_id || remote.exam_id || examId.trim());
      setIsLocalMode(hydrated.localMode);
      setNotice(hydrated.notice || 'Đã tải trạng thái review mới nhất.');
    } catch (err) {
      setError(err?.message || 'Unexpected error.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!examId && !isLocalMode) return;
    await withTask(async () => {
      if (isLocalMode || String(examId).startsWith('local-')) {
        return syncLocalToServer();
      }
      return saveDraft(examId);
    }, isLocalMode ? 'Đã đồng bộ bản local lên server dưới dạng draft.' : 'Draft đã được lưu.');
  };

  const handlePublish = async () => {
    if (!examId && !isLocalMode) return;
    await withTask(async () => {
      let targetExamId = examId;
      if (isLocalMode || String(examId).startsWith('local-')) {
        const synced = await syncLocalToServer();
        targetExamId = synced.exam_id;
      }
      return publishExam(targetExamId);
    }, 'Publish thành công.');
  };

  const handleSaveQuestionContent = async (question) => {
    if (!examId || !question) return;
    const form = questionForms[question.question_id] || {
      stem: '',
      options: [],
      statements: [],
      shortAnswers: '',
    };
    const stemBlocks = editableTextToBlocks(form.stem);
    const options = (form.options || []).map((text, index) => ({
      key: OPTION_LABELS[index] || String(index + 1),
      content: editableTextToBlocks(text),
    }));
    const statements = (form.statements || []).map((statement) => ({
      id: statement.id,
      content: editableTextToBlocks(statement.text),
    }));
    const answerSlots = question.type === 'short_answer' ? [{ id: 'slot_1' }] : [];
    const tableBlocks = extractTableBlocksFromBlocks(stemBlocks);
    const assets = buildAssetListFromContent(stemBlocks, options, statements, answerSlots, tableBlocks);
    const payload = {
      type: question.type,
      stem_blocks: stemBlocks,
      options,
      statements,
      answer_slots: answerSlots,
      table_blocks: tableBlocks,
      assets,
    };
    if (isLocalMode || String(examId).startsWith('local-')) {
      updateLocalPayload((draft) => {
        const sectionsDraft = draft?.exam_review_package?.sections || [];
        for (const section of sectionsDraft) {
          const q = (section.questions || []).find((item) => item.question_id === question.question_id);
          if (!q) continue;
          q.type = payload.type;
          q.render_data = {
            ...(q.render_data || {}),
            stem_blocks: payload.stem_blocks,
            options: payload.options,
            statements: payload.statements,
            answer_slots: payload.answer_slots,
            table_blocks: payload.table_blocks,
            assets: payload.assets,
          };
          if (q.type === 'single_choice') {
            q.current_key_state = { has_answer_key: false, answer_key: null };
          } else if (q.type === 'true_false_group') {
            q.current_key_state = { has_answer_key: false, answer_key: {} };
          } else if (q.type === 'short_answer') {
            q.current_key_state = { has_answer_key: false, answer_key: { accepted_answers: [], normalization: { trim: true, lowercase: true } } };
          }
        }
      }, `Đã lưu nội dung local cho câu ${question.no}.`);
      return;
    }
    await withTask(
      async () => patchQuestion(examId, question.question_id, payload),
      `Đã lưu nội dung câu ${question.no}.`,
    );
  };

  const handleSetSingleChoiceKey = async (question, label) => {
    if (!examId || !question) return;
    if (isLocalMode || String(examId).startsWith('local-')) {
      updateLocalPayload((draft) => {
        for (const section of draft?.exam_review_package?.sections || []) {
          const q = (section.questions || []).find((item) => item.question_id === question.question_id);
          if (!q) continue;
          q.current_key_state = {
            has_answer_key: true,
            answer_key: { selected_option: label },
          };
        }
      }, `Đã chọn đáp án ${label} (local).`);
      return;
    }
    await withTask(
      async () => patchQuestionKey(examId, question.question_id, { answer_key: { selected_option: label } }),
      `Đã chọn đáp án ${label}.`,
    );
  };

  const handleSetTrueFalseKey = async (question, statementId, value) => {
    if (!examId || !question) return;
    const current = question.current_key_state?.answer_key || {};
    const answerKey = { ...current, [statementId]: value };
    if (isLocalMode || String(examId).startsWith('local-')) {
      updateLocalPayload((draft) => {
        for (const section of draft?.exam_review_package?.sections || []) {
          const q = (section.questions || []).find((item) => item.question_id === question.question_id);
          if (!q) continue;
          q.current_key_state = {
            has_answer_key: true,
            answer_key: answerKey,
          };
        }
      }, 'Đã cập nhật đáp án đúng/sai (local).');
      return;
    }
    await withTask(
      async () => patchQuestionKey(examId, question.question_id, { answer_key: answerKey }),
      'Đã cập nhật đáp án đúng/sai.',
    );
  };

  const handleSaveShortAnswerKey = async (question) => {
    if (!examId || !question) return;
    const form = questionForms[question.question_id] || { shortAnswers: '' };
    const accepted = normalizeAcceptedAnswersInput(form.shortAnswers);
    if (isLocalMode || String(examId).startsWith('local-')) {
      updateLocalPayload((draft) => {
        for (const section of draft?.exam_review_package?.sections || []) {
          const q = (section.questions || []).find((item) => item.question_id === question.question_id);
          if (!q) continue;
          q.current_key_state = {
            has_answer_key: accepted.length > 0,
            answer_key: {
              accepted_answers: accepted,
              normalization: { trim: true, lowercase: true },
            },
          };
        }
      }, 'Đã lưu accepted answers (local).');
      return;
    }
    await withTask(
      async () => patchQuestionKey(examId, question.question_id, { accepted_answers: accepted }),
      'Đã lưu accepted answers.',
    );
  };

  const handleSaveExamSolution = async () => {
    if (!examId) return;
    if (isLocalMode || String(examId).startsWith('local-')) {
      updateLocalPayload((draft) => {
        draft.exam_solution_url = examSolutionUrl || null;
      }, 'Đã cập nhật link bài giải toàn đề (local).');
      return;
    }
    await withTask(
      async () => patchExamSolution(examId, examSolutionUrl),
      'Đã cập nhật link bài giải toàn đề.',
    );
  };

  const copyRaw = async () => {
    const source = reviewPayload?.raw_markup || reviewPayload?.full_raw_markup || reviewPayload?.raw_text || '';
    if (!source) return;
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setError('Không thể copy vào clipboard.');
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-red-600 font-bold">
        Chỉ admin mới có quyền truy cập màn hình import/review.
      </div>
    );
  }

  const summary = examReviewPackage?.summary || {};
  const publishChecks = examReviewPackage?.publish_checks || {};
  const reviewMeta = examReviewPackage?.meta || {};
  const reviewFlags = examReviewPackage?.review_flags || {};
  const {
    renderAssets,
    rawMarkup,
    rawLines,
    importMetaText,
    validationJsonText,
    publicJsonText,
    privateJsonText,
    examPublicJson,
  } = derivedArtifacts;

  return (
    <div className="h-screen bg-slate-100 text-slate-900 flex flex-col overflow-hidden">
      <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-3 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-bold truncate">
            {reviewMeta.title || 'Import de tu Word + Review + Publish'}
          </h1>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
            <span className="font-mono">examId: {examId || '--'}</span>
            <span className={`px-2 py-0.5 rounded border text-[10px] uppercase tracking-wide ${reviewPayload?.exam_status === 'published' ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-amber-100 border-amber-200 text-amber-700'}`}>
              {reviewPayload?.exam_status || 'draft_review'}
            </span>
            <span>{reviewMeta.subject || 'Chua set mon'}</span>
            <span>{reviewMeta.duration_minutes ? `${reviewMeta.duration_minutes} phut` : 'Chua set thoi gian'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            value={examId}
            onChange={(event) => setExamId(event.target.value)}
            placeholder="Nhap examId de mo lai draft"
            className="w-64 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleLoadReview}
            disabled={loading || !examId}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
          >
            Validate
          </button>
          <label className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold cursor-pointer hover:bg-blue-700">
            Nhập đề từ Word
            <input type="file" accept=".docx" className="hidden" onChange={handleUpload} disabled={loading} />
          </label>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={loading || !examId}
            className="px-3 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 disabled:opacity-60"
          >
            Lưu draft online
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={loading || !examId || !reviewMeta.can_publish}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60"
          >
            Publish
          </button>
        </div>
      </header>

      {(notice || error) && (
        <div className={`shrink-0 px-5 py-2 text-sm border-b ${error ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
          {error || notice}
        </div>
      )}
      {isLocalMode && (
        <div className="shrink-0 px-5 py-2 text-xs border-b bg-amber-50 text-amber-800 border-amber-200">
          Local mode: bạn có thể chỉnh sửa thoải mái, hệ thống chỉ đồng bộ lên server khi bấm Lưu draft online hoặc Publish.
        </div>
      )}

      <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('review')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === 'review' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Review
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === 'preview' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Preview
          </button>
        </div>
      </div>

      {activeTab === 'review' ? (
      <div className="flex-1 overflow-hidden flex">
        <main className="flex-[1.7] min-w-0 overflow-y-auto border-r border-slate-200 bg-slate-100">
          <div className="p-5 space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="font-bold text-base">Review đề thi</h2>
                  <p className="text-xs text-slate-500">Cột trái là bản review đầy đủ của đề. Không còn tab chọn câu riêng.</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs min-w-[260px]">
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">Tổng section: <b>{summary.section_count ?? 0}</b></div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">Tổng câu: <b>{summary.question_count ?? 0}</b></div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">Warning: <b>{summary.warning_count ?? 0}</b></div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">Error: <b>{summary.error_count ?? 0}</b></div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 col-span-2">All key set: <b>{publishChecks.all_required_answer_keys_set ? 'Yes' : 'No'}</b> · Blocking: <b>{reviewFlags.has_blocking_errors ? 'Yes' : 'No'}</b></div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Solution URL (toàn đề)</label>
                <div className="flex gap-2">
                  <input
                    value={examSolutionUrl}
                    onChange={(event) => setExamSolutionUrl(event.target.value)}
                    placeholder="https://..."
                    className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveExamSolution}
                    disabled={loading || !examId}
                    className="px-3 py-2 rounded bg-slate-900 text-white text-xs font-semibold disabled:opacity-60"
                  >
                    Save
                  </button>
                </div>
              </div>
            </section>

            {flatQuestions.length === 0 ? (
              <div className="h-[240px] rounded-2xl border border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-500 text-sm">
                Nhập file Word để tạo draft và bắt đầu review.
              </div>
            ) : (
              sections.map((section) => (
                <section key={section.section_id} className="rounded-2xl border border-slate-200 bg-white">
                  <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                    <h2 className="font-bold text-sm uppercase tracking-wide">{section.title}</h2>
                  </div>

                  <div className="p-4 space-y-6">
                    {(section.questions || []).map((question) => {
                      const fallbackForm = {
      stem: blocksToEditableText(question.render_data?.stem_blocks || []),
                        options: (question.render_data?.options || []).map(optionToText),
                        statements: (question.render_data?.statements || []).map((statement, index) => ({
                          id: statement?.id || String.fromCharCode(97 + index),
                          text: statementToText(statement),
                        })),
                        shortAnswers: (question.current_key_state?.answer_key?.accepted_answers || []).join('\n'),
                      };
                      const form = questionForms[question.question_id] || fallbackForm;
                      const selectedLabel = question.current_key_state?.answer_key?.selected_option || null;

                      return (
                        <article
                          id={`q-${question.question_id}`}
                          key={question.question_id}
                          className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4"
                        >
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-base">
                              Câu {question.no} ({question.type})
                            </h3>
                            <span className={`px-2 py-0.5 rounded border text-xs ${statusBadgeClass(question.review_status)}`}>
                              {question.review_status}
                            </span>
                          </div>

                          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                            <RichTextRenderer content={question.render_data?.stem_blocks || []} assets={renderAssets} />
                          </div>

                          {question.type === 'single_choice' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {(question.render_data?.options || []).map((option, index) => {
                                const label = option?.key || OPTION_LABELS[index] || String(index + 1);
                                const active = selectedLabel === label;
                                return (
                                  <button
                                    key={label}
                                    type="button"
                                    onClick={() => handleSetSingleChoiceKey(question, label)}
                                    className={`text-left p-3 rounded-xl border ${active ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                                  >
                                    <div className="text-xs font-bold mb-1">{label}</div>
                                    <RichTextRenderer content={option?.content || []} assets={renderAssets} />
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {question.type === 'true_false_group' && (
                            <div className="space-y-2">
                              {(question.render_data?.statements || []).map((statement, index) => {
                                const statementId = statement?.id || form?.statements?.[index]?.id || String.fromCharCode(97 + index);
                                const currentValue = question.current_key_state?.answer_key?.[statementId];
                                return (
                                  <div key={statementId} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-white">
                                    <div className="min-w-0 text-sm">
                                      <span className="font-semibold mr-2">{statementId})</span>
                                      <RichTextRenderer content={statement?.content || []} assets={renderAssets} />
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleSetTrueFalseKey(question, statementId, true)}
                                        className={`px-3 py-1 rounded text-xs font-semibold border ${currentValue === true ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white border-slate-300'}`}
                                      >
                                        Dung
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSetTrueFalseKey(question, statementId, false)}
                                        className={`px-3 py-1 rounded text-xs font-semibold border ${currentValue === false ? 'bg-rose-600 text-white border-rose-700' : 'bg-white border-slate-300'}`}
                                      >
                                        Sai
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {question.type === 'short_answer' && (
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1">Accepted answers (moi dong mot dap an)</label>
                              <textarea
                                value={form.shortAnswers || ''}
                                onChange={(event) => updateQuestionForm(question.question_id, { shortAnswers: event.target.value })}
                                rows={4}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveShortAnswerKey(question)}
                                disabled={loading}
                                className="mt-2 px-3 py-2 rounded bg-slate-900 text-white text-xs font-semibold disabled:opacity-60"
                              >
                                Luu accepted answers
                              </button>
                            </div>
                          )}

                          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div>
                                <h4 className="font-bold text-sm">Chinh sua noi dung cau hoi</h4>
                                <p className="text-xs text-slate-500">Editor raw text và preview đặt cạnh nhau để so với kiểu review Azota.</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Stem raw text</label>
                                <textarea
                                  value={form.stem || ''}
                                  onChange={(event) => updateQuestionForm(question.question_id, { stem: event.target.value })}
                                  rows={8}
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Stem preview</label>
                                <div className="min-h-[176px] rounded-xl border border-slate-200 bg-slate-50 p-3">
                                  <RichTextRenderer content={editableTextToBlocks(form.stem || '')} assets={renderAssets} />
                                </div>
                              </div>
                            </div>

                            {question.type === 'single_choice' && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="block text-xs font-semibold text-slate-500">Options</label>
                                  <button
                                    type="button"
                                    onClick={() => updateQuestionForm(question.question_id, { options: [...(form.options || []), ''] })}
                                    className="text-xs px-2 py-1 rounded border border-slate-300"
                                  >
                                    + Option
                                  </button>
                                </div>
                                {(form.options || []).map((optionText, index) => (
                                  <div key={`opt-${question.question_id}-${index}`} className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                                    <textarea
                                      value={optionText}
                                      onChange={(event) => {
                                        const next = [...(form.options || [])];
                                        next[index] = event.target.value;
                                        updateQuestionForm(question.question_id, { options: next });
                                      }}
                                      rows={3}
                                      placeholder={`Option ${OPTION_LABELS[index] || index + 1}`}
                                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                      <div className="text-[11px] font-semibold text-slate-500 mb-2">Preview {OPTION_LABELS[index] || index + 1}</div>
                                      <RichTextRenderer content={editableTextToBlocks(optionText || '')} assets={renderAssets} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {question.type === 'true_false_group' && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="block text-xs font-semibold text-slate-500">Statements</label>
                                  <button
                                    type="button"
                                    onClick={() => updateQuestionForm(question.question_id, {
                                      statements: [...(form.statements || []), { id: String.fromCharCode(97 + (form.statements || []).length), text: '' }],
                                    })}
                                    className="text-xs px-2 py-1 rounded border border-slate-300"
                                  >
                                    + Statement
                                  </button>
                                </div>
                                {(form.statements || []).map((statement, index) => (
                                  <div key={`stmt-${question.question_id}-${statement.id}-${index}`} className="grid grid-cols-1 xl:grid-cols-[80px_minmax(0,1fr)_minmax(0,1fr)] gap-3 items-start">
                                    <input
                                      value={statement.id}
                                      onChange={(event) => {
                                        const next = [...(form.statements || [])];
                                        next[index] = { ...next[index], id: event.target.value.toLowerCase() };
                                        updateQuestionForm(question.question_id, { statements: next });
                                      }}
                                      className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm"
                                    />
                                    <textarea
                                      value={statement.text}
                                      onChange={(event) => {
                                        const next = [...(form.statements || [])];
                                        next[index] = { ...next[index], text: event.target.value };
                                        updateQuestionForm(question.question_id, { statements: next });
                                      }}
                                      rows={3}
                                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 min-h-[96px]">
                                      <div className="text-[11px] font-semibold text-slate-500 mb-2">Preview {statement.id}</div>
                                      <RichTextRenderer content={editableTextToBlocks(statement.text || '')} assets={renderAssets} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => handleSaveQuestionContent(question)}
                              disabled={loading}
                              className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                            >
                              Luu noi dung cau hoi
                            </button>
                          </div>

                        </article>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        </main>

        <aside className="flex-1 min-w-[360px] max-w-[45%] bg-[#111827] text-slate-100 flex flex-col overflow-hidden">
          <div className="shrink-0 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Raw text / markup + Import debug</h3>
              <p className="text-[11px] text-slate-400">Hiển thị raw, JSON convert và trạng thái bridge Python để đối chiếu.</p>
            </div>
            <button
              type="button"
              onClick={copyRaw}
              className="px-3 py-1.5 rounded border border-slate-600 text-xs hover:bg-slate-800"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs leading-6">
            <section className="rounded-xl border border-slate-700 overflow-hidden">
              <div className="px-3 py-2 bg-slate-900 border-b border-slate-700 text-[11px] uppercase tracking-wide text-slate-300">
                Raw text / markup
              </div>
              <div className="p-3">
                {rawLines.length === 0 ? (
                  <div className="text-slate-500">Chưa có dữ liệu raw.</div>
                ) : (
                  rawLines.map((line, index) => (
                    <div
                      key={`line-${index}`}
                      className="px-2 rounded whitespace-pre-wrap break-words"
                    >
                      {line || ' '}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-xl border border-slate-700 overflow-hidden">
              <div className="px-3 py-2 bg-slate-900 border-b border-slate-700 text-[11px] uppercase tracking-wide text-slate-300">
                Import meta
              </div>
              <pre className="p-3 whitespace-pre-wrap break-words text-slate-200">{importMetaText || 'null'}</pre>
            </section>

            <section className="rounded-xl border border-slate-700 overflow-hidden">
              <div className="px-3 py-2 bg-slate-900 border-b border-slate-700 text-[11px] uppercase tracking-wide text-slate-300">
                Validation JSON
              </div>
              <pre className="p-3 whitespace-pre-wrap break-words text-slate-200">{validationJsonText || 'null'}</pre>
            </section>

            <section className="rounded-xl border border-slate-700 overflow-hidden">
              <div className="px-3 py-2 bg-slate-900 border-b border-slate-700 text-[11px] uppercase tracking-wide text-slate-300">
                Exam Public JSON
              </div>
              <pre className="p-3 whitespace-pre-wrap break-words text-slate-200">{publicJsonText || 'null'}</pre>
            </section>

            <section className="rounded-xl border border-slate-700 overflow-hidden">
              <div className="px-3 py-2 bg-slate-900 border-b border-slate-700 text-[11px] uppercase tracking-wide text-slate-300">
                Exam Private JSON
              </div>
              <pre className="p-3 whitespace-pre-wrap break-words text-slate-200">{privateJsonText || 'null'}</pre>
            </section>
          </div>
        </aside>
      </div>
      ) : (
        <div className="flex-1 overflow-hidden flex bg-slate-100">
          <main className="min-w-0 flex-[1.55] overflow-hidden border-r border-slate-200 bg-slate-100">
            <PreviewExamPane examPublicJson={examPublicJson} assets={renderAssets} />
          </main>
          <aside className="flex min-w-[360px] max-w-[46%] flex-1 flex-col overflow-hidden bg-white">
            <div className="shrink-0 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-slate-900">Raw markup</h3>
                <p className="text-[11px] text-slate-500">
                  Nguồn chuẩn <code>word -&gt; raw_markup -&gt; json</code>, line-by-line để đối chiếu preview.
                </p>
              </div>
              <button
                type="button"
                onClick={copyRaw}
                className="px-3 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-white font-mono text-xs leading-6">
              {rawLines.length === 0 ? (
                <div className="p-6 text-slate-400">Chưa có dữ liệu raw markup.</div>
              ) : (
                rawLines.map((line, index) => (
                  <div key={`preview-raw-${index}`} className="grid grid-cols-[64px_minmax(0,1fr)] border-b border-slate-100">
                    <div className="select-none border-r border-slate-100 bg-slate-50 px-3 py-1 text-right text-slate-400">
                      {index + 1}
                    </div>
                    <div className="whitespace-pre-wrap break-words px-3 py-1 text-slate-700">
                      {line || ' '}
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
