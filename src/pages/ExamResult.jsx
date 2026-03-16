import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import RichTextRenderer from '../components/exam/RichTextRenderer';
import { sanitizeExternalUrl } from '../utils/urlSecurity';
import {
    formatTrueFalseValue,
    hasKnownTrueFalseValue,
    questionHasOptionContent,
    questionHasStatementContent
} from '../utils/examQuestionLayout';

const getQuestionKey = (partId, questionId) => `${partId}.${questionId}`;
const CHOICE_LABELS = ['A', 'B', 'C', 'D'];
const TRUE_FALSE_LABELS = ['a', 'b', 'c', 'd'];

const EXAM_RESOURCE_FIELD_PATHS = {
    examFileUrl: [
        ['resources', 'exam_file_url'],
        ['resources', 'examFileUrl'],
        ['resources', 'exam_url'],
        ['resources', 'examUrl'],
        ['resources', 'exam_link'],
        ['resources', 'examLink'],
        ['resources', 'original_exam_url'],
        ['resources', 'originalExamUrl'],
        ['exam_file_url'],
        ['examFileUrl'],
        ['exam_url'],
        ['examUrl'],
        ['exam_link'],
        ['examLink'],
        ['original_exam_url'],
        ['originalExamUrl']
    ],
    answerFileUrl: [
        ['resources', 'answer_file_url'],
        ['resources', 'answerFileUrl'],
        ['resources', 'answer_file'],
        ['resources', 'answerFile'],
        ['answer_file_url'],
        ['answerFileUrl'],
        ['answer_file'],
        ['answerFile']
    ],
    answerFileName: [
        ['resources', 'answer_file_name'],
        ['resources', 'answerFileName'],
        ['resources', 'answer_download_name'],
        ['resources', 'answerDownloadName'],
        ['answer_file_name'],
        ['answerFileName'],
        ['answer_download_name'],
        ['answerDownloadName']
    ],
    editLinkUrl: [
        ['resources', 'edit_link'],
        ['resources', 'editLink'],
        ['resources', 'edit_url'],
        ['resources', 'editUrl'],
        ['resources', 'edit_exam_url'],
        ['resources', 'editExamUrl'],
        ['edit_link'],
        ['editLink'],
        ['edit_url'],
        ['editUrl'],
        ['edit_exam_url'],
        ['editExamUrl']
    ],
    videoReviewUrl: [
        ['resources', 'video_url'],
        ['resources', 'videoUrl'],
        ['resources', 'solution_video_url'],
        ['resources', 'solutionVideoUrl'],
        ['resources', 'review_video_url'],
        ['resources', 'reviewVideoUrl'],
        ['resources', 'video_review_url'],
        ['resources', 'videoReviewUrl'],
        ['video_url'],
        ['videoUrl'],
        ['solution_video_url'],
        ['solutionVideoUrl'],
        ['review_video_url'],
        ['reviewVideoUrl'],
        ['video_review_url'],
        ['videoReviewUrl']
    ]
};

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

const resolveExamMeta = async (subjectFolder, routePath, examId = null) => {
    try {
        const res = await fetch('/data/exams/index.json', { cache: 'no-store' });
        if (!res.ok) throw new Error('Index not found');
        const examIndex = await res.json();
        const matchedExam = examIndex.find((exam) => (
            exam.subjectFolder === subjectFolder &&
            (
                (routePath && exam.examPath === routePath) ||
                (routePath && exam.id === routePath) ||
                (examId && exam.id === examId)
            )
        ));
        if (matchedExam) {
            return matchedExam;
        }
    } catch (error) {
        console.warn('[ExamResult] Failed to resolve exam metadata from index, using legacy fallback.', error);
    }

    return {
        id: examId || routePath,
        examPath: routePath || examId,
        subjectFolder
    };
};

const getNestedValue = (source, fieldPath) => fieldPath.reduce((current, segment) => (
    current && typeof current === 'object' ? current[segment] : undefined
), source);

const pickFirstDefinedValue = (sources, fieldPaths) => {
    for (const source of sources) {
        if (!source || typeof source !== 'object') {
            continue;
        }

        for (const fieldPath of fieldPaths) {
            const value = getNestedValue(source, fieldPath);
            if (value !== undefined && value !== null && value !== '') {
                return value;
            }
        }
    }

    return null;
};

