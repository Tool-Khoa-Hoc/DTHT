import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
    applyCanonicalExamMetadata,
    getExamBundlePath,
    getPublicExamResources,
    resolveCanonicalExamMeta,
} from '../utils/examIndexCache';
import { normalizeExamPayloadTime } from '../utils/examTime';
import { resolveMediaPath } from '../utils/mediaPath';
import { getSecureDocumentUrl } from '../lib/uploadExamFile';

const AUTOSAVE_DEBOUNCE_MS = 2000;
const AUTOSAVE_INTERVAL_MS = 30000;

export const getQuestionKey = (partId, questionId) => `${partId}.${questionId}`;
const getExamBasePath = (subjectFolder, examPath) => `/data/exams/${subjectFolder}/${examPath}`;

const buildFallbackExamData = ({ title, subject, time, documentUrl, questionCount }) => {
    const totalQuestions = Math.max(1, parseInt(questionCount, 10) || 28);

    if (totalQuestions <= 10) {
        return {
            title,
            subject,
            time,
            document_url: documentUrl,
            parts: [
                {
                    id: 'part-1',
                    name: 'PHẦN I',
                    type: 'multiple_choice',
                    questions: Array.from({ length: totalQuestions }, (_, index) => ({
                        id: `${index + 1}`,
                        type: 'single_choice',
                    })),
                },
            ],
        };
    }

    const trueFalseCount = 4;
    const shortAnswerCount = 6;
    const singleChoiceCount = Math.max(0, totalQuestions - trueFalseCount - shortAnswerCount);

    return {
        title,
        subject,
        time,
        document_url: documentUrl,
        parts: [
            {
                id: 'part-1',
                name: 'PHẦN I',
                type: 'multiple_choice',
                questions: Array.from({ length: singleChoiceCount }, (_, index) => ({
                    id: `${index + 1}`,
                    type: 'single_choice',
                })),
            },
            {
                id: 'part-2',
                name: 'PHẦN II',
                type: 'true_false',
                questions: Array.from({ length: trueFalseCount }, (_, index) => ({
                    id: `${index + 1}`,
                    type: 'true_false',
                    statements: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
                })),
            },
            {
                id: 'part-3',
                name: 'PHẦN III',
                type: 'short_answer',
                questions: Array.from({ length: shortAnswerCount }, (_, index) => ({
                    id: `${index + 1}`,
                    type: 'short_answer',
                })),
            },
        ],
    };
};

const normalizeExamMediaPaths = (value, basePath) => {
    if (Array.isArray(value)) {
        return value.map((item) => normalizeExamMediaPaths(item, basePath));
    }

    if (!value || typeof value !== 'object') {
        return value;
    }

    const next = { ...value };

    if (typeof next.image === 'string') {
        next.image = resolveMediaPath(next.image, basePath);
    }

    if (typeof next.src === 'string') {
        next.src = resolveMediaPath(next.src, basePath);
    }

    for (const key of Object.keys(next)) {
        if (key === 'image' || key === 'src') continue;
        next[key] = normalizeExamMediaPaths(next[key], basePath);
    }

    return next;
};

const sanitizeQuestionPayloadForTaking = (question) => {
    if (!question || typeof question !== 'object') {
        return question;
    }

    const nextQuestion = { ...question };
    delete nextQuestion.answer_key;
    delete nextQuestion.answerKey;
    delete nextQuestion.correct_answer;
    delete nextQuestion.correctAnswer;
    delete nextQuestion.correct;
    delete nextQuestion.answer;
    delete nextQuestion.expected;
    delete nextQuestion.expected_answer;
    delete nextQuestion.expectedAnswer;

    if (Array.isArray(nextQuestion.options)) {
        nextQuestion.options = nextQuestion.options.map((option) => {
            if (Array.isArray(option)) return option;
            if (!option || typeof option !== 'object') return option;

            const nextOption = { ...option };
            delete nextOption.answer;
            delete nextOption.correct;
            delete nextOption.is_correct;
            delete nextOption.isCorrect;
            return nextOption;
        });
    }

    if (Array.isArray(nextQuestion.statements)) {
        nextQuestion.statements = nextQuestion.statements.map((statement) => {
            if (!statement || typeof statement !== 'object') return statement;

            const nextStatement = { ...statement };
            delete nextStatement.answer;
            delete nextStatement.correct;
            delete nextStatement.is_correct;
            delete nextStatement.isCorrect;
            delete nextStatement.correct_answer;
            delete nextStatement.correctAnswer;
            delete nextStatement.expected;
            return nextStatement;
        });
    }

    return nextQuestion;
};

