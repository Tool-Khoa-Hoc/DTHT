import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useExamAccess } from '../hooks/useExamAccess';
import RichTextRenderer from '../components/exam/RichTextRenderer';
import { questionHasOptionContent, questionHasStatementContent } from '../utils/examQuestionLayout';

const AUTOSAVE_DEBOUNCE_MS = 2000; // 2s sau khi chọn đáp án
const AUTOSAVE_INTERVAL_MS = 30000; // 30s định kỳ
const FREE_DAILY_LIMIT = 2;
const CHOICE_LABELS = ['A', 'B', 'C', 'D'];
const TRUE_FALSE_LABELS = ['a', 'b', 'c', 'd'];

const getQuestionKey = (partId, questionId) => `${partId}.${questionId}`;

const getExamBasePath = (subjectFolder, examPath) => `/data/exams/${subjectFolder}/${examPath}`;

const normalizeExamMediaPaths = (value, basePath) => {
    if (Array.isArray(value)) {
        return value.map((item) => normalizeExamMediaPaths(item, basePath));
    }

    if (!value || typeof value !== 'object') {
        return value;
    }

    const next = { ...value };

    if (typeof next.image === 'string' && !/^(?:https?:)?\//.test(next.image)) {
        next.image = `${basePath}/${next.image}`;
    }

    if (typeof next.src === 'string' && !/^(?:https?:)?\//.test(next.src)) {
        next.src = `${basePath}/${next.src}`;
    }

    for (const key of Object.keys(next)) {
        if (key === 'image' || key === 'src') continue;
        next[key] = normalizeExamMediaPaths(next[key], basePath);
    }

    return next;
};

const getExpectedAnswer = (examData, partId, question) => {
    const topLevelAnswer = examData?.answer_key?.[getQuestionKey(partId, question.id)];
    if (topLevelAnswer !== undefined) return topLevelAnswer;

    if (question.type === 'single_choice' || question.type === 'short_answer') {
        return question.correct_answer;
    }

    if (question.type === 'true_false') {
        const statementAnswers = {};
        let hasAny = false;

        question.statements?.forEach((statement) => {
            if (statement.correct !== undefined) {
                statementAnswers[statement.id] = statement.correct;
                hasAny = true;
            }
        });

        return hasAny ? statementAnswers : undefined;
    }

    return undefined;
};

const getVideoReviewUrl = (examData) => (
    examData?.resources?.video_url ||
    examData?.resources?.videoUrl ||
    examData?.video_url ||
    examData?.videoUrl ||
    null
);

const resolveExamMeta = async (subjectFolder, routePath) => {
    try {
        const res = await fetch('/data/exams/index.json', { cache: 'no-store' });
        if (!res.ok) throw new Error('Index not found');
        const examIndex = await res.json();
        const matchedExam = examIndex.find((exam) => (
            exam.subjectFolder === subjectFolder &&
            (exam.examPath === routePath || exam.id === routePath)
        ));
        if (matchedExam) {
            return matchedExam;
        }
    } catch (error) {
        console.warn('[ExamTaking] Failed to resolve exam metadata from index, using legacy fallback.', error);
    }

    return {
        id: routePath,
        examPath: routePath,
        subjectFolder
    };
};

const isQuestionAnswered = (question, value) => {
    if (question.type === 'true_false') {
        const statementIds = question.statements?.map((statement) => statement.id) || [];
        return statementIds.length > 0 && statementIds.every((statementId) => value?.[statementId] !== undefined);
    }

    return value !== undefined && value !== '';
};

