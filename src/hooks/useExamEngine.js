import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
    getPublicExamResources,
    resolveCanonicalExamMeta,
} from '../utils/examIndexCache';
import { normalizeExamTimeMinutes } from '../utils/examTime';
import { getSecureDocumentUrl } from '../lib/uploadExamFile';

// ─── Constants ───────────────────────────────────────────────────────────────
const AUTOSAVE_DEBOUNCE_MS = 2000;
const AUTOSAVE_INTERVAL_MS = 30_000;

// ─── Exported helpers (used by ExamRightPanel / AnswerSheet2025) ─────────────

/**
 * Compose a flat answer-map key from (partId, questionId).
 * Keys are always strings of the form "part-1.1", "part-2.3", etc.
 */
export const getQuestionKey = (partId, questionId) => `${partId}.${questionId}`;

/**
 * Returns true when the user has supplied a meaningful answer for a question.
 * For true/false questions every statement sub-id must be answered.
 */
export const isQuestionAnswered = (question, value) => {
    if (question?.type === 'true_false') {
        const statementIds = question.statements?.map((s) => s.id) || [];
        return statementIds.length > 0 && statementIds.every((sid) => value?.[sid] !== undefined);
    }
    return value !== undefined && value !== '';
};

// ─── Internal: derive structured parts from a flat questionCount ──────────────
//
// AnswerSheet2025 still expects an `examData.parts` array that it can iterate.
// We build a canonical structure on-the-fly from questionCount so no exam.json
// is ever fetched.  The split mirrors the 2025 THPTQG format:
//   ≤10 questions  → single part (Part I, single-choice)
//   >10 questions  → Part I (single-choice) + Part II (true/false ×4) +
//                    Part III (short-answer ×6)
//
const buildPartsFromCount = (questionCount) => {
    const total = Math.max(1, Math.round(Number(questionCount) || 28));

    if (total <= 10) {
        return [
            {
                id: 'part-1',
                name: 'PHẦN I',
                type: 'multiple_choice',
                questions: Array.from({ length: total }, (_, i) => ({
                    id: `${i + 1}`,
                    type: 'single_choice',
                })),
            },
        ];
    }

    const trueFalseCount  = 4;
    const shortAnswerCount = 6;
    const singleChoiceCount = Math.max(0, total - trueFalseCount - shortAnswerCount);

    return [
        {
            id: 'part-1',
            name: 'PHẦN I',
            type: 'multiple_choice',
            questions: Array.from({ length: singleChoiceCount }, (_, i) => ({
                id: `${i + 1}`,
                type: 'single_choice',
            })),
        },
        {
            id: 'part-2',
            name: 'PHẦN II',
            type: 'true_false',
            questions: Array.from({ length: trueFalseCount }, (_, i) => ({
                id: `${i + 1}`,
                type: 'true_false',
                statements: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
            })),
        },
        {
            id: 'part-3',
            name: 'PHẦN III',
            type: 'short_answer',
            questions: Array.from({ length: shortAnswerCount }, (_, i) => ({
                id: `${i + 1}`,
                type: 'short_answer',
            })),
        },
    ];
};

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * useExamEngine — PDF-only, minimal architecture.
 *
 * Responsibilities:
 *  1. Load exam metadata from Supabase (resolveCanonicalExamMeta + getPublicExamResources).
 *  2. Resolve a signed document_url for the PDF viewer (SecurePdfViewer).
 *  3. Derive `examData` = { title, subject, time, documentUrl, questionCount, parts }
 *     entirely from metadata — no exam.json fetch, no media path normalisation.
 *  4. Restore / auto-save progress (localStorage + Supabase exam_progress table).
 *  5. Manage countdown timer, auto-submit on timeout.
 *  6. Expose submitExam that calls `submit_exam_securely` RPC with a flat answers map
 *     { "1": "A", "2": "C", "part-2.1": { a: true, b: false, … }, … }.
 */
