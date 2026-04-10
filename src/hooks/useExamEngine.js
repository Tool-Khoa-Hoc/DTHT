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
    
    // Core states
    const [examMeta, setExamMeta] = useState(null);
    const [examData, setExamData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [progressId, setProgressId] = useState(null);
    const [answers, setAnswers] = useState({});
    const [endTime, setEndTime] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // Refs
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

    // 1. Resolve Exam Meta
    useEffect(() => {
        let cancelled = false;
        const loadExamMeta = async () => {
            const resolvedMeta = await resolveCanonicalExamMeta(subjectFolder, examPath);
            if (!cancelled) setExamMeta(resolvedMeta);
        };
        loadExamMeta();
        return () => { cancelled = true; };
    }, [subjectFolder, examPath]);

    // 2. Load Real Exam & Progress
    useEffect(() => {
        if (!examMeta || !allowed || !user) return;

        const loadExamAndProgress = async () => {
            try {
                // Splash pseudo-delay
                await new Promise(resolve => setTimeout(resolve, 800));

                const examBasePath = getExamBasePath(resolvedSubjectFolder, contentExamPath);
                let cloudResources = null;
                try {
                    cloudResources = await getPublicExamResources([examLookupId, normalizedExamPath, examPath]);
                } catch (e) {
                    console.warn("Could not fetch cloud resources", e);
                }

                let rawData = null;
                // Nếu DB resources KHÔNG chỉ định rõ cấu trúc phần tử nào, ta sẽ sinh cấu trúc mảng Tự động dựa trên số lượng câu hỏi
                const dynamicQuestionCount = parseInt(examMeta?.questions || examMeta?.question_count || cloudResources?.questions || 40);

                rawData = {
                    title: examMeta?.title || "Đề thi",
                    subject: resolvedSubjectFolder,
                    time: examMeta?.time || 50,
                    document_url: cloudResources?.document_url || examMeta?.documentUrl || null,
                    parts: [
                        {
                            id: "phan_thu_nhat",
                            type: "multiple_choice",
                            // Tự sinh ra mảng array theo độ dài định sẵn trên DB
                            questions: Array.from({ length: dynamicQuestionCount }, (_, i) => ({ id: `cau_${i + 1}`, type: "single_choice" }))
                        }
                    ]
                };

                // Trộn cấu hình Admin mới nhất
                if (cloudResources) {
                    if (cloudResources.document_url) rawData.document_url = cloudResources.document_url;
                    if (cloudResources.video_url) rawData.video_url = cloudResources.video_url;
                    if (cloudResources.solution_url) rawData.solution_url = cloudResources.solution_url;
                    if (cloudResources.answer_file_url) rawData.answer_file_url = cloudResources.answer_file_url;
                }

                const canonicalExamData = applyCanonicalExamMetadata(rawData, examMeta, cloudResources, resolvedSubjectFolder);
                const sanitizedExamData = normalizeExamPayloadTime(sanitizeExamPayloadForTaking(canonicalExamData), resolvedSubjectFolder);
                const data = normalizeExamMediaPaths(sanitizedExamData, examBasePath);

                // Ký Secrure URL cho PDF nếu cần
                if (data.document_url && !data.document_url.startsWith('http') && !data.document_url.startsWith('/')) {
                    try {
                        const secureUrl = await getSecureDocumentUrl(data.document_url, 10800);
                        if (secureUrl) data.document_url = secureUrl;
                    } catch (err) {
                        console.error("Could not resolve secure URL for document", err);
                    }
                }

                setExamData(data);

                // Resume Progress logic
                const { data: progress } = await supabase
                    .from('exam_progress')
                    .select('id, answers, time_left_seconds')
                    .eq('user_id', user.id)
                    .eq('exam_id', examLookupId)
                    .eq('status', 'in_progress')
                    .maybeSingle();

                let currentProgId;
                let currentAnswers = {};
                let currentTime = data.time * 60;

                if (progress) {
                    currentProgId = progress.id;
                    currentAnswers = progress.answers || {};
                    currentTime = progress.time_left_seconds ?? data.time * 60;
                } else {
                    const { data: newProgress } = await supabase
                        .from('exam_progress')
                        .insert({
                            user_id: user.id,
                            exam_id: examLookupId,
                            subject_folder: resolvedSubjectFolder,
                            answers: {},
                            time_left_seconds: currentTime,
                            status: 'in_progress',
                        })
                        .select('id')
                        .single();
                    currentProgId = newProgress?.id ?? null;
                }
                
                setProgressId(currentProgId);
                setAnswers(currentAnswers);
                setTimeLeft(currentTime);
                setEndTime(Date.now() + currentTime * 1000);

            } catch (err) {
                console.error('[ExamTaking] Load error:', err);
                alert('Không tìm thấy đề thi hoặc có lỗi tải dữ liệu!');
                navigate('/exam-room');
            } finally {
                setLoading(false);
            }
        };

        loadExamAndProgress();
    }, [examMeta, allowed, user, examLookupId, normalizedExamPath, examPath, resolvedSubjectFolder, contentExamPath, navigate]);

    // 3. Auto-Save Logic
    const saveProgress = useCallback(async () => {
        const pid = progressIdRef.current;
        if (!pid || !user) return;

        await supabase
            .from('exam_progress')
            .update({
                answers: answersRef.current,
                time_left_seconds: timeLeftRef.current,
                updated_at: new Date().toISOString(),
            })
            .eq('id', pid);
        hasUnsavedChanges.current = false;
    }, [user]);

    useEffect(() => {
        if (!progressId || submitted) return;
        autoSaveIntervalRef.current = setInterval(saveProgress, AUTOSAVE_INTERVAL_MS);
        return () => clearInterval(autoSaveIntervalRef.current);
    }, [progressId, submitted, saveProgress]);

    // 4. Timer Logic
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
                p_answers: answersRef.current
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
                    examData: examDataRef.current,
                    answers: answersRef.current,
                    score, correct, total, isScored,
                    scoreMessage: message || null,
                    resultId: result_id,
                    examId: examLookupId,
                    examPath: normalizedExamPath,
                    subjectFolder: resolvedSubjectFolder
                },
            });
        } catch (err) {
            console.error('[ExamTaking] Submit error:', err);
            alert(err.message || 'Có lỗi khi nộp bài. Vui lòng thử lại!');
        } finally {
            setIsSubmitting(false);
        }
    }, [isSubmitting, submitted, saveProgress, examLookupId, resolvedSubjectFolder, examMeta, normalizedExamPath, navigate]);

    useEffect(() => {
        if (loading || submitted || autoSubmittedRef.current || !endTime) return;

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
                        alert('⏰ Hết giờ làm bài! Hệ thống tự động thu bài.');
                        submitExam();
                    }, 0);
                }
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [loading, submitted, endTime, submitExam]);

    // 5. Unload Protection
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden' && !submitted) saveProgress();
        };
        window.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pagehide', handleVisibilityChange);
        return () => {
            if (!submitted) saveProgress();
            window.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pagehide', handleVisibilityChange);
        };
    }, [saveProgress, submitted]);

    useEffect(() => {
        if (submitted) return;
        const handleBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = 'Bạn đang làm bài thi. Nếu rời đi, tiến trình sẽ được lưu lại để tiếp tục sau. Bạn có chắc muốn thoát?';
            return e.returnValue;
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [submitted]);

    // Handlers
    const handleAnswerChange = useCallback((questionKey, value, subId = null) => {
        setAnswers(prev => {
            const current = prev[questionKey] || {};
            const next = subId
                ? { ...prev, [questionKey]: { ...current, [subId]: value } }
                : { ...prev, [questionKey]: value };
            answersRef.current = next;
            return next;
        });

        hasUnsavedChanges.current = true;
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(saveProgress, AUTOSAVE_DEBOUNCE_MS);
    }, [saveProgress]);

    const handleManualSubmit = useCallback(() => {
        const unanswered = (examData?.parts?.flatMap((part) => part.questions.map((question) => ({
            partId: part.id,
            question,
        }))) || [])
        .filter(({ partId, question }) => !isQuestionAnswered(question, answers[getQuestionKey(partId, question.id)])).length;

        const msg = unanswered > 0
            ? `Bạn còn ${unanswered} câu chưa trả lời. Bạn có chắc muốn nộp bài không?`
            : 'Bạn có chắc chắn muốn nộp bài không?';

        if (window.confirm(msg)) submitExam();
    }, [examData, answers, submitExam]);

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
        handleManualSubmit
    };
}