export default function ExamTaking() {
    const { subjectFolder, examPath } = useParams();
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    const [examMeta, setExamMeta] = useState(null);

    // ─── Trạng thái dữ liệu ─────────────────────────────────
    const [examData, setExamData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [progressId, setProgressId] = useState(null); // exam_progress.id
    const [answers, setAnswers] = useState({});
    const [timeLeft, setTimeLeft] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // ─── Refs để tránh stale closure ─────────────────────────
    const answersRef = useRef(answers);
    const timeLeftRef = useRef(timeLeft);
    const progressIdRef = useRef(progressId);
    const debounceTimerRef = useRef(null);
    const autoSaveIntervalRef = useRef(null);
    const hasUnsavedChanges = useRef(false);

    useEffect(() => { answersRef.current = answers; }, [answers]);
    useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);
    useEffect(() => { progressIdRef.current = progressId; }, [progressId]);

    // ─── Kiểm soát quyền truy cập ───────────────────────────
    useEffect(() => {
        let cancelled = false;

        const loadExamMeta = async () => {
            const resolvedMeta = await resolveExamMeta(subjectFolder, examPath);
            if (!cancelled) {
                setExamMeta(resolvedMeta);
            }
        };

        loadExamMeta();
        return () => { cancelled = true; };
    }, [subjectFolder, examPath]);

    const examId = examMeta?.id;
    const normalizedExamPath = examMeta?.examPath || examPath;
    const { loading: accessLoading, allowed, reason } = useExamAccess(examId);

    // ─── Tải đề thi và khôi phục tiến trình ─────────────────
    useEffect(() => {
        if (!examMeta || accessLoading || !allowed || !user) return;
        loadExamAndProgress();
    }, [examMeta, accessLoading, allowed, user]);

    const loadExamAndProgress = async () => {
        try {
            const examBasePath = getExamBasePath(subjectFolder, normalizedExamPath);

            // 1. Tải file đề thi JSON
            const res = await fetch(`${examBasePath}/exam.json`);
            if (!res.ok) throw new Error('Exam not found');
            const rawData = await res.json();
            const data = normalizeExamMediaPaths(rawData, examBasePath);
            setExamData(data);

            // 2. Kiểm tra tiến trình đang dở (in_progress)
            const { data: progress } = await supabase
                .from('exam_progress')
                .select('id, answers, time_left_seconds')
                .eq('user_id', user.id)
                .eq('exam_id', examId)
                .eq('status', 'in_progress')
                .maybeSingle();

            if (progress) {
                // Khôi phục từ DB (phục hồi khi F5/mất mạng)
                setProgressId(progress.id);
                setAnswers(progress.answers || {});
                setTimeLeft(progress.time_left_seconds ?? data.time * 60);
            } else {
                // Tạo session mới
                const { data: newProgress } = await supabase
                    .from('exam_progress')
                    .insert({
                        user_id: user.id,
                        exam_id: examId,
                        subject_folder: subjectFolder,
                        answers: {},
                        time_left_seconds: data.time * 60,
                        status: 'in_progress',
                    })
                    .select('id')
                    .single();
                setProgressId(newProgress?.id ?? null);
                setTimeLeft(data.time * 60);
            }
        } catch (err) {
            console.error('[ExamTaking] Load error:', err);
            alert('Không tìm thấy đề thi hoặc có lỗi tải dữ liệu!');
            navigate('/exam-room');
        } finally {
            setLoading(false);
        }
    };

    // ─── Auto-save function ──────────────────────────────────
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

    // ─── Interval auto-save mỗi 30s ─────────────────────────
    useEffect(() => {
        if (!progressId || submitted) return;
        autoSaveIntervalRef.current = setInterval(saveProgress, AUTOSAVE_INTERVAL_MS);
        return () => clearInterval(autoSaveIntervalRef.current);
    }, [progressId, submitted, saveProgress]);

    // ─── Đồng hồ đếm ngược ──────────────────────────────────
    useEffect(() => {
        if (loading || timeLeft <= 0 || submitted) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                timeLeftRef.current = prev - 1;
                if (prev <= 1) {
                    clearInterval(timer);
                    handleAutoSubmit();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [loading, submitted]);

    // ─── Cảnh báo thoát khi chưa nộp bài ───────────────────
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

    // ─── Chọn đáp án + debounce auto-save ───────────────────
    const handleAnswerChange = (questionKey, value, subId = null) => {
        setAnswers(prev => {
            const current = prev[questionKey] || {};
            const next = subId
                ? { ...prev, [questionKey]: { ...current, [subId]: value } }
                : { ...prev, [questionKey]: value };
            answersRef.current = next;
            return next;
        });

        // Debounce: save 2s sau thao tác cuối
        hasUnsavedChanges.current = true;
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(saveProgress, AUTOSAVE_DEBOUNCE_MS);
    };

    // ─── Tính điểm ──────────────────────────────────────────
    const calculateScore = (data, userAnswers) => {
        const allQuestions = data.parts?.flatMap((part) => part.questions.map((question) => ({
            partId: part.id,
            question,
        }))) || [];
        let correct = 0;

        allQuestions.forEach(({ partId, question }) => {
            const userAns = userAnswers[getQuestionKey(partId, question.id)];
            const expectedAnswer = getExpectedAnswer(data, partId, question);

            if (question.type === 'single_choice') {
                if (userAns !== undefined && userAns === expectedAnswer) correct++;
            } else if (question.type === 'true_false') {
                const allCorrect = question.statements?.every((statement, index) => {
                    if (Array.isArray(expectedAnswer)) {
                        return userAns?.[statement.id] === expectedAnswer[index];
                    }
                    return userAns?.[statement.id] === expectedAnswer?.[statement.id];
                });
                if (allCorrect) correct++;
            } else if (question.type === 'short_answer') {
                const correct_str = String(expectedAnswer ?? '').trim().toLowerCase();
                const user_str = String(userAns ?? '').trim().toLowerCase();
                if (correct_str && correct_str === user_str) correct++;
            }
        });

        return { correct, total: allQuestions.length };
    };

    // ─── Nộp bài ────────────────────────────────────────────
    const submitExam = async () => {
        if (isSubmitting || submitted) return;
        setIsSubmitting(true);

        // Save lần cuối trước khi nộp
        clearTimeout(debounceTimerRef.current);
        clearInterval(autoSaveIntervalRef.current);
        await saveProgress();

        try {
            // Nộp bài bảo mật qua RPC (Tính điểm và ghi kết quả trên Server)
            const { data: resultData, error: rpcError } = await supabase.rpc('submit_exam_securely', {
                p_exam_id: examId,
                p_subject_folder: subjectFolder,
                p_exam_title: examData.title,
                p_answers: answersRef.current
            });

            if (rpcError) throw rpcError;

            const { result_id, score, correct, total } = resultData;

            setSubmitted(true);
            navigate(`/exam/${subjectFolder}/${normalizedExamPath}/result`, {
                state: { 
                    examData, 
                    answers: answersRef.current, 
                    score, 
                    correct, 
                    total, 
                    resultId: result_id, 
                    examId, 
                    examPath: normalizedExamPath, 
                    subjectFolder 
                },
            });
        } catch (err) {
            console.error('[ExamTaking] Submit error:', err);
            alert(err.message || 'Có lỗi khi nộp bài. Vui lòng thử lại!');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAutoSubmit = () => {
        alert('⏰ Hết giờ làm bài! Hệ thống tự động thu bài.');
        submitExam();
    };

    const handleManualSubmit = () => {
        const unanswered = (examData?.parts?.flatMap((part) => part.questions.map((question) => ({
            partId: part.id,
            question,
        }))) || [])
            .filter(({ partId, question }) => !isQuestionAnswered(question, answers[getQuestionKey(partId, question.id)])).length;

        const msg = unanswered > 0
            ? `Bạn còn ${unanswered} câu chưa trả lời. Bạn có chắc muốn nộp bài không?`
            : 'Bạn có chắc chắn muốn nộp bài không?';

        if (window.confirm(msg)) submitExam();
    };

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const getStatusBlock = (question, questionKey) => {
        const answer = answers[questionKey];
        if (question.type === 'true_false') {
            const statementIds = question.statements?.map((statement) => statement.id) || [];
            const answeredCount = statementIds.filter((statementId) => answer?.[statementId] !== undefined).length;
            return answeredCount === statementIds.length
                ? 'bg-blue-500 text-white border-blue-600'
                : answeredCount > 0
                    ? 'bg-amber-400 text-white border-amber-500'
                    : 'bg-white text-slate-600 border-slate-300';
        }
        return (answer !== undefined && answer !== '')
            ? 'bg-blue-500 text-white border-blue-600'
            : 'bg-white text-slate-600 border-slate-300';
    };

    const accessTitle = reason === 'daily_limit'
        ? `Đã đạt giới hạn ${FREE_DAILY_LIMIT} đề hôm nay`
        : reason === 'error'
            ? 'Không thể kiểm tra quyền truy cập'
            : 'Không có quyền truy cập';

    const accessDescription = reason === 'daily_limit'
        ? `User Free chỉ được mở ${FREE_DAILY_LIMIT} đề mới mỗi ngày. Bạn có thể làm lại bất kỳ đề nào đã làm trước đó, hoặc nâng cấp VIP để không giới hạn.`
        : reason === 'error'
            ? 'Đã xảy ra lỗi khi kiểm tra quyền truy cập đề thi. Vui lòng thử lại sau.'
            : 'Vui lòng đăng nhập để làm bài thi.';

    // ─── Screen: Đang tải ────────────────────────────────────
    if (accessLoading || (allowed && (loading || !examData))) {
        return (
            <div className="min-h-screen bg-[#f8f6f6] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-slate-600">
                    <span className="material-symbols-outlined animate-spin text-4xl text-[#fe5f36]">sync</span>
                    <p className="font-semibold">Đang kiểm tra quyền truy cập...</p>
                </div>
            </div>
        );
    }

    // ─── Screen: Bị chặn (giới hạn đề) ─────────────────────
    if (!allowed) {
        return (
            <div className="min-h-screen bg-[#0f080a] flex items-center justify-center px-4">
                <div className="max-w-md w-full bg-[#1a0f12]/90 backdrop-blur border border-white/10 rounded-3xl p-8 text-center text-white shadow-2xl">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[#fe5f36]/20 to-[#7f13ec]/20 flex items-center justify-center border border-white/10">
                        <span className="material-symbols-outlined text-4xl text-[#fe5f36]">lock</span>
                    </div>
                    <h2 className="text-2xl font-black mb-3">
                        {accessTitle}
                    </h2>
                    <p className="text-slate-400 text-sm leading-relaxed mb-8">
                        {accessDescription}
                    </p>
                    <div className="flex flex-col gap-3">
                        <Link
                            to="/pricing"
                            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#fe5f36] to-pink-600 text-white font-black text-sm flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-lg shadow-[#fe5f36]/30"
                        >
                            <span className="material-symbols-outlined text-[18px]">workspace_premium</span>
                            Nâng cấp VIP – Không giới hạn
                        </Link>
                        <Link
                            to="/exam-room"
                            className="text-slate-400 text-sm hover:text-white transition-colors"
                        >
                            ← Quay lại Phòng thi
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const allQuestions = examData?.parts?.flatMap((part) => part.questions.map((question) => ({
        partId: part.id,
        question,
    }))) || [];
    const answeredQuestionsCount = allQuestions.filter(({ partId, question }) => (
        isQuestionAnswered(question, answers[getQuestionKey(partId, question.id)])
    )).length;
    const videoReviewUrl = getVideoReviewUrl(examData);

    return (
        <div className="h-screen overflow-hidden bg-[#f8f6f6] text-slate-800 font-display flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between z-30 shadow-sm shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => {
                            if (window.confirm('Tiến trình làm bài đã được lưu. Bạn muốn thoát?')) {
                                navigate('/exam-room');
                            }
                        }}
                        className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 transition-colors text-slate-600"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-lg font-black text-slate-800 line-clamp-1">{examData?.title}</h1>
                        <p className="text-xs text-slate-500 font-medium">{examData?.subject} • {examData?.time} phút</p>
                    </div>
                </div>
                {/* Mobile timer */}
                <div className={`md:hidden font-mono font-black text-xl transition-colors ${timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-[#fe5f36]'}`}>
                    {formatTime(timeLeft)}
                </div>
            </header>

            <div className="flex-1 flex flex-col md:flex-row max-w-[1600px] w-full mx-auto relative overflow-hidden">
                {/* Left: Question content */}
                <div className="flex-1 overflow-y-auto h-full">
                    <div className="max-w-4xl mx-auto bg-white md:rounded-t-3xl p-6 md:p-12 shadow-sm border border-slate-200 border-b-0 min-h-full space-y-12 pb-24 md:pb-12">
                        {examData?.parts?.map((part) => (
                            <div key={part.id}>
                                <div className="mb-6 pb-4 border-b border-slate-100">
                                    <h2 className="text-2xl font-black text-[#fe5f36]">{part.name}</h2>
                                    <p className="text-sm font-medium text-slate-500 mt-2 italic">{part.description}</p>
                                </div>
                                <div className="space-y-10">
                                    {part.questions.map((q, qIndex) => {
                                        const questionKey = getQuestionKey(part.id, q.id);
                                        const hasOptionContent = questionHasOptionContent(q);
                                        const hasStatementContent = questionHasStatementContent(q);

                                        return (
                                        <div key={questionKey} id={`q-${questionKey}`} className="scroll-mt-24">
                                            <div className="flex gap-4">
                                                <div className="w-10 h-10 shrink-0 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black text-lg border border-blue-100">
                                                    {qIndex + 1}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="text-base font-medium leading-relaxed mb-4">
                                                        <RichTextRenderer content={q.content} />
                                                    </div>

                                                    {/* Single choice */}
                                                    {q.type === 'single_choice' && (
                                                        hasOptionContent ? (
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                {q.options.map((opt, optIdx) => {
                                                                    const isChecked = answers[questionKey] === optIdx;
                                                                    return (
                                                                        <label key={optIdx} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${isChecked ? 'bg-blue-50 border-blue-500 text-blue-800 font-bold' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                                                                            <input type="radio" name={questionKey} className="hidden" onChange={() => handleAnswerChange(questionKey, optIdx)} checked={isChecked} />
                                                                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition-colors ${isChecked ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'}`}>{CHOICE_LABELS[optIdx]}</span>
                                                                            <span><RichTextRenderer content={opt} /></span>
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-wrap gap-3">
                                                                {CHOICE_LABELS.map((label, optIdx) => {
                                                                    const isChecked = answers[questionKey] === optIdx;
                                                                    return (
                                                                        <label key={label} className={`min-w-[5rem] px-4 py-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-center font-black ${isChecked ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'}`}>
                                                                            <input type="radio" name={questionKey} className="hidden" onChange={() => handleAnswerChange(questionKey, optIdx)} checked={isChecked} />
                                                                            {label}
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                        )
                                                    )}

                                                    {/* True/False */}
                                                    {q.type === 'true_false' && (
                                                        hasStatementContent ? (
                                                            <div className="space-y-3">
                                                                {q.statements?.map((stmt, stmtIdx) => {
                                                                    const currentAns = answers[questionKey]?.[stmt.id];
                                                                    return (
                                                                        <div key={stmt.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
                                                                            <div className="flex gap-3">
                                                                                <span className="font-bold text-slate-500">{TRUE_FALSE_LABELS[stmtIdx]})</span>
                                                                                <span className="font-medium text-slate-800"><RichTextRenderer content={stmt.content} /></span>
                                                                            </div>
                                                                            <div className="flex items-center gap-2 shrink-0">
                                                                                <button onClick={() => handleAnswerChange(questionKey, true, stmt.id)} className={`px-4 py-1.5 rounded-lg text-sm font-bold border transition-colors ${currentAns === true ? 'bg-green-500 text-white border-green-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}`}>Đúng</button>
                                                                                <button onClick={() => handleAnswerChange(questionKey, false, stmt.id)} className={`px-4 py-1.5 rounded-lg text-sm font-bold border transition-colors ${currentAns === false ? 'bg-red-500 text-white border-red-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}`}>Sai</button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                {q.statements?.map((stmt, stmtIdx) => {
                                                                    const currentAns = answers[questionKey]?.[stmt.id];
                                                                    return (
                                                                        <div key={stmt.id} className="flex items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
                                                                            <span className="font-bold text-slate-700">Mệnh đề {TRUE_FALSE_LABELS[stmtIdx]})</span>
                                                                            <div className="flex items-center gap-2 shrink-0">
                                                                                <button onClick={() => handleAnswerChange(questionKey, true, stmt.id)} className={`px-4 py-1.5 rounded-lg text-sm font-bold border transition-colors ${currentAns === true ? 'bg-green-500 text-white border-green-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}`}>Đúng</button>
                                                                                <button onClick={() => handleAnswerChange(questionKey, false, stmt.id)} className={`px-4 py-1.5 rounded-lg text-sm font-bold border transition-colors ${currentAns === false ? 'bg-red-500 text-white border-red-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}`}>Sai</button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )
                                                    )}

                                                    {/* Short answer */}
                                                    {q.type === 'short_answer' && (
                                                        <div className="mt-2">
                                                            <input
                                                                type="text"
                                                                placeholder="Nhập đáp án..."
                                                                value={answers[questionKey] || ''}
                                                                onChange={(e) => handleAnswerChange(questionKey, e.target.value)}
                                                                className="w-full md:w-1/2 p-3 border-b-2 border-slate-300 bg-slate-50 rounded-t-lg font-bold text-lg text-center focus:outline-none focus:border-[#fe5f36] transition-colors"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </div>
                        ))}

                        {/* VIP Video Section Lock */}
                        {videoReviewUrl && (
                            <div className="rounded-3xl border-2 border-dashed border-slate-200 overflow-hidden relative">
                                {profile?.is_vip ? (
                                    <div className="p-6">
                                        <h3 className="font-black text-lg mb-3 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-amber-500">play_circle</span>
                                            Video chữa bài
                                        </h3>
                                        <video src={videoReviewUrl} controls className="w-full rounded-2xl" />
                                    </div>
                                ) : (
                                    <div className="p-8 bg-gradient-to-br from-[#0f080a] to-[#1a0f12] text-white text-center">
                                        <span className="material-symbols-outlined text-5xl text-[#fe5f36] mb-3">lock</span>
                                        <h3 className="font-black text-lg mb-2">Video giải chi tiết</h3>
                                        <p className="text-slate-400 text-sm mb-5">Nâng cấp VIP để xem video chữa bài từ giáo viên</p>
                                        <Link to="/pricing" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#fe5f36] to-pink-600 text-white font-bold text-sm hover:scale-[1.02] transition-transform shadow-lg">
                                            <span className="material-symbols-outlined text-[18px]">workspace_premium</span>
                                            Nâng cấp VIP
                                        </Link>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Sidebar navigation */}
                <div className="hidden md:flex w-[300px] shrink-0 border-l border-slate-200 bg-white shadow-xl h-full flex-col p-6 justify-between overflow-y-auto">
                    <div className="w-full">
                        {/* Timer */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6 text-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#fe5f36]/20 blur-3xl rounded-full" />
                            <p className="text-slate-400 text-xs tracking-wider uppercase mb-1">Thời gian còn lại</p>
                            <div className={`font-mono font-black text-4xl tracking-tight ${timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                                {formatTime(timeLeft)}
                            </div>
                        </div>

                        {/* Question grid */}
                        <div className="space-y-5 overflow-y-auto max-h-[50vh] pr-1">
                            {examData?.parts?.map((p) => (
                                <div key={p.id}>
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{p.name}</h3>
                                    <div className="grid grid-cols-5 gap-2">
                                        {p.questions.map((q, qIdx) => (
                                            <button
                                                key={getQuestionKey(p.id, q.id)}
                                                onClick={() => {
                                                    document.getElementById(`q-${getQuestionKey(p.id, q.id)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                }}
                                                className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border-2 transition-transform hover:scale-105 ${getStatusBlock(q, getQuestionKey(p.id, q.id))}`}
                                            >
                                                {qIdx + 1}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Answered count */}
                        <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                            <span className="text-sm font-bold text-slate-600">
                                Đã làm: <span className="text-blue-600">{answeredQuestionsCount}</span> / {allQuestions.length} câu
                            </span>
                        </div>
                    </div>

                    {/* Submit button */}
                    <div className="w-full pt-6">
                        <button
                            onClick={handleManualSubmit}
                            disabled={isSubmitting}
                            className="w-full py-4 rounded-full bg-gradient-to-r from-[#fe5f36] to-pink-600 text-white font-black text-lg shadow-xl shadow-[#fe5f36]/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {isSubmitting
                                ? <><span className="material-symbols-outlined animate-spin">sync</span> Đang nộp...</>
                                : <><span className="material-symbols-outlined">send</span> Nộp bài</>
                            }
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile: fixed bottom submit bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-4 z-40">
                <button
                    onClick={handleManualSubmit}
                    disabled={isSubmitting}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#fe5f36] to-pink-600 text-white font-black flex items-center justify-center gap-2 disabled:opacity-70"
                >
                    {isSubmitting ? 'Đang nộp...' : 'Nộp bài'}
                </button>
            </div>
        </div>
    );
}