const sanitizeExamPayloadForTaking = (rawExamData) => {
    if (!rawExamData || typeof rawExamData !== 'object') {
        return rawExamData;
    }

    const sanitizedExamData = { ...rawExamData };
    delete sanitizedExamData.answer_key;
    delete sanitizedExamData.answerKey;

    if (Array.isArray(sanitizedExamData.parts)) {
        sanitizedExamData.parts = sanitizedExamData.parts.map((part) => {
            if (!part || typeof part !== 'object') return part;

            const nextPart = { ...part };
            if (Array.isArray(nextPart.questions)) {
                nextPart.questions = nextPart.questions.map(sanitizeQuestionPayloadForTaking);
            }
            return nextPart;
        });
    }

    return sanitizedExamData;
};

export const isQuestionAnswered = (question, value) => {
    if (question.type === 'true_false') {
        const statementIds = question.statements?.map((statement) => statement.id) || [];
        return statementIds.length > 0 && statementIds.every((statementId) => value?.[statementId] !== undefined);
    }

    return value !== undefined && value !== '';
};

export function useExamEngine(subjectFolder, examPath, user, allowed) {
    const navigate = useNavigate();
    const userId = user?.id || null;

    const [examMeta, setExamMeta] = useState(null);
    const [examData, setExamData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [progressId, setProgressId] = useState(null);
    const [answers, setAnswers] = useState({});
    const [endTime, setEndTime] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const answersRef = useRef(answers);
    const timeLeftRef = useRef(timeLeft);
    const progressIdRef = useRef(progressId);
    const endTimeRef = useRef(endTime);
    const examDataRef = useRef(examData);
    const debounceTimerRef = useRef(null);
    const autoSaveIntervalRef = useRef(null);
    const hasUnsavedChanges = useRef(false);
    const autoSubmittedRef = useRef(false);

    useEffect(() => { answersRef.current = answers; }, [answers]);
    useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);
    useEffect(() => { progressIdRef.current = progressId; }, [progressId]);
    useEffect(() => { endTimeRef.current = endTime; }, [endTime]);
    useEffect(() => { examDataRef.current = examData; }, [examData]);

    const resolvedSubjectFolder = examMeta?.subjectFolder || subjectFolder;
    const normalizedExamPath = examMeta?.examPath || examPath;
    const examLookupId = examMeta?.id || normalizedExamPath || examPath;
    const contentExamPath = getExamBundlePath(examMeta, normalizedExamPath || examPath);

    useEffect(() => {
        let cancelled = false;

        const loadExamMeta = async () => {
            const resolvedMeta = await resolveCanonicalExamMeta(subjectFolder, examPath);
            if (!cancelled) {
                setExamMeta(resolvedMeta);
            }
        };

        loadExamMeta();
        return () => {
            cancelled = true;
        };
    }, [subjectFolder, examPath]);

    useEffect(() => {
        if (!examMeta || !allowed || !userId) return;

        let cancelled = false;

        const loadExamAndProgress = async () => {
            try {
                await new Promise((resolve) => setTimeout(resolve, 250));

                const examBasePath = getExamBasePath(resolvedSubjectFolder, contentExamPath);
                let cloudResources = null;

                try {
                    cloudResources = await getPublicExamResources([examLookupId, normalizedExamPath, examPath]);
                } catch (error) {
                    console.warn('[ExamTaking] Could not fetch cloud resources.', error);
                }

                const dynamicQuestionCount = parseInt(
                    examMeta?.questions || examMeta?.question_count || cloudResources?.questions || 40,
                    10
                );

                let rawData = null;
                try {
                    const examResponse = await fetch(`${examBasePath}/exam.json`);
                    rawData = examResponse.ok ? await examResponse.json() : null;
                } catch (error) {
                    console.warn('[ExamTaking] Could not load local exam.json.', error);
                }

                if (!rawData) {
                    rawData = buildFallbackExamData({
                        title: examMeta?.title || 'De thi',
                        subject: resolvedSubjectFolder,
                        time: examMeta?.time || 50,
                        documentUrl: cloudResources?.document_url || examMeta?.documentUrl || null,
                        questionCount: dynamicQuestionCount,
                    });
                }

                if (cloudResources) {
                    if (cloudResources.document_url) rawData.document_url = cloudResources.document_url;
                    if (cloudResources.video_url) rawData.video_url = cloudResources.video_url;
                    if (cloudResources.solution_url) rawData.solution_url = cloudResources.solution_url;
                    if (cloudResources.answer_file_url) rawData.answer_file_url = cloudResources.answer_file_url;
                }

                const canonicalExamData = applyCanonicalExamMetadata(rawData, examMeta, cloudResources, resolvedSubjectFolder);
                const sanitizedExamData = normalizeExamPayloadTime(
                    sanitizeExamPayloadForTaking(canonicalExamData),
                    resolvedSubjectFolder
                );
                const data = normalizeExamMediaPaths(sanitizedExamData, examBasePath);

                if (data.document_url && !data.document_url.startsWith('http') && !data.document_url.startsWith('/')) {
                    try {
                        const secureUrl = await getSecureDocumentUrl(data.document_url, 10800);
                        if (secureUrl) data.document_url = secureUrl;
                    } catch (error) {
                        console.error('[ExamTaking] Could not resolve secure URL for document.', error);
                    }
                }

                if (cancelled) return;
                setExamData(data);

                const { data: progress } = await supabase
                    .from('exam_progress')
                    .select('id, answers, time_left_seconds')
                    .eq('user_id', userId)
                    .eq('exam_id', examLookupId)
                    .eq('status', 'in_progress')
                    .maybeSingle();

                let currentProgressId = null;
                let currentAnswers = {};
                let currentTime = (data.time || 50) * 60;

                if (progress) {
                    currentProgressId = progress.id;
                    currentAnswers = progress.answers || {};
                    currentTime = progress.time_left_seconds ?? currentTime;
                } else {
                    const { data: newProgress } = await supabase
                        .from('exam_progress')
                        .insert({
                            user_id: userId,
                            exam_id: examLookupId,
                            subject_folder: resolvedSubjectFolder,
                            answers: {},
                            time_left_seconds: currentTime,
                            status: 'in_progress',
                        })
                        .select('id')
                        .single();

                    currentProgressId = newProgress?.id ?? null;
                }

                if (cancelled) return;

                setProgressId(currentProgressId);
                setAnswers(currentAnswers);
                setTimeLeft(currentTime);
                setEndTime(Date.now() + (currentTime * 1000));
            } catch (error) {
                if (cancelled) return;
                console.error('[ExamTaking] Load error:', error);
                alert('Khong tim thay de thi hoac co loi tai du lieu!');
                navigate('/exam-room');
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadExamAndProgress();

        return () => {
            cancelled = true;
        };
    }, [
        allowed,
        contentExamPath,
        examMeta,
        examLookupId,
        examPath,
        navigate,
        normalizedExamPath,
        resolvedSubjectFolder,
        userId,
    ]);

    const saveProgress = useCallback(async () => {
        const currentProgressId = progressIdRef.current;
        if (!currentProgressId || !userId) return;

        await supabase
            .from('exam_progress')
            .update({
                answers: answersRef.current,
                time_left_seconds: timeLeftRef.current,
                updated_at: new Date().toISOString(),
            })
            .eq('id', currentProgressId);

        hasUnsavedChanges.current = false;
    }, [userId]);

    useEffect(() => {
        if (!progressId || submitted) return undefined;

        autoSaveIntervalRef.current = setInterval(saveProgress, AUTOSAVE_INTERVAL_MS);
        return () => clearInterval(autoSaveIntervalRef.current);
    }, [progressId, saveProgress, submitted]);

    const submitExam = useCallback(async () => {
        if (isSubmitting || submitted) return;
        setIsSubmitting(true);

        clearTimeout(debounceTimerRef.current);
        clearInterval(autoSaveIntervalRef.current);
        await saveProgress();

        try {
            const { data: resultData, error: rpcError } = await supabase.rpc('submit_exam_securely', {
                p_exam_id: examLookupId,
                p_subject_folder: resolvedSubjectFolder,
                p_exam_title: examDataRef.current?.title || examMeta?.title,
                p_answers: answersRef.current,
            });

            if (rpcError) throw rpcError;

            const { result_id, score, correct, total, is_scored, message } = resultData || {};
            const isScored = Boolean(is_scored);

            if (!isScored && message === 'pending_answer_key') {
                alert('De nay chua co dap an trong he thong nen chua the cham tu dong. Bai lam cua ban da duoc luu.');
            }

            const resultPath = result_id
                ? `/exam/${resolvedSubjectFolder}/${normalizedExamPath}/result?resultId=${encodeURIComponent(result_id)}`
                : `/exam/${resolvedSubjectFolder}/${normalizedExamPath}/result`;

            setSubmitted(true);
            navigate(resultPath, {
                state: {
                    examData: examDataRef.current,
                    answers: answersRef.current,
                    score,
                    correct,
                    total,
                    isScored,
                    scoreMessage: message || null,
                    resultId: result_id,
                    examId: examLookupId,
                    examPath: normalizedExamPath,
                    subjectFolder: resolvedSubjectFolder,
                },
            });
        } catch (error) {
            console.error('[ExamTaking] Submit error:', error);
            alert(error.message || 'Co loi khi nop bai. Vui long thu lai!');
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
    ]);

    useEffect(() => {
        if (loading || submitted || autoSubmittedRef.current || !endTime) return undefined;

        const timer = setInterval(() => {
            const now = Date.now();
            const next = Math.max(0, Math.floor((endTime - now) / 1000));

            setTimeLeft(next);
            timeLeftRef.current = next;

            if (next <= 0) {
                clearInterval(timer);
                if (!autoSubmittedRef.current) {
                    autoSubmittedRef.current = true;
                    setTimeout(() => {
                        alert('Het gio lam bai! He thong tu dong thu bai.');
                        submitExam();
                    }, 0);
                }
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [endTime, loading, submitExam, submitted]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden' && !submitted) {
                saveProgress();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pagehide', handleVisibilityChange);

        return () => {
            if (!submitted) {
                saveProgress();
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pagehide', handleVisibilityChange);
        };
    }, [saveProgress, submitted]);

    useEffect(() => {
        if (submitted) return undefined;

        const handleBeforeUnload = (event) => {
            event.preventDefault();
            event.returnValue = 'Ban dang lam bai thi. Neu roi di, tien trinh se duoc luu lai de tiep tuc sau. Ban co chac muon thoat?';
            return event.returnValue;
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [submitted]);

    const handleAnswerChange = useCallback((questionKey, value, subId = null) => {
        setAnswers((previousAnswers) => {
            const currentAnswer = previousAnswers[questionKey] || {};
            const nextAnswers = subId
                ? { ...previousAnswers, [questionKey]: { ...currentAnswer, [subId]: value } }
                : { ...previousAnswers, [questionKey]: value };

            answersRef.current = nextAnswers;
            return nextAnswers;
        });

        hasUnsavedChanges.current = true;
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(saveProgress, AUTOSAVE_DEBOUNCE_MS);
    }, [saveProgress]);

    const handleManualSubmit = useCallback(() => {
        const unanswered = (
            examData?.parts?.flatMap((part) => part.questions.map((question) => ({
                partId: part.id,
                question,
            }))) || []
        ).filter(({ partId, question }) => (
            !isQuestionAnswered(question, answers[getQuestionKey(partId, question.id)])
        )).length;

        const message = unanswered > 0
            ? `Ban con ${unanswered} cau chua tra loi. Ban co chac muon nop bai khong?`
            : 'Ban co chac chan muon nop bai khong?';

        if (window.confirm(message)) {
            submitExam();
        }
    }, [answers, examData, submitExam]);

    return {
        examMeta,
        examLookupId,
        examData,
        loading,
        answers,
        timeLeft,
        isSubmitting,
        submitted,
        handleAnswerChange,
        handleManualSubmit,
    };
}