export function useExamEngine(subjectFolder, examPath, user, allowed) {
    const navigate  = useNavigate();
    const userId    = user?.id || null;

    // ── State ────────────────────────────────────────────────────────────────
    const [examMeta,     setExamMeta]     = useState(null);
    const [examData,     setExamData]     = useState(null);   // derived, not fetched
    const [loading,      setLoading]      = useState(true);
    const [progressId,   setProgressId]   = useState(null);
    const [answers,      setAnswers]      = useState({});
    const [endTime,      setEndTime]      = useState(null);
    const [timeLeft,     setTimeLeft]     = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted,    setSubmitted]    = useState(false);

    // ── Refs (stable access inside callbacks / intervals) ────────────────────
    const answersRef         = useRef(answers);
    const timeLeftRef        = useRef(timeLeft);
    const progressIdRef      = useRef(progressId);
    const endTimeRef         = useRef(endTime);
    const examDataRef        = useRef(examData);
    const debounceTimerRef   = useRef(null);
    const autoSaveIntervalRef = useRef(null);
    const hasUnsavedChanges  = useRef(false);
    const autoSubmittedRef   = useRef(false);

    useEffect(() => { answersRef.current   = answers;   }, [answers]);
    useEffect(() => { timeLeftRef.current  = timeLeft;  }, [timeLeft]);
    useEffect(() => { progressIdRef.current = progressId; }, [progressId]);
    useEffect(() => { endTimeRef.current   = endTime;   }, [endTime]);
    useEffect(() => { examDataRef.current  = examData;  }, [examData]);

    // Derived stable identifiers
    const resolvedSubjectFolder = examMeta?.subjectFolder || subjectFolder;
    const normalizedExamPath    = examMeta?.examPath      || examPath;
    const examLookupId          = examMeta?.id            || normalizedExamPath || examPath;

    // ── Phase 1: Load canonical exam metadata ────────────────────────────────
    useEffect(() => {
        let cancelled = false;

        const loadMeta = async () => {
            const meta = await resolveCanonicalExamMeta(subjectFolder, examPath);
            if (!cancelled) setExamMeta(meta);
        };

        loadMeta();
        return () => { cancelled = true; };
    }, [subjectFolder, examPath]);

    // ── Phase 2: Derive examData + restore progress ──────────────────────────
    useEffect(() => {
        if (!examMeta || !allowed || !userId) return;

        let cancelled = false;

        const load = async () => {
            try {
                // Small delay to avoid race with auth token refresh.
                await new Promise((r) => setTimeout(r, 250));

                // Fetch cloud resources for document_url / questionCount override.
                let cloudResources = null;
                try {
                    cloudResources = await getPublicExamResources([
                        examLookupId,
                        normalizedExamPath,
                        examPath,
                    ]);
                } catch (err) {
                    console.warn('[useExamEngine] Could not fetch cloud resources.', err);
                }

                // ── Resolve document URL ─────────────────────────────────────
                let documentUrl =
                    cloudResources?.document_url  ||
                    cloudResources?.documentUrl   ||
                    examMeta?.documentUrl         ||
                    examMeta?.document_url         ||
                    '';

                // If it looks like a Supabase storage path (no scheme, no leading slash)
                // exchange it for a signed URL valid for 3 hours.
                if (documentUrl && !documentUrl.startsWith('http') && !documentUrl.startsWith('/')) {
                    try {
                        const signed = await getSecureDocumentUrl(documentUrl, 10_800);
                        if (signed) documentUrl = signed;
                    } catch (err) {
                        console.warn('[useExamEngine] Could not resolve signed URL.', err);
                    }
                }

                // ── Resolve questionCount & time ─────────────────────────────
                const questionCount = Math.max(1, parseInt(
                    cloudResources?.questions    ||
                    cloudResources?.question_count ||
                    examMeta?.questions          ||
                    examMeta?.question_count     ||
                    40,
                    10,
                ));

                const timeMinutes = normalizeExamTimeMinutes(
                    resolvedSubjectFolder,
                    cloudResources?.time      ||
                    cloudResources?.duration_minutes ||
                    examMeta?.time,
                    50,
                );

                // ── Build lean examData (no JSON content, only structure) ────
                const derivedExamData = {
                    title:         examMeta?.title || cloudResources?.title || examPath,
                    subject:       resolvedSubjectFolder,
                    time:          timeMinutes,
                    documentUrl,
                    document_url:  documentUrl,
                    questionCount,
                    parts:         buildPartsFromCount(questionCount),
                };

                if (cancelled) return;
                setExamData(derivedExamData);

                // ── Restore / create progress record ─────────────────────────
                const { data: progress } = await supabase
                    .from('exam_progress')
                    .select('id, answers, time_left_seconds, updated_at')
                    .eq('user_id', userId)
                    .eq('exam_id', examLookupId)
                    .eq('status', 'in_progress')
                    .maybeSingle();

                const localKey     = `exam_progress_${userId}_${examLookupId}`;
                let localProgress  = null;
                try {
                    const raw = localStorage.getItem(localKey);
                    if (raw) localProgress = JSON.parse(raw);
                } catch { /* ignore */ }

                let currentProgressId = null;
                let currentAnswers    = {};
                let currentTime       = timeMinutes * 60;

                if (progress) {
                    currentProgressId = progress.id;
                    currentAnswers    = progress.answers || {};
                    currentTime       = progress.time_left_seconds ?? currentTime;

                    // Prefer offline progress when it is more recent than cloud.
                    if (localProgress?.updated_at) {
                        const cloudMs = new Date(progress.updated_at || Date.now()).getTime();
                        if (localProgress.updated_at > cloudMs + 5_000) {
                            console.log('[useExamEngine] Recovered offline progress from localStorage.');
                            currentAnswers = { ...currentAnswers, ...(localProgress.answers || {}) };
                            currentTime    = localProgress.time_left_seconds ?? currentTime;
                        }
                    }
                } else {
                    // No cloud record — bootstrap from localStorage if available.
                    currentAnswers = Object.keys(localProgress?.answers || {}).length > 0
                        ? localProgress.answers
                        : {};
                    currentTime = localProgress?.time_left_seconds ?? currentTime;

                    const { data: newProgress } = await supabase
                        .from('exam_progress')
                        .insert({
                            user_id:        userId,
                            exam_id:        examLookupId,
                            subject_folder: resolvedSubjectFolder,
                            answers:        currentAnswers,
                            time_left_seconds: currentTime,
                            status:         'in_progress',
                        })
                        .select('id')
                        .single();

                    currentProgressId = newProgress?.id ?? null;
                }

                if (cancelled) return;

                setProgressId(currentProgressId);
                setAnswers(currentAnswers);
                setTimeLeft(currentTime);
                setEndTime(Date.now() + currentTime * 1_000);
            } catch (err) {
                if (cancelled) return;
                console.error('[useExamEngine] Load error:', err);
                alert('Không tìm thấy đề thi hoặc có lỗi tải dữ liệu!');
                navigate('/exam-room');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [
        allowed,
        examLookupId,
        examMeta,
        examPath,
        navigate,
        normalizedExamPath,
        resolvedSubjectFolder,
        userId,
    ]);

    // ── Save progress (localStorage + Supabase) ──────────────────────────────
    const saveProgress = useCallback(async () => {
        const currentProgressId = progressIdRef.current;
        if (!currentProgressId || !userId) return;

        const localKey = `exam_progress_${userId}_${examLookupId}`;
        try {
            localStorage.setItem(localKey, JSON.stringify({
                answers:           answersRef.current,
                time_left_seconds: timeLeftRef.current,
                updated_at:        Date.now(),
            }));
        } catch (err) {
            console.warn('[useExamEngine] localStorage save failed.', err);
        }

        try {
            await supabase
                .from('exam_progress')
                .update({
                    answers:           answersRef.current,
                    time_left_seconds: timeLeftRef.current,
                    updated_at:        new Date().toISOString(),
                })
                .eq('id', currentProgressId);
        } catch (err) {
            console.warn('[useExamEngine] Supabase sync failed — progress saved locally.', err);
        }

        hasUnsavedChanges.current = false;
    }, [userId, examLookupId]);

    // Periodic auto-save
    useEffect(() => {
        if (!progressId || submitted) return undefined;
        autoSaveIntervalRef.current = setInterval(saveProgress, AUTOSAVE_INTERVAL_MS);
        return () => clearInterval(autoSaveIntervalRef.current);
    }, [progressId, saveProgress, submitted]);

    // ── Submit exam ──────────────────────────────────────────────────────────
    const submitExam = useCallback(async () => {
        if (isSubmitting || submitted) return;
        setIsSubmitting(true);

        clearTimeout(debounceTimerRef.current);
        clearInterval(autoSaveIntervalRef.current);
        await saveProgress();

        try {
            const localKey = `exam_progress_${userId}_${examLookupId}`;
            try { localStorage.removeItem(localKey); } catch { /* ignore */ }

            // Flatten answers to ensure compatibility with answer key format (e.g. "part-1.1" -> "1")
            const currentAnswers = answersRef.current || {};
            const augmentedAnswers = { ...currentAnswers };
            
            if (examDataRef.current?.parts) {
                let absoluteIndex = 1;
                for (const part of examDataRef.current.parts) {
                    for (const q of (part.questions || [])) {
                        const rawKey = getQuestionKey(part.id, q.id);
                        if (currentAnswers.hasOwnProperty(rawKey)) {
                            augmentedAnswers[String(absoluteIndex)] = currentAnswers[rawKey];
                        }
                        absoluteIndex++;
                    }
                }
            }

            const { data: resultData, error: rpcError } = await supabase.rpc('submit_exam_securely', {
                p_exam_id:        examLookupId,
                p_subject_folder: resolvedSubjectFolder,
                p_exam_title:     examDataRef.current?.title || examMeta?.title,
                p_answers:        augmentedAnswers,
            });

            if (rpcError) throw rpcError;

            const { result_id, score, correct, total, is_scored, message } = resultData || {};
            const isScored = Boolean(is_scored);

            if (!isScored && message === 'pending_answer_key') {
                alert('Đề này chưa có đáp án trong hệ thống nên chưa thể chấm tự động. Bài làm của bạn đã được lưu.');
            }

            const resultPath = result_id
                ? `/exam/${resolvedSubjectFolder}/${normalizedExamPath}/result?resultId=${encodeURIComponent(result_id)}`
                : `/exam/${resolvedSubjectFolder}/${normalizedExamPath}/result`;

            setSubmitted(true);
            navigate(resultPath, {
                state: {
                    examData:      examDataRef.current,
                    answers:       answersRef.current,
                    score,
                    correct,
                    total,
                    isScored,
                    scoreMessage:  message || null,
                    resultId:      result_id,
                    examId:        examLookupId,
                    examPath:      normalizedExamPath,
                    subjectFolder: resolvedSubjectFolder,
                },
            });
        } catch (err) {
            console.error('[useExamEngine] Submit error:', err);
            alert(err.message || 'Có lỗi khi nộp bài. Vui lòng thử lại!');
        } finally {
            setIsSubmitting(false);
        }
    }, [
        examLookupId,
        examMeta?.title,
        isSubmitting,
        navigate,
        normalizedExamPath,
        resolvedSubjectFolder,
        saveProgress,
        submitted,
        userId,
    ]);

    // ── Countdown timer (1-second tick) ──────────────────────────────────────
    useEffect(() => {
        if (loading || submitted || autoSubmittedRef.current || !endTime) return undefined;

        const timer = setInterval(() => {
            const next = Math.max(0, Math.floor((endTime - Date.now()) / 1_000));
            setTimeLeft(next);
            timeLeftRef.current = next;

            if (next <= 0) {
                clearInterval(timer);
                if (!autoSubmittedRef.current) {
                    autoSubmittedRef.current = true;
                    setTimeout(() => {
                        alert('Hết giờ làm bài! Hệ thống tự động thu bài.');
                        submitExam();
                    }, 0);
                }
            }
        }, 1_000);

        return () => clearInterval(timer);
    }, [endTime, loading, submitExam, submitted]);

    // ── Save on tab hide / page hide ─────────────────────────────────────────
    useEffect(() => {
        const handler = () => {
            if (document.visibilityState === 'hidden' && !submitted) saveProgress();
        };

        document.addEventListener('visibilitychange', handler);
        window.addEventListener('pagehide', handler);

        return () => {
            if (!submitted) saveProgress();
            document.removeEventListener('visibilitychange', handler);
            window.removeEventListener('pagehide', handler);
        };
    }, [saveProgress, submitted]);

    // ── Warn before leaving ───────────────────────────────────────────────────
    useEffect(() => {
        if (submitted) return undefined;

        const handler = (e) => {
            e.preventDefault();
            e.returnValue = 'Bạn đang làm bài thi. Nếu rời đi, tiến trình sẽ được lưu lại để tiếp tục sau. Bạn có chắc muốn thoát?';
            return e.returnValue;
        };

        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [submitted]);

    // ── Answer change (debounced auto-save) ──────────────────────────────────
    const handleAnswerChange = useCallback((questionKey, value, subId = null) => {
        setAnswers((prev) => {
            const currentAnswer = prev[questionKey] || {};
            const next = subId
                ? { ...prev, [questionKey]: { ...currentAnswer, [subId]: value } }
                : { ...prev, [questionKey]: value };

            answersRef.current = next;
            return next;
        });

        hasUnsavedChanges.current = true;
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(saveProgress, AUTOSAVE_DEBOUNCE_MS);
    }, [saveProgress]);

    // ── Manual submit (with confirmation) ────────────────────────────────────
    const handleManualSubmit = useCallback(() => {
        const allQuestions = examData?.parts?.flatMap((part) =>
            part.questions.map((q) => ({ partId: part.id, question: q }))
        ) || [];

        const unanswered = allQuestions.filter(
            ({ partId, question }) => !isQuestionAnswered(question, answers[getQuestionKey(partId, question.id)])
        ).length;

        const msg = unanswered > 0
            ? `Bạn còn ${unanswered} câu chưa trả lời. Bạn có chắc muốn nộp bài không?`
            : 'Bạn có chắc chắn muốn nộp bài không?';

        if (window.confirm(msg)) submitExam();
    }, [answers, examData, submitExam]);

    // ── Public API ────────────────────────────────────────────────────────────
    return {
        examMeta,
        examLookupId,
        examData,       // { title, subject, time, documentUrl, questionCount, parts }
        loading,
        answers,
        timeLeft,
        isSubmitting,
        submitted,
        handleAnswerChange,
        handleManualSubmit,
    };
}