const resolveExamResourceUrl = (rawValue, basePath) => {
    if (typeof rawValue !== 'string') {
        return null;
    }

    const trimmed = rawValue.trim();
    if (!trimmed) {
        return null;
    }

    if (/^https?:\/\//i.test(trimmed)) {
        return sanitizeExternalUrl(trimmed);
    }

    if (/^\/(?!\/)/.test(trimmed)) {
        return trimmed;
    }

    if (/^[a-z]+:/i.test(trimmed)) {
        return null;
    }

    if (!basePath) {
        return null;
    }

    return `${basePath}/${trimmed.replace(/\\/g, '/').replace(/^\.?\//, '')}`;
};

function ResultResourceActions({
    editExamUrl,
    canOpenEditLink = false,
    showLockedEditLink = false,
    compact = false
}) {
    if (!editExamUrl) {
        return null;
    }

    const layoutClass = compact
        ? 'flex flex-wrap items-center gap-3'
        : 'flex flex-wrap justify-center gap-4';
    const editLinkClass = compact
        ? 'inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 transition-colors hover:bg-amber-100'
        : 'inline-flex items-center gap-2 rounded-2xl border-2 border-amber-200 bg-amber-50 px-8 py-4 font-bold text-amber-700 transition-colors shadow-sm hover:bg-amber-100';
    const lockedEditLinkClass = compact
        ? 'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200'
        : 'inline-flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-slate-100 px-8 py-4 font-bold text-slate-700 transition-colors shadow-sm hover:bg-slate-200';

    return (
        <div className={layoutClass}>
            {canOpenEditLink && editExamUrl && (
                <a href={editExamUrl} target="_blank" rel="noreferrer" className={editLinkClass}>
                    <span className="material-symbols-outlined text-[20px]">edit_square</span>
                    Link sửa đề
                </a>
            )}

            {!canOpenEditLink && showLockedEditLink && editExamUrl && (
                <Link to="/pricing" className={lockedEditLinkClass}>
                    <span className="material-symbols-outlined text-[20px]">lock</span>
                    Link sửa đề VIP
                </Link>
            )}
        </div>
    );
}

function VipResourcePanel({
    documentResourceUrl,
    documentResourceLabel,
    videoReviewUrl,
    isVip = false
}) {
    const hasAnyVipResource = Boolean(documentResourceUrl || videoReviewUrl);

    const panelClass = 'w-full lg:w-[18rem] rounded-3xl border border-slate-200 bg-white/90 p-4 text-left shadow-lg shadow-slate-200/60 backdrop-blur';
    const itemBaseClass = 'flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold transition-colors';
    const activeClass = `${itemBaseClass} border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`;
    const videoClass = `${itemBaseClass} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`;
    const disabledClass = `${itemBaseClass} border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed`;
    const lockedClass = `${itemBaseClass} border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200`;

    const renderVipItem = (label, icon, href, className) => {
        if (!isVip) {
            return (
                <Link to="/pricing" className={lockedClass}>
                    <span className="material-symbols-outlined text-[20px]">lock</span>
                    {label}
                </Link>
            );
        }

        if (!href) {
            return (
                <div className={disabledClass}>
                    <span className="material-symbols-outlined text-[20px]">{icon}</span>
                    {label}
                    <span className="ml-auto text-xs font-semibold uppercase tracking-wide">Sắp cập nhật</span>
                </div>
            );
        }

        return (
            <a href={href} target="_blank" rel="noreferrer" className={className}>
                <span className="material-symbols-outlined text-[20px]">{icon}</span>
                {label}
                <span className="material-symbols-outlined ml-auto text-[18px]">open_in_new</span>
            </a>
        );
    };

    if (!hasAnyVipResource && isVip) {
        return (
            <div className={panelClass}>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Tài nguyên VIP</p>
                <h3 className="mt-2 text-lg font-black text-slate-900">Đề gốc và video chữa đề</h3>
                <div className="mt-4 space-y-3">
                    {renderVipItem(documentResourceLabel, 'description', null, activeClass)}
                    {renderVipItem('Video chữa đề', 'play_circle', null, videoClass)}
                </div>
            </div>
        );
    }

    return (
        <div className={panelClass}>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Tài nguyên VIP</p>
            <h3 className="mt-2 text-lg font-black text-slate-900">Đề gốc và video chữa đề</h3>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
                {isVip
                    ? 'Mở nhanh tài liệu đề và video giải chi tiết cho bài vừa làm.'
                    : 'Nâng cấp VIP để mở tài liệu đề và video chữa đề.'}
            </p>
            <div className="mt-4 space-y-3">
                {renderVipItem(documentResourceLabel, 'description', documentResourceUrl, activeClass)}
                {renderVipItem('Video chữa đề', 'play_circle', videoReviewUrl, videoClass)}
            </div>
        </div>
    );
}

const hasPopulatedAnswerKey = (answerKey) => (
    Boolean(answerKey && typeof answerKey === 'object' && Object.keys(answerKey).length > 0)
);

export default function ExamResult() {
    const { user, profile } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const { subjectFolder: routeSubjectFolder, examPath: routeExamPath } = useParams();
    const initialAnswerKey = location.state?.answerKey || location.state?.examData?.answer_key || null;
    const hasInitialReviewData = Boolean(
        location.state?.examData &&
        location.state?.answers &&
        hasPopulatedAnswerKey(initialAnswerKey)
    );
    const [examData, setExamData] = useState(() => (
        location.state?.examData
            ? {
                ...location.state.examData,
                ...(hasPopulatedAnswerKey(initialAnswerKey) ? { answer_key: initialAnswerKey } : {})
            }
            : null
    ));
    const [answers, setAnswers] = useState(location.state?.answers || {});
    const [examMeta, setExamMeta] = useState(null);
    const [resultMetrics, setResultMetrics] = useState(() => ({
        score: location.state?.score ?? null,
        correct: location.state?.correct ?? null,
        total: location.state?.total ?? null
    }));
    const [loading, setLoading] = useState(!hasInitialReviewData);
    const [loadError, setLoadError] = useState('');
    const [showReview, setShowReview] = useState(false);
    const [vipResources, setVipResources] = useState(null); // Loaded from DB for VIP only

    useEffect(() => {
        const subjectFolder = routeSubjectFolder || location.state?.subjectFolder;
        const routePath = location.state?.examPath || routeExamPath;

        if (!subjectFolder || !routePath) {
            return;
        }

        let cancelled = false;

        const loadExamMeta = async () => {
            const resolvedExamMeta = await resolveExamMeta(subjectFolder, routePath, location.state?.examId);
            if (!cancelled) {
                setExamMeta(resolvedExamMeta);
            }
        };

        loadExamMeta();

        return () => {
            cancelled = true;
        };
    }, [location.state?.examId, location.state?.examPath, location.state?.subjectFolder, routeExamPath, routeSubjectFolder]);

    useEffect(() => {
        if (hasInitialReviewData) {
            setLoading(false);
            return;
        }

        const loadReviewData = async () => {
            if (!user) {
                setLoadError('Vui lòng đăng nhập để xem lại bài thi.');
                setLoading(false);
                return;
            }

            try {
                const resultId = location.state?.resultId;
                const routeExamMeta = await resolveExamMeta(routeSubjectFolder, routeExamPath, location.state?.examId);
                setExamMeta(routeExamMeta);
                let resultQuery = supabase
                    .from('exam_results')
                    .select('id, exam_id, subject_folder, answers_snapshot, score, correct_count, total_questions')
                    .eq('user_id', user.id);

                if (resultId) {
                    resultQuery = resultQuery.eq('id', resultId);
                } else {
                    resultQuery = resultQuery
                        .eq('exam_id', location.state?.examId || routeExamMeta.id)
                        .eq('subject_folder', routeSubjectFolder)
                        .order('submitted_at', { ascending: false })
                        .limit(1);
                }

                const { data: resultData, error: resultError } = await resultQuery;
                if (resultError) throw resultError;

                const result = Array.isArray(resultData) ? resultData[0] : resultData;
                if (!result) {
                    throw new Error('Result not found');
                }

                const subjectFolder = result.subject_folder || routeSubjectFolder || location.state?.subjectFolder;
                const examId = result.exam_id || location.state?.examId || routeExamPath;
                const examMeta = await resolveExamMeta(subjectFolder, routeExamPath || location.state?.examPath, examId);
                const examBasePath = getExamBasePath(subjectFolder, examMeta.examPath);
                const examRes = await fetch(`${examBasePath}/exam.json`);
                if (!examRes.ok) throw new Error('Exam not found');
                const rawExamData = await examRes.json();
                const { data: reviewPayload, error: reviewError } = await supabase.rpc('get_exam_review_payload', {
                    p_result_id: result.id
                });
                if (reviewError) throw reviewError;

                const mergedAnswerKey = reviewPayload?.answer_key || rawExamData.answer_key || {};

                setExamData(normalizeExamMediaPaths({
                    ...rawExamData,
                    answer_key: mergedAnswerKey
                }, examBasePath));
                setAnswers(reviewPayload?.answers_snapshot || result.answers_snapshot || {});
                setResultMetrics({
                    score: reviewPayload?.score ?? result.score ?? null,
                    correct: reviewPayload?.correct_count ?? result.correct_count ?? null,
                    total: reviewPayload?.total_questions ?? result.total_questions ?? null
                });
            } catch (error) {
                console.error('[ExamResult] Load review failed:', error);
                setLoadError('Không thể tải dữ liệu xem lại bài thi.');
            } finally {
                setLoading(false);
            }
        };

        loadReviewData();
    }, [hasInitialReviewData, location.state, routeExamPath, routeSubjectFolder, user]);

    // Load VIP resources from DB (only returned for VIP/Admin by server)
    useEffect(() => {
        const examId = location.state?.examId || examMeta?.id;
        if (!examId || !user) return;

        supabase.rpc('get_exam_resources', { p_exam_id: examId })
            .then(({ data }) => {
                if (data) setVipResources(data);
            });
    }, [location.state?.examId, examMeta?.id, user]);

    const resolvedSubjectFolder = examMeta?.subjectFolder || routeSubjectFolder || location.state?.subjectFolder;
    const resolvedExamPath = examMeta?.examPath || location.state?.examPath || routeExamPath;
    const examBasePath = resolvedSubjectFolder && resolvedExamPath
        ? getExamBasePath(resolvedSubjectFolder, resolvedExamPath)
        : null;
    // vipResources from DB takes priority; fallback to examData/examMeta (which won't have sensitive URLs after sync)
    const resourceSources = [vipResources ? { resources: vipResources } : null, examData, examMeta].filter(Boolean);
    const answerFileUrl = resolveExamResourceUrl(
        pickFirstDefinedValue(resourceSources, EXAM_RESOURCE_FIELD_PATHS.answerFileUrl),
        examBasePath
    );
    const examFileUrl = resolveExamResourceUrl(
        pickFirstDefinedValue(resourceSources, EXAM_RESOURCE_FIELD_PATHS.examFileUrl),
        examBasePath
    );
    const editExamUrl = resolveExamResourceUrl(
        pickFirstDefinedValue(resourceSources, EXAM_RESOURCE_FIELD_PATHS.editLinkUrl),
        examBasePath
    );
    const videoReviewUrl = resolveExamResourceUrl(
        pickFirstDefinedValue(resourceSources, EXAM_RESOURCE_FIELD_PATHS.videoReviewUrl),
        examBasePath
    );
    const documentResourceUrl = examFileUrl || answerFileUrl;
    const documentResourceLabel = examFileUrl && answerFileUrl
        ? 'Đề và đáp án'
        : examFileUrl
            ? 'Tài liệu đề'
            : 'File đáp án';
    const canOpenEditLink = Boolean(profile?.is_vip);
    const showLockedEditLink = Boolean(editExamUrl) && !canOpenEditLink;
    const isVip = Boolean(profile?.is_vip);

    if (loading) {
         return (
             <div className="min-h-screen bg-[#f8f6f6] flex flex-col items-center justify-center">
                 <span className="material-symbols-outlined animate-spin text-4xl text-[#fe5f36] mb-3">sync</span>
                 <h2 className="text-xl font-bold mb-2">Đang tải dữ liệu xem lại</h2>
                 <p className="text-slate-500 text-sm">Hệ thống đang khôi phục đề và đáp án đã làm.</p>
             </div>
         );
    }

    if (!examData) {
         return (
             <div className="min-h-screen bg-[#f8f6f6] flex flex-col items-center justify-center">
                 <h2 className="text-xl font-bold mb-2">Không tìm thấy kết quả hợp lệ.</h2>
                 {loadError && <p className="text-sm text-slate-500 mb-4">{loadError}</p>}
                 <Link to="/exam-room" className="px-6 py-2 bg-blue-500 text-white rounded-lg">Quay lại</Link>
             </div>
         );
    }

    // 2025 THPTQG Scoring Logic
    let totalScore = 0;
    const details = { part1: { correct: 0, total: 0 }, part2: { correct: 0, total: 0 }, part3: { correct: 0, total: 0 } };

    examData.parts.forEach(part => {
        part.questions.forEach(q => {
             const qKey = getQuestionKey(part.id, q.id);
             let expectedAnswer = examData.answer_key?.[qKey];
             if (expectedAnswer === undefined && q.correct_answer !== undefined) {
                 expectedAnswer = q.correct_answer;
             }

             if (q.type === 'single_choice') {
                 details.part1.total += 1;
                 if (answers[qKey] === expectedAnswer) {
                     totalScore += q.points ?? 0.25;
                     details.part1.correct += 1;
                 }
             } else if (q.type === 'true_false') {
                 details.part2.total += 1;
                 const qAnswers = answers[qKey] || {};
                 let correctCount = 0;
                 
                 q.statements.forEach((stmt, idx) => {
                     const expectedStmtAnswer = Array.isArray(expectedAnswer) 
                         ? expectedAnswer[idx] 
                         : (expectedAnswer?.[stmt.id] ?? stmt.correct);

                     if (qAnswers[stmt.id] === expectedStmtAnswer && expectedStmtAnswer !== undefined && expectedStmtAnswer !== null) {
                         correctCount += 1;
                     }
                 });

                 if (correctCount === 1) { totalScore += 0.1; }
                 else if (correctCount === 2) { totalScore += 0.25; }
                 else if (correctCount === 3) { totalScore += 0.5; }
                 else if (correctCount === 4) { 
                     totalScore += 1.0; 
                     details.part2.correct += 1;
                 }
             } else if (q.type === 'short_answer') {
                 details.part3.total += 1;
                 const userAns = String(answers[qKey] || '').trim().toLowerCase();
                 const expectAns = String(expectedAnswer ?? '').trim().toLowerCase();
                 
                 if (userAns && userAns === expectAns) {
                     totalScore += q.points ?? 0.5;
                     details.part3.correct += 1;
                 }
             }
        });
    });

    const hasReviewAnswerKey = hasPopulatedAnswerKey(examData.answer_key);
    const displayScore = hasReviewAnswerKey ? totalScore : Number(resultMetrics.score ?? 0);
    const fallbackCorrectCount = Number(resultMetrics.correct ?? 0);
    const fallbackTotalQuestions = Number(resultMetrics.total ?? 0);

    if (showReview) {
        return (
            <div className="min-h-screen bg-[#f8f6f6] text-slate-800 font-display flex flex-col">
                <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm shrink-0">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowReview(false)}
                            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 transition-colors text-slate-600"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                        <div>
                            <h1 className="text-lg font-black text-slate-800">Chi tiết đáp án</h1>
                            <p className="text-xs text-slate-500 font-medium">{examData.title}</p>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto w-full">
                    <div className="max-w-4xl mx-auto bg-white p-6 md:p-12 shadow-sm border-x border-slate-200 min-h-full space-y-12 pb-24">
                        <ResultResourceActions
                            editExamUrl={editExamUrl}
                            canOpenEditLink={canOpenEditLink}
                            showLockedEditLink={showLockedEditLink}
                            compact
                        />

                        {examData.parts.map((part) => (
                            <div key={part.id}>
                                <div className="mb-6 pb-4 border-b border-slate-100">
                                    <h2 className="text-2xl font-black text-[#fe5f36]">{part.name}</h2>
                                    <p className="text-sm font-medium text-slate-500 mt-2 italic">{part.description}</p>
                                </div>
                                <div className="space-y-10">
                                    {part.questions.map((q, qIndex) => {
                                        const questionKey = getQuestionKey(part.id, q.id);
                                        const userAns = answers[questionKey];
                                        const hasOptionContent = questionHasOptionContent(q);
                                        const hasStatementContent = questionHasStatementContent(q);
                                        let expectedAnswer = examData.answer_key?.[questionKey];
                                        if (expectedAnswer === undefined && q.correct_answer !== undefined) {
                                            expectedAnswer = q.correct_answer;
                                        }

                                        return (
                                        <div key={questionKey} className="scroll-mt-24">
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
                                                        <div className={`grid gap-3 ${hasOptionContent ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
                                                            {q.options.map((opt, optIdx) => {
                                                                const isChecked = userAns === optIdx;
                                                                const hasKnownAnswer = Number.isInteger(expectedAnswer);
                                                                const isCorrect = hasKnownAnswer && expectedAnswer === optIdx;

                                                                let bgClass = 'bg-white border-slate-200';
                                                                let textClass = 'bg-slate-100 text-slate-600';

                                                                if (isCorrect) {
                                                                    bgClass = 'bg-green-50 border-green-500 font-bold';
                                                                    textClass = 'bg-green-500 text-white';
                                                                } else if (isChecked) {
                                                                    bgClass = hasKnownAnswer ? 'bg-red-50 border-red-500 font-bold' : 'bg-blue-50 border-blue-500 font-bold';
                                                                    textClass = hasKnownAnswer ? 'bg-red-500 text-white' : 'bg-blue-500 text-white';
                                                                }

                                                                return (
                                                                    <div key={optIdx} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${bgClass}`}>
                                                                        <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center font-bold text-sm transition-colors ${textClass}`}>{CHOICE_LABELS[optIdx]}</span>
                                                                        {hasOptionContent && <div className="flex-1"><RichTextRenderer content={opt} /></div>}
                                                                        {isCorrect && <span className="material-symbols-outlined text-green-500 ml-auto shrink-0">check_circle</span>}
                                                                        {hasKnownAnswer && isChecked && !isCorrect && <span className="material-symbols-outlined text-red-500 ml-auto shrink-0">cancel</span>}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* True/False */}
                                                    {q.type === 'true_false' && (
                                                        <div className="space-y-3">
                                                            {q.statements?.map((stmt, stmtIdx) => {
                                                                const userStmtAns = userAns?.[stmt.id];
                                                                const expectedStmtAnswer = Array.isArray(expectedAnswer) 
                                                                    ? expectedAnswer[stmtIdx] 
                                                                    : (expectedAnswer?.[stmt.id] ?? stmt.correct);

                                                                const hasKnownExpected = hasKnownTrueFalseValue(expectedStmtAnswer);
                                                                const isCorrect = userStmtAns === expectedStmtAnswer && hasKnownExpected;
                                                                const isAnswered = userStmtAns !== undefined;

                                                                return (
                                                                    <div key={stmt.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
                                                                        <div className="flex gap-3">
                                                                            <span className="font-bold text-slate-500 shrink-0">{TRUE_FALSE_LABELS[stmtIdx]})</span>
                                                                            {hasStatementContent ? (
                                                                                <span className="font-medium text-slate-800"><RichTextRenderer content={stmt.content} /></span>
                                                                            ) : (
                                                                                <span className="font-medium text-slate-700">Mệnh đề {TRUE_FALSE_LABELS[stmtIdx]})</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-3 shrink-0">
                                                                            {/* Hiển thị đáp án của user */}
                                                                            {isAnswered ? (
                                                                                <span className={`px-3 py-1 rounded-md text-xs font-bold font-mono ${hasKnownExpected ? (isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700') : 'bg-blue-100 text-blue-700'}`}>
                                                                                    {formatTrueFalseValue(userStmtAns)}
                                                                                    <span className="material-symbols-outlined text-[14px] align-middle ml-1">
                                                                                        {hasKnownExpected ? (isCorrect ? 'check' : 'close') : 'info'}
                                                                                    </span>
                                                                                </span>
                                                                            ) : (
                                                                                <span className="px-3 py-1 rounded-md text-xs font-bold font-mono bg-slate-200 text-slate-500">Chưa chọn</span>
                                                                            )}
                                                                            
                                                                            {/* Đáp án đúng */}
                                                                            {hasKnownExpected ? (
                                                                                <span className="px-3 py-1 rounded-md text-xs font-bold font-mono bg-blue-100 text-blue-700">
                                                                                    Đ/A: {formatTrueFalseValue(expectedStmtAnswer)}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="px-3 py-1 rounded-md text-xs font-bold font-mono bg-slate-200 text-slate-500">
                                                                                    Chưa có đáp án
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* Short answer */}
                                                    {q.type === 'short_answer' && (
                                                        <div className="mt-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                                            <div className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl min-w-[120px]">
                                                                <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Trl của bạn</p>
                                                                <p className={`font-mono text-lg font-black ${String(userAns || '').trim().toLowerCase() === String(expectedAnswer ?? '').trim().toLowerCase() ? 'text-green-600' : 'text-red-500'}`}>
                                                                    {userAns || <span className="text-slate-400 italic font-normal text-sm">Trống</span>}
                                                                </p>
                                                            </div>
                                                            <span className="material-symbols-outlined hidden sm:block text-slate-300">arrow_right_alt</span>
                                                            <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded-xl min-w-[120px]">
                                                                <p className="text-xs font-bold text-blue-500 mb-1 uppercase tracking-wider">Đáp án đúng</p>
                                                                <p className="font-mono text-lg font-black text-blue-700">
                                                                    {expectedAnswer ?? <span className="text-slate-400 italic font-normal text-sm">Chưa có đáp án</span>}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {q.explanation && (
                                                        <div className="mt-6 bg-amber-50 rounded-xl p-5 border border-amber-200">
                                                            <div className="flex items-center gap-2 text-amber-800 font-bold mb-3">
                                                                <span className="material-symbols-outlined">lightbulb</span>
                                                                Hướng dẫn giải / Giải thích chi tiết
                                                            </div>
                                                            <div className="text-amber-900 leading-relaxed text-sm">
                                                                <RichTextRenderer content={q.explanation} />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8f6f6] text-slate-800 font-display py-12 px-4">
            <div className="max-w-3xl mx-auto space-y-8">
                {/* Score Card */}
                <div className="bg-white rounded-3xl p-8 text-center shadow-xl border border-slate-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 blur-3xl rounded-full" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 blur-3xl rounded-full" />
                    
                    <div className="relative z-10 lg:pr-[20rem]">
                        <div className="mb-6 lg:absolute lg:top-0 lg:right-0 lg:mb-0">
                            <VipResourcePanel
                                documentResourceUrl={documentResourceUrl}
                                documentResourceLabel={documentResourceLabel}
                                videoReviewUrl={videoReviewUrl}
                                isVip={isVip}
                            />
                        </div>
                        <span className="material-symbols-outlined text-6xl text-[#fe5f36] mb-4">gpp_good</span>
                        <h1 className="text-3xl font-black text-slate-900 mb-2">Hoàn thành bài thi!</h1>
                        <p className="text-slate-500 font-medium mb-8">{examData.title}</p>
                        
                        <div className="inline-block p-1 rounded-[2rem] bg-gradient-to-r from-[#fe5f36] to-pink-500 mb-8">
                            <div className="bg-white rounded-[1.8rem] px-12 py-8">
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Điểm tổng kết</p>
                                <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#fe5f36] to-pink-600">
                                    {displayScore.toFixed(2).replace(/\.00$/, '')}<span className="text-3xl text-slate-300 ml-2">/10</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap justify-center gap-4">
                            {hasReviewAnswerKey ? (
                                <>
                                    {details.part1.total > 0 && (
                                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl w-40">
                                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">P.I: Trắc nghiệm</p>
                                            <p className="text-xl font-black text-blue-600">{details.part1.correct}/{details.part1.total} <span className="text-sm text-slate-500 font-medium">câu đúng</span></p>
                                        </div>
                                    )}
                                    {details.part2.total > 0 && (
                                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl w-40">
                                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">P.II: Đúng/Sai</p>
                                            <p className="text-xl font-black text-amber-600">{details.part2.correct}/{details.part2.total} <span className="text-sm text-slate-500 font-medium">câu đúng hết</span></p>
                                        </div>
                                    )}
                                    {details.part3.total > 0 && (
                                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl w-40">
                                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">P.III: Trả lời ngắn</p>
                                            <p className="text-xl font-black text-emerald-600">{details.part3.correct}/{details.part3.total} <span className="text-sm text-slate-500 font-medium">câu đúng</span></p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                fallbackTotalQuestions > 0 && (
                                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl min-w-[12rem]">
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Kết quả lưu</p>
                                        <p className="text-xl font-black text-blue-600">{fallbackCorrectCount}/{fallbackTotalQuestions} <span className="text-sm text-slate-500 font-medium">câu đúng</span></p>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-4 justify-center">
                    <button onClick={() => navigate('/exam-room')} className="px-8 py-4 rounded-2xl bg-white border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors shadow-sm">
                        Quay lại danh sách đề
                    </button>
                    <button onClick={() => setShowReview(true)} className="px-8 py-4 rounded-2xl bg-slate-900 border-2 border-slate-900 text-white font-bold hover:bg-slate-800 transition-colors shadow-xl shadow-slate-900/20">
                        Xem chi tiết đáp án
                    </button>
                    <ResultResourceActions
                        editExamUrl={editExamUrl}
                        canOpenEditLink={canOpenEditLink}
                        showLockedEditLink={showLockedEditLink}
                    />
                </div>
            </div>
        </div>
    );
}
