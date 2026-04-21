import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import RichTextRenderer from '../components/exam/RichTextRenderer';
import { sanitizeExternalUrl } from '../utils/urlSecurity';
import {
    applyCanonicalExamMetadata,
    getExamBundlePath,
    getPublicExamResources,
    resolveCanonicalExamMeta,
} from '../utils/examIndexCache';
import { resolveMediaPath } from '../utils/mediaPath';
import {
    formatTrueFalseValue,
    hasKnownTrueFalseValue,
    questionHasOptionContent,
    questionHasStatementContent
} from '../utils/examQuestionLayout';
import { getSecureDocumentUrl } from '../lib/uploadExamFile';
import DocumentRenderer from '../components/exam/DocumentRenderer';

const getQuestionKey = (partId, questionId) => `${partId}.${questionId}`;
const CHOICE_LABELS = ['A', 'B', 'C', 'D'];
const TRUE_FALSE_LABELS = ['a', 'b', 'c', 'd'];

const normalizeSubjectFolder = (value) => String(value || '').trim().toLowerCase();
const getDefaultShortAnswerPoints = (subjectFolder) => {
    const normalized = normalizeSubjectFolder(subjectFolder);
    return normalized === 'toan' || normalized === 'math' ? 0.5 : 0.25;
};

// Normalize statement ID to canonical single-letter form
// "q13a" → "a", "1a" → "a", "stmt-a" → "a", "a" → "a"
const normalizeStatementId = (stmtId) => {
    const s = String(stmtId ?? '').toLowerCase().trim();
    const m = s.match(/^(?:stmt[_-]?)?(?:q?[0-9]+)?([a-d])$/);
    return m ? m[1] : s;
};

// Lookup a value from an answer object by statement ID,
// trying both the canonical form and the raw form as fallback
const pickStatementValue = (answerObj, stmtId) => {
    if (!answerObj || typeof answerObj !== 'object') return undefined;
    const canonical = normalizeStatementId(stmtId);
    if (Object.prototype.hasOwnProperty.call(answerObj, canonical)) return answerObj[canonical];
    if (Object.prototype.hasOwnProperty.call(answerObj, stmtId)) return answerObj[stmtId];
    return undefined;
};

const toChoiceIndex = (value) => {
    if (Number.isInteger(value) && value >= 0 && value <= 3) return value;

    const text = String(value ?? '').trim().toUpperCase();
    if (!text) return null;
    if (/^[0-3]$/.test(text)) return Number(text);
    if (text === 'A') return 0;
    if (text === 'B') return 1;
    if (text === 'C') return 2;
    if (text === 'D') return 3;

    return null;
};

const toPartNumber = (partId) => {
    const normalized = String(partId ?? '').trim().toLowerCase();
    if (!normalized) return null;

    const direct = normalized.match(/^([123])$/);
    if (direct) return direct[1];

    const match = normalized.match(/^part[_-]?([123])$/);
    if (match) return match[1];

    return null;
};

const toQuestionNumber = (questionId) => {
    const normalized = String(questionId ?? '').trim().toLowerCase();
    if (!normalized) return null;

    const direct = normalized.match(/^([0-9]+)$/);
    if (direct) return direct[1];

    const match = normalized.match(/^q([0-9]+)$/);
    if (match) return match[1];

    return null;
};

const buildQuestionKeyCandidates = (partId, questionId, examData) => {
    const rawKey = getQuestionKey(partId, questionId);
    const partNumber = toPartNumber(partId);
    const questionNumber = toQuestionNumber(questionId);

    const candidates = [
        rawKey,
        String(rawKey || '').toLowerCase(),
    ];

    if (partNumber && questionNumber) {
        candidates.push(
            `part-${partNumber}.${questionNumber}`,
            `part${partNumber}.${questionNumber}`,
            `part${partNumber}.q${questionNumber}`,
            `part-${partNumber}.q${questionNumber}`,
        );
    }

    if (examData?.parts && partNumber && questionNumber) {
        // Tính offset = tổng số câu của các phần TRƯỚC phần hiện tại
        let offset = 0;
        for (const p of examData.parts) {
            if (String(p.id) === `part-${partNumber}`) {
                // Đây là phần chứa câu hỏi cần tìm
                const qIdx = (p.questions || []).findIndex(q => String(q.id) === String(questionNumber));
                if (qIdx !== -1) {
                    candidates.push(String(offset + qIdx + 1)); // 1-indexed absolute
                }
                break;
            }
            offset += (p.questions || []).length;
        }
    }

    const deduped = [];
    const seen = new Set();
    for (const key of candidates) {
        const normalized = String(key || '').trim();
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        deduped.push(normalized);
    }

    return deduped;
};

const pickQuestionValue = (sourceMap, partId, questionId, examData) => {
    if (!sourceMap || typeof sourceMap !== 'object') {
        return undefined;
    }

    const candidates = buildQuestionKeyCandidates(partId, questionId, examData);
    for (const key of candidates) {
        if (Object.prototype.hasOwnProperty.call(sourceMap, key)) {
            return sourceMap[key];
        }
    }

    return undefined;
};

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
    const [examData, setExamData] = useState(() => (
        location.state?.examData
            ? { ...location.state.examData, answer_key: {} }
            : null
    ));
    const [answers, setAnswers] = useState(location.state?.answers || {});
    const [examMeta, setExamMeta] = useState(null);
    const [resultMetrics, setResultMetrics] = useState(() => ({
        score: location.state?.score ?? null,
        correct: location.state?.correct ?? null,
        total: location.state?.total ?? null
    }));
    // Track whether the server has scored this exam (answer_key existed server-side)
    const [serverIsScored, setServerIsScored] = useState(() => Boolean(location.state?.isScored));
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [showReview, setShowReview] = useState(false);
    const [vipResources, setVipResources] = useState(null);
    const [secureAnswerUrl, setSecureAnswerUrl] = useState(null);
    const [secureDocumentUrl, setSecureDocumentUrl] = useState(null);
    const [bucketAnswerFiles, setBucketAnswerFiles] = useState([]);
    const [reviewLeftWidth, setReviewLeftWidth] = useState(68);
    const [isDragging, setIsDragging] = useState(false);

    // Freeze navigation params on mount — prevents re-fetch when user switches browser tabs.
    // location.state / location.search are object references that React Router may recreate
    // on re-focus, which would otherwise trigger the loading useEffect again.
    const initParamsRef = React.useRef({
        resultId:      new URLSearchParams(location.search).get('resultId') || location.state?.resultId || null,
        examId:        location.state?.examId        || null,
        examPath:      location.state?.examPath       || null,
        subjectFolder: location.state?.subjectFolder  || null,
        isScored:      location.state?.isScored       || false,
    });

    // Tracks whether the first load succeeded — used to skip re-fetches on token refresh / tab focus
    const dataLoadedRef = React.useRef(false);

    // Draggable resizer handler
    const startDrag = React.useCallback((e) => {
        setIsDragging(true);
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
    }, []);

    React.useEffect(() => {
        if (!isDragging) return;
        const onMove = (e) => {
            let clientX = e.clientX;
            if (e.type === 'touchmove') clientX = e.touches[0].clientX;
            const pct = (clientX / window.innerWidth) * 100;
            setReviewLeftWidth(Math.max(20, Math.min(pct, 80)));
        };
        const onUp = () => {
            setIsDragging(false);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchmove', onMove);
        window.addEventListener('touchend', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onUp);
        };
    }, [isDragging]);

    useEffect(() => {
        const subjectFolder = routeSubjectFolder || initParamsRef.current.subjectFolder;
        const routePath     = initParamsRef.current.examPath || routeExamPath;

        if (!subjectFolder || !routePath) return;

        let cancelled = false;
        const loadExamMeta = async () => {
            const resolvedExamMeta = await resolveCanonicalExamMeta(subjectFolder, routePath, initParamsRef.current.examId);
            if (!cancelled) setExamMeta(resolvedExamMeta);
        };
        loadExamMeta();
        return () => { cancelled = true; };
    }, [routeExamPath, routeSubjectFolder]); // initParamsRef is stable (ref)


    useEffect(() => {
        const loadReviewData = async () => {
            if (!user) {
                setLoadError('Vui lòng đăng nhập để xem lại bài thi.');
                setLoading(false);
                return;
            }

            // Guard: nếu đã load thành công rồi thì không load lại
            // (tránh flash khi Supabase emit TOKEN_REFRESHED hoặc focus event)
            if (dataLoadedRef.current) return;

            // Reset state only on first load
            setLoading(true);
            setLoadError('');

            // Use stable frozen params — never re-reads from location.state to avoid tab-switch reload
            const { resultId, examId: stateExamId, examPath: stateExamPath, subjectFolder: stateSubjectFolder, isScored: stateIsScored } = initParamsRef.current;

            try {
                const routeExamMeta = await resolveCanonicalExamMeta(routeSubjectFolder, routeExamPath, stateExamId);
                setExamMeta(routeExamMeta);

                // --- Step 1: Find the exam result ---
                let result = null;

                if (resultId) {
                    const { data, error } = await supabase
                        .from('exam_results')
                        .select('id, exam_id, subject_folder, answers_snapshot, score, correct_count, total_questions, is_scored')
                        .eq('user_id', user.id)
                        .eq('id', resultId)
                        .maybeSingle();
                    if (error) throw error;
                    result = data;
                }

                if (!result) {
                    const candidateIds = [
                        stateExamId,
                        routeExamMeta?.id,
                        routeExamPath,
                        ...(routeExamMeta?.legacyExamIds || []),
                    ].filter(Boolean);

                    const uniqueIds = [...new Set(candidateIds.map(id => id.toLowerCase()))];

                    for (const tryId of uniqueIds) {
                        if (result) break;
                        const canonicalSubjectFolder = (
                            routeExamMeta?.subjectFolder ||
                            stateSubjectFolder ||
                            routeSubjectFolder
                        );
                        const { data, error } = await supabase
                            .from('exam_results')
                            .select('id, exam_id, subject_folder, answers_snapshot, score, correct_count, total_questions, is_scored')
                            .eq('user_id', user.id)
                            .ilike('exam_id', tryId)
                            .eq('subject_folder', canonicalSubjectFolder)
                            .order('submitted_at', { ascending: false })
                            .limit(1)
                            .maybeSingle();
                        if (error) {
                            console.warn(`[ExamResult] Query for exam_id="${tryId}" failed:`, error.message);
                            continue;
                        }
                        result = data;
                    }
                }

                if (!result) {
                    console.warn('[ExamResult] No result found for user', user.id, 'exam', routeExamPath);
                    setLoadError('Bạn chưa có kết quả cho đề thi này. Hãy hoàn thành bài thi trước.');
                    setLoading(false);
                    return;
                }

                console.log('[ExamResult] Found result:', { id: result.id, exam_id: result.exam_id, is_scored: result.is_scored });

                // --- Step 2: Load exam structure ---
                const subjectFolder = result.subject_folder || routeSubjectFolder || stateSubjectFolder;
                const examId = result.exam_id || stateExamId || routeExamPath;
                const examMeta = await resolveCanonicalExamMeta(subjectFolder, routeExamPath || stateExamPath, examId);
                const reviewContentPath = getExamBundlePath(examMeta, routeExamPath || stateExamPath || examId);
                const examBasePath = getExamBasePath(subjectFolder, reviewContentPath);
                let rawExamData;
                try {
                    const examRes = await fetch(`${examBasePath}/exam.json`);
                    rawExamData = examRes.ok ? await examRes.json() : null;
                } catch {
                    rawExamData = null;
                }

                if (!rawExamData) {
                    console.warn('[ExamResult] No local exam.json, using fallback structure');
                    const questionCount = result.total_questions || examMeta?.questions || 28;
                    const mcCount = Math.max(0, questionCount - 10);
                    rawExamData = {
                        title: examMeta?.title || "Đề thi",
                        subject: subjectFolder,
                        time: examMeta?.time || 50,
                        parts: [
                            {
                                id: "part-1",
                                type: "multiple_choice",
                                questions: Array.from({ length: mcCount }, (_, i) => ({ id: `${i + 1}`, type: "single_choice" }))
                            },
                            {
                                id: "part-2",
                                type: "true_false",
                                questions: Array.from({ length: 4 }, (_, i) => ({
                                    id: `${i + 1}`,
                                    type: "true_false",
                                    statements: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }]
                                }))
                            },
                            {
                                id: "part-3",
                                type: "short_answer",
                                questions: Array.from({ length: 6 }, (_, i) => ({ id: `${i + 1}`, type: "short_answer" }))
                            }
                        ]
                    };
                }

                // --- Step 3: Load answer key via RPC ---
                let mergedAnswerKey = {};
                let reviewIsScored = Boolean(result.is_scored);

                try {
                    const { data: reviewPayload, error: reviewError } = await supabase.rpc('get_exam_review_payload', {
                        p_result_id: result.id
                    });
                    if (reviewError) throw reviewError;

                    mergedAnswerKey = reviewPayload?.answer_key || {};
                    reviewIsScored = Boolean(reviewPayload?.is_scored || reviewPayload?.has_answer_key || result.is_scored);
                    console.log('[ExamResult] Review payload:', {
                        hasAnswerKey: Object.keys(mergedAnswerKey).length > 0,
                        answerKeyCount: Object.keys(mergedAnswerKey).length,
                        isScored: reviewIsScored,
                        score: reviewPayload?.score,
                    });

                    setAnswers(reviewPayload?.answers_snapshot || result.answers_snapshot || {});
                    setResultMetrics({
                        score: reviewPayload?.score ?? result.score ?? null,
                        correct: reviewPayload?.correct_count ?? result.correct_count ?? null,
                        total: reviewPayload?.total_questions ?? result.total_questions ?? null
                    });
                } catch (rpcError) {
                    console.warn('[ExamResult] RPC get_exam_review_payload failed, using result data:', rpcError?.message);
                    setAnswers(result.answers_snapshot || {});
                    setResultMetrics({
                        score: result.score ?? null,
                        correct: result.correct_count ?? null,
                        total: result.total_questions ?? null
                    });
                }

                // --- Step 4: Assemble final exam data ---
                const publicResources = await getPublicExamResources([examId, routeExamPath, examMeta?.examPath]);
                const canonicalExamData = applyCanonicalExamMetadata({
                    ...rawExamData,
                    answer_key: mergedAnswerKey
                }, examMeta, publicResources, subjectFolder);

                setExamData(normalizeExamMediaPaths(canonicalExamData, examBasePath));
                setServerIsScored(reviewIsScored);
                dataLoadedRef.current = true; // Mark loaded — prevents re-fetch on tab focus
            } catch (error) {
                console.error('[ExamResult] Load review failed:', error?.message, error);
                setLoadError('Không thể tải dữ liệu xem lại bài thi.');
                if (stateIsScored) setServerIsScored(true);
            } finally {
                setLoading(false);
            }
        };

        loadReviewData();
        // user?.id (primitive string) is stable — avoids re-fetch on Supabase token refresh
    }, [routeExamPath, routeSubjectFolder, user?.id]);

    // Load VIP resources from DB (only returned for VIP/Admin by server)
    useEffect(() => {
        const examId = initParamsRef.current.examId || examMeta?.id;
        if (!examId || !user) return;

        supabase.rpc('get_exam_resources', { p_exam_id: examId })
            .then(({ data }) => {
                if (data) setVipResources(data);
            });
    }, [examMeta?.id, user?.id]); // initParamsRef.current.examId is stable


    // Khi mở showReview: lấy URL cho file đáp án. ĐỌC THEO CẤU TRÚC THƯ MỤC TRỰC TIẾP TỪ STORAGE (nhiều files) HOẶC FALLBACK.
    useEffect(() => {
        if (!showReview) return;
        const examId = initParamsRef.current.examId || examMeta?.id;
        
        const fetchFiles = async () => {
            let filesUrls = [];
            
            // Bước 1: Ưu tiên tự động tìm toàn bộ file trong thư mục exam_id từ Storage (đọc cấu trúc bucket)
            if (examId) {
                const { data: bucketFiles } = await supabase.rpc('list_exam_answer_files', { p_exam_id: examId });
                if (bucketFiles && bucketFiles.length > 0) {
                    filesUrls = bucketFiles.map(file => {
                        const { data } = supabase.storage.from('exam-answer-files').getPublicUrl(file.path);
                        return data?.publicUrl;
                    }).filter(Boolean);
                }
            }

            // Bước 2: NẾU thư mục rỗng, fallback về url lưu trong db (vipResources) hoặc local (examData)
            if (filesUrls.length === 0) {
                let rawAnswerUrl = null;
                if (vipResources) {
                    rawAnswerUrl = vipResources.answer_file_url || null;
                } else {
                    rawAnswerUrl = examData?.answer_file_url || examData?.resources?.answer_file_url || null;
                }

                if (rawAnswerUrl) {
                    // Yêu cầu: CHỈ sử dụng Supabase Storage, kiên quyết loại bỏ link Google Drive ở phần Đáp Án
                    // Đợi xử lý: Nếu gặp link Google Drive (đặc biệt là link folder), bỏ qua để tự động rớt xuống hiển thị Đề Thi
                    if (rawAnswerUrl.includes('drive.google.com') || rawAnswerUrl.includes('docs.google.com')) {
                        rawAnswerUrl = null; 
                    } else if (rawAnswerUrl.startsWith('http')) { 
                        filesUrls = [rawAnswerUrl];
                    } else if (rawAnswerUrl.startsWith('/')) {
                        filesUrls = [rawAnswerUrl];
                    } else {
                        const { data } = supabase.storage.from('exam-answer-files').getPublicUrl(rawAnswerUrl);
                        if (data?.publicUrl) filesUrls = [data.publicUrl];
                    }
                }
            }

            // MỚI: Kiểm tra thực tế xem các URL thu thập được có sống hay không
            // Nếu chết (404/Spa Fallback HTML), ta bỏ nó đi để giao diện tự tụt xuống fallback Đề Thi
            if (filesUrls.length > 0) {
                const validUrls = [];
                for (const url of filesUrls) {
                    try {
                        const response = await fetch(url, { method: 'HEAD' });
                        if (response.ok) {
                            const contentType = response.headers.get('content-type');
                            // Loại trừ trường hợp Local Server trả về SPA Index.html
                            if (contentType && contentType.includes('text/html')) {
                                console.warn('[ExamResult] Answer URL returned HTML, ignoring:', url);
                            } else {
                                validUrls.push(url);
                            }
                        } else {
                            console.warn('[ExamResult] Answer URL missing (404/500):', url);
                        }
                    } catch(e) {
                        // Lỗi CORS hoặc Network Error -> Chứng tỏ file bị thiếu/không hợp lệ
                        // Ở đây ta xoá luôn để mở đường rơi xuống fallback Đề Thi
                        console.warn('[ExamResult] Answer URL threw network/CORS error, ignoring:', url);
                    }
                }
                filesUrls = validUrls;
            }

            // Gán giá trị đầu tiên cho logic cũ nếu có component nào còn cần (vẫn gọi setSecureAnswerUrl dùng để tương thích)
            setSecureAnswerUrl(filesUrls[0] || null);
            // Ghi nhận mảng để dùng render component mới (nhiều files)
            setBucketAnswerFiles(filesUrls);
        };
        fetchFiles();
    }, [showReview, vipResources, examData, examMeta?.id]);

    // Khi mở showReview: lấy signed URL cho PDF đề thi (document_url) từ bucket exams (private)
    useEffect(() => {
        if (!showReview) return;
        
        // Find the best document url field using legacy fields fallback
        const resourceSources = [vipResources ? { resources: vipResources } : null, examData, examMeta].filter(Boolean);
        const resolvedSubjectFolder = examMeta?.subjectFolder || routeSubjectFolder || initParamsRef.current.subjectFolder;
        const resolvedExamPath = examMeta?.examPath || initParamsRef.current.examPath || routeExamPath;
        const resolvedContentPath = getExamBundlePath(examMeta, resolvedExamPath);
        const examBasePath = resolvedSubjectFolder && resolvedContentPath
            ? getExamBasePath(resolvedSubjectFolder, resolvedContentPath)
            : null;

        // Ưu tiên đọc từ vipResources (không được nối basePath vì đây là path của DB/Supabase)
        let rawDocUrl = vipResources?.document_url || vipResources?.exam_file_url || null;
        
        if (!rawDocUrl) {
            const rawFromData = pickFirstDefinedValue([examData, examMeta], [
                ['document_url'], ['resources', 'document_url'],
                ...EXAM_RESOURCE_FIELD_PATHS.examFileUrl
            ]);
            
            if (rawFromData) {
                // Nhận diện file từ Supabase Bucket (toan/123.pdf) hay local absolute (/data/...)
                // Các path này thường có dấu '/' bên trong, tránh prefix đúp
                if (rawFromData.startsWith('http') || rawFromData.startsWith('/')) {
                    rawDocUrl = rawFromData;
                } else if (rawFromData.includes('/') && !rawFromData.startsWith('.')) {
                    rawDocUrl = rawFromData; // Supabase bucket path
                } else {
                    rawDocUrl = resolveExamResourceUrl(rawFromData, examBasePath);
                }
            }
        }

        if (!rawDocUrl) { setSecureDocumentUrl(null); return; }
        if (rawDocUrl.startsWith('http')) { setSecureDocumentUrl(rawDocUrl); return; }
        if (rawDocUrl.startsWith('/')) { setSecureDocumentUrl(rawDocUrl); return; }

        // Path tương đối → tạo Signed URL từ bucket exams (private)
        getSecureDocumentUrl(rawDocUrl, 10800).then((url) => {
            setSecureDocumentUrl(url || null);
        });
    }, [showReview, vipResources, examData, examMeta, routeSubjectFolder, routeExamPath]);

    const resolvedSubjectFolder = examMeta?.subjectFolder || routeSubjectFolder || initParamsRef.current.subjectFolder;
    const resolvedExamPath = examMeta?.examPath || initParamsRef.current.examPath || routeExamPath;
    const resolvedContentPath = getExamBundlePath(examMeta, resolvedExamPath);
    const examBasePath = resolvedSubjectFolder && resolvedContentPath
        ? getExamBasePath(resolvedSubjectFolder, resolvedContentPath)
        : null;
    // vipResources from DB takes priority; fallback to examData/examMeta (which won't have sensitive URLs after sync)
    const getSmartUrl = (vipUrl, fallbackFieldPaths) => {
        if (vipUrl) return vipUrl;
        const rawFromData = pickFirstDefinedValue([examData, examMeta], fallbackFieldPaths);
        if (!rawFromData) return null;
        if (rawFromData.startsWith('http') || rawFromData.startsWith('/')) return rawFromData;
        if (rawFromData.includes('/') && !rawFromData.startsWith('.')) return rawFromData; // Supabase bucket path
        return resolveExamResourceUrl(rawFromData, examBasePath);
    };

    const answerFileUrl = getSmartUrl(vipResources?.answer_file_url, EXAM_RESOURCE_FIELD_PATHS.answerFileUrl);
    const examFileUrl = getSmartUrl(vipResources?.document_url || vipResources?.exam_file_url, EXAM_RESOURCE_FIELD_PATHS.examFileUrl);
    const editExamUrl = getSmartUrl(vipResources?.edit_link, EXAM_RESOURCE_FIELD_PATHS.editLinkUrl);
    const videoReviewUrl = getSmartUrl(vipResources?.video_url, EXAM_RESOURCE_FIELD_PATHS.videoReviewUrl);

    const documentResourceUrl = examFileUrl || answerFileUrl;
    const documentResourceLabel = examFileUrl && answerFileUrl
        ? 'Đề và đáp án'
        : examFileUrl
            ? 'Tài liệu đề'
            : 'Folder đề';
    const canOpenEditLink = Boolean(profile?.is_vip);
    const showLockedEditLink = Boolean(editExamUrl) && !canOpenEditLink;
    const isVip = Boolean(profile?.is_vip);
    const scoreSubjectFolder = normalizeSubjectFolder(
        examMeta?.subjectFolder ||
        routeSubjectFolder ||
        location.state?.subjectFolder ||
        resultMetrics?.subjectFolder
    );
    const defaultShortAnswerPoints = getDefaultShortAnswerPoints(scoreSubjectFolder);
                    
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
             <div className="min-h-screen bg-[#f8f6f6] flex flex-col items-center justify-center px-4">
                 <span className="material-symbols-outlined text-5xl text-slate-300 mb-4">assignment_late</span>
                 <h2 className="text-xl font-bold text-slate-700 mb-2">Không tìm thấy kết quả</h2>
                 {loadError && <p className="text-sm text-slate-500 mb-6 text-center max-w-md">{loadError}</p>}
                 <Link to="/exam-room" className="px-6 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors">Quay lại phòng thi</Link>
             </div>
         );
    }

    // 2025 THPTQG Scoring Logic
    let totalScore = 0;
    const DEFAULT_TF_POINTS_LADDER = [0, 0.1, 0.25, 0.5, 1.0];
    const details = {
        part1: { correct: 0, total: 0, score: 0 },
        part2: { correct: 0, total: 0, score: 0 },
        part3: { correct: 0, total: 0, score: 0 }
    };

    examData.parts?.forEach(part => {
        part.questions?.forEach(q => {
             const expectedAnswer = pickQuestionValue(examData.answer_key, part.id, q.id, examData);
             const userAnswer = pickQuestionValue(answers, part.id, q.id, examData);

              if (q.type === 'single_choice') {
                  details.part1.total += 1;
                  const expectedChoiceIndex = toChoiceIndex(expectedAnswer);
                  const userChoiceIndex = toChoiceIndex(userAnswer);
                  if (expectedChoiceIndex !== null && userChoiceIndex === expectedChoiceIndex) {
                      const pts = q.points ?? 0.25;
                      totalScore += pts;
                      details.part1.score += pts;
                      details.part1.correct += 1;
                  }
              } else if (q.type === 'true_false') {
                  details.part2.total += 1;
                  const qAnswers = (userAnswer && typeof userAnswer === 'object') ? userAnswer : {};
                  let correctCount = 0;
                
                 q.statements?.forEach((stmt, idx) => {
                     const expectedStmtAnswer = Array.isArray(expectedAnswer)
                         ? expectedAnswer[idx]
                         : pickStatementValue(expectedAnswer, stmt.id);
                     const userStmtAns = pickStatementValue(qAnswers, stmt.id);
                     if (userStmtAns === expectedStmtAnswer && expectedStmtAnswer !== undefined && expectedStmtAnswer !== null) {
                         correctCount += 1;
                     }
                 });

                 const pointsLadder = Array.isArray(q.points) && q.points.length >= 4
                     ? [0, ...q.points.slice(0, 4)]
                     : DEFAULT_TF_POINTS_LADDER;
                 const earnedPts = correctCount >= 0 && correctCount < pointsLadder.length
                     ? pointsLadder[correctCount]
                     : (correctCount >= pointsLadder.length ? pointsLadder[pointsLadder.length - 1] : 0);
                 totalScore += earnedPts;
                 details.part2.score += earnedPts;
                 if (correctCount === (q.statements?.length || 4)) {
                     details.part2.correct += 1;
                 }
              } else if (q.type === 'short_answer') {
                  details.part3.total += 1;
                  const userAns = String(userAnswer || '').replace(',', '.').trim().toLowerCase();
                  const expectAns = String(expectedAnswer ?? '').replace(',', '.').trim().toLowerCase();
                 
                 if (userAns && userAns === expectAns) {
                     const pts = q.points ?? defaultShortAnswerPoints;
                     totalScore += pts;
                     details.part3.score += pts;
                     details.part3.correct += 1;
                 }
             }
        });
    });

    // answer_key is populated from the RPC call; also trust the server's is_scored flag
    const hasReviewAnswerKey = hasPopulatedAnswerKey(examData.answer_key) || serverIsScored;

    // Ưu tiên điểm tính local (totalScore) khi đã có đáp án để render chi tiết đúng/sai.
    // Điểm server (resultMetrics.score) có thể là 0 cũ (trước khi có đáp án) → chỉ dùng
    // làm fallback khi KHÔNG có đáp án client-side.
    const scoreFromServer = Number(resultMetrics.score);
    const displayScore = hasPopulatedAnswerKey(examData.answer_key)
        ? totalScore                                                // có đáp án → tính local
        : (Number.isFinite(scoreFromServer) && scoreFromServer > 0)
            ? scoreFromServer                                       // server đã chấm trước đó
            : (hasReviewAnswerKey ? totalScore : 0);               // fallback

    const fallbackCorrectCount = Number(resultMetrics.correct ?? 0);
    const fallbackTotalQuestions = Number(resultMetrics.total ?? 0);

    // ============ SPLIT-PANE REVIEW ============
    if (showReview) {
        return (
            <div className="h-screen overflow-hidden bg-[#f8f6f6] font-display flex flex-col">
                {/* Header */}
                <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between z-30 shadow-sm shrink-0">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowReview(false)}
                            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 transition-colors text-slate-600"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div>
                            <h1 className="text-lg font-black text-slate-800 line-clamp-1">{examData.title}</h1>
                            <p className="text-xs text-slate-500 font-medium">Xem lại đáp án chi tiết</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-bold">
                        <span className="w-3 h-3 rounded-full bg-green-500 inline-block"/><span className="text-green-600 hidden sm:inline">Đúng</span>
                        <span className="w-3 h-3 rounded-full bg-red-500 inline-block ml-3"/><span className="text-red-500 hidden sm:inline">Sai</span>
                        <span className="w-3 h-3 rounded-full bg-blue-500 inline-block ml-3"/><span className="text-blue-600 hidden sm:inline">Đáp án đúng</span>
                    </div>
                </header>

                <div className="flex-1 flex flex-row w-full relative overflow-hidden">
                    <div style={{ width: `calc(${reviewLeftWidth}%)` }} className="h-full border-r border-slate-200 bg-slate-900 flex flex-col items-center justify-center overflow-hidden">
                        {(bucketAnswerFiles && bucketAnswerFiles.length > 0) ? (
                            <div className="w-full h-full overflow-y-auto overflow-x-hidden bg-slate-900 flex flex-col items-center py-6 space-y-8 custom-scrollbar">
                                {bucketAnswerFiles.map((fUrl, idx) => (
                                    <div key={idx} className="w-full flex-shrink-0 flex justify-center">
                                        <DocumentRenderer
                                            url={fUrl}
                                            userEmail={user?.email}
                                            userName={profile?.full_name || user?.user_metadata?.full_name}
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : secureAnswerUrl ? (
                            <DocumentRenderer
                                url={secureAnswerUrl}
                                userEmail={user?.email}
                                userName={profile?.full_name || user?.user_metadata?.full_name}
                            />
                        ) : secureDocumentUrl ? (
                            <DocumentRenderer
                                url={secureDocumentUrl}
                                userEmail={user?.email}
                                userName={profile?.full_name || user?.user_metadata?.full_name}
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-4 text-slate-400 p-10 text-center">
                                <span className="material-symbols-outlined text-6xl">description</span>
                                <p className="text-lg font-bold text-slate-300">Chưa có file PDF đề thi</p>
                                <p className="text-sm text-slate-500">File PDF cho đề thi này chưa được tải lên hệ thống.</p>
                            </div>
                        )}
                    </div>

                    {/* Resizer */}
                    <div
                        className="hidden md:flex flex-col items-center justify-center w-3 bg-slate-200/50 hover:bg-red-400 active:bg-red-500 cursor-col-resize transition-colors z-20 shrink-0"
                        onMouseDown={startDrag}
                        onTouchStart={startDrag}
                        title="Kéo để thay đổi độ rộng"
                    >
                        <div className="w-1 h-8 bg-slate-400 rounded-full" />
                    </div>

                    {/* Right Pane – Phiếu trả lời + đáp án */}
                    <div style={{ width: `calc(${100 - reviewLeftWidth}%)`, WebkitOverflowScrolling: 'touch' }} className="h-full bg-[#fcecf0] overflow-y-auto overscroll-y-contain scroll-smooth w-full md:w-auto flex-1">
                        <div className="p-4 md:p-6 space-y-8 pb-20">
                            {examData?.parts?.map((part, partIndex) => {
                                const partLabel = ['I', 'II', 'III'][partIndex] || (partIndex + 1);
                                const partTypeLabel = part.questions[0]?.type === 'single_choice' ? 'Trắc nghiệm nhiều lựa chọn'
                                    : part.questions[0]?.type === 'true_false' ? 'Trắc nghiệm Đúng/Sai'
                                    : 'Trả lời ngắn';

                                return (
                                    <div key={part.id}>
                                        <div className="mb-3 pb-2 border-b-2 border-red-300">
                                            <h2 className="text-sm font-black text-[#fe5f36] uppercase tracking-widest">PHẦN {partLabel} – {partTypeLabel}</h2>
                                        </div>

                                        {/* Part 1: single_choice */}
                                        {part.questions[0]?.type === 'single_choice' && (
                                            <div className="grid grid-cols-1 gap-2">
                                                {part.questions.map((q, qIdx) => {
                                                    const userAns = pickQuestionValue(answers, part.id, q.id, examData);
                                                    const expected = pickQuestionValue(examData.answer_key, part.id, q.id, examData);
                                                    const userIdx = toChoiceIndex(userAns);
                                                    const expIdx = toChoiceIndex(expected);
                                                    const hasKey = expIdx !== null;
                                                    return (
                                                        <div key={q.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
                                                            <span className="w-7 h-7 shrink-0 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-black text-sm">{qIdx + 1}</span>
                                                            <div className="flex gap-2 flex-wrap flex-1">
                                                                {['A','B','C','D'].map((label, idx) => {
                                                                    const isUser = userIdx === idx;
                                                                    const isCorrect = hasKey && expIdx === idx;
                                                                    const isWrong = isUser && hasKey && !isCorrect;
                                                                    let cls = 'w-9 h-9 rounded-lg border-2 flex items-center justify-center font-bold text-sm transition-all ';
                                                                    if (isCorrect) cls += 'bg-green-500 border-green-500 text-white';
                                                                    else if (isWrong) cls += 'bg-red-500 border-red-500 text-white';
                                                                    else if (isUser) cls += 'bg-blue-500 border-blue-500 text-white';
                                                                    else cls += 'bg-white border-slate-200 text-slate-400';
                                                                    return <div key={label} className={cls}>{label}</div>;
                                                                })}
                                                            </div>
                                                            {!hasKey && <span className="text-[10px] text-slate-400 font-bold italic shrink-0 hidden sm:block">Chưa có đáp án</span>}
                                                            {hasKey && userIdx === expIdx && <span className="material-symbols-outlined text-green-500 shrink-0 text-[18px]">check_circle</span>}
                                                            {hasKey && userIdx !== null && userIdx !== expIdx && <span className="material-symbols-outlined text-red-500 shrink-0 text-[18px]">cancel</span>}
                                                            {hasKey && userIdx === null && <span className="material-symbols-outlined text-slate-400 shrink-0 text-[18px]">radio_button_unchecked</span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Part 2: true_false */}
                                        {part.questions[0]?.type === 'true_false' && (
                                            <div className="space-y-3">
                                                {part.questions.map((q, qIdx) => {
                                                    const userAns = pickQuestionValue(answers, part.id, q.id, examData);
                                                    const expected = pickQuestionValue(examData.answer_key, part.id, q.id, examData);
                                                    const stmts = q.statements || [{id:'A'},{id:'B'},{id:'C'},{id:'D'}];
                                                    return (
                                                        <div key={q.id} className="bg-white rounded-xl border border-slate-200 p-3">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="w-7 h-7 shrink-0 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center font-black text-sm">{qIdx + 1}</span>
                                                                <span className="text-xs font-bold text-slate-500">Câu {qIdx + 1} – Đúng / Sai mỗi ý</span>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                {stmts.map((stmt, sIdx) => {
                                                                    const stmtId = normalizeStatementId(stmt.id);
                                                                    const userVal = pickStatementValue(userAns, stmtId);
                                                                    const expVal = Array.isArray(expected) ? expected[sIdx] : pickStatementValue(expected, stmtId);
                                                                    const hasExpected = hasKnownTrueFalseValue(expVal);
                                                                    const correct = hasExpected && userVal === expVal;
                                                                    const wrong = hasExpected && userVal !== undefined && userVal !== expVal;
                                                                    return (
                                                                        <div key={stmt.id} className={`flex items-center gap-2 p-2 rounded-lg border-2 ${correct ? 'bg-green-50 border-green-300' : wrong ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200'}`}>
                                                                            <span className="font-black text-slate-500 w-5">{['a','b','c','d'][sIdx]})</span>
                                                                            <div className="flex flex-col text-xs font-bold">
                                                                                <span className={correct ? 'text-green-600' : wrong ? 'text-red-500' : 'text-slate-500'}>
                                                                                    Bạn: {userVal !== undefined ? formatTrueFalseValue(userVal) : '—'}
                                                                                </span>
                                                                                {hasExpected && <span className="text-blue-600">Đ/A: {formatTrueFalseValue(expVal)}</span>}
                                                                            </div>
                                                                            {correct && <span className="material-symbols-outlined text-green-500 ml-auto text-[16px]">check</span>}
                                                                            {wrong && <span className="material-symbols-outlined text-red-500 ml-auto text-[16px]">close</span>}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Part 3: short_answer */}
                                        {part.questions[0]?.type === 'short_answer' && (
                                            <div className="grid grid-cols-1 gap-2">
                                                {part.questions.map((q, qIdx) => {
                                                    const userAns = pickQuestionValue(answers, part.id, q.id, examData);
                                                    const expected = pickQuestionValue(examData.answer_key, part.id, q.id, examData);
                                                    const userStr = String(userAns || '').replace(',', '.').trim().toLowerCase();
                                                    const expStr = String(expected ?? '').replace(',', '.').trim().toLowerCase();
                                                    const correct = userStr && userStr === expStr;
                                                    const wrong = userStr && expStr && userStr !== expStr;
                                                    return (
                                                        <div key={q.id} className={`bg-white rounded-xl border-2 p-3 flex items-center gap-3 ${correct ? 'border-green-300' : wrong ? 'border-red-300' : 'border-slate-200'}`}>
                                                            <span className="w-7 h-7 shrink-0 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-black text-sm">{qIdx + 1}</span>
                                                            <div className="flex gap-4 flex-1 flex-col sm:flex-row">
                                                                <div className="text-sm">
                                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Bạn trả lời</p>
                                                                    <p className={`font-mono font-black ${correct ? 'text-green-600' : wrong ? 'text-red-500' : 'text-slate-400'}`}>
                                                                        {userAns ? String(userAns).replace('.', ',') : <span className="italic font-normal text-slate-300">Bỏ trống</span>}
                                                                    </p>
                                                                </div>
                                                                {expStr && (
                                                                    <div className="text-sm">
                                                                        <p className="text-[10px] font-bold text-blue-400 uppercase">Đáp án đúng</p>
                                                                        <p className="font-mono font-black text-blue-700">{String(expected).replace('.', ',')}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {correct && <span className="material-symbols-outlined text-green-500 shrink-0 text-[20px]">check_circle</span>}
                                                            {wrong && <span className="material-symbols-outlined text-red-500 shrink-0 text-[20px]">cancel</span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        
                        {/* Tài nguyên VIP */}
                        <div className="mt-8 w-full flex justify-center">
                            <VipResourcePanel
                                documentResourceUrl={documentResourceUrl}
                                documentResourceLabel={documentResourceLabel}
                                videoReviewUrl={videoReviewUrl}
                                isVip={isVip}
                            />
                        </div>

                    </div>
                </div>
            </div>
        );
    }

    // ============ SCORE CARD ============
    return (
        <div className="min-h-screen bg-[#f8f6f6] text-slate-800 font-display py-12 px-4 flex justify-center pb-24">
            <div className="max-w-3xl w-full space-y-8">
                {/* Score Card */}
                <div className="bg-white rounded-3xl p-8 text-center shadow-xl border border-slate-200 relative overflow-hidden flex flex-col pt-16 lg:pt-8 min-h-[400px]">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 blur-3xl rounded-full" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 blur-3xl rounded-full" />
                    
                    <div className="relative z-10 w-full h-full flex flex-col justify-center">
                        <div className="hidden">


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

                        {!hasReviewAnswerKey && (
                            <div className="mb-6 mx-auto max-w-xl w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left">
                                <p className="text-sm font-bold text-amber-700">Đề này chưa có đáp án chuẩn trong database.</p>
                                <p className="mt-1 text-xs font-medium text-amber-700/80">Điểm sẽ được cập nhật tự động khi hệ thống có đáp án. Bạn có thể quay lại xem sau.</p>
                            </div>
                        )}
                        
                        <div className="inline-block p-1 rounded-[2rem] bg-gradient-to-r from-[#fe5f36] to-pink-500 mb-8 mx-auto max-w-[280px] w-full">
                            <div className="bg-white rounded-[1.8rem] px-8 py-8 w-full">
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">
                                    {hasReviewAnswerKey ? 'Điểm tổng kết' : 'Trạng thái'}
                                </p>
                                {hasReviewAnswerKey ? (
                                <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#fe5f36] to-pink-600">
                                    {displayScore.toFixed(2).replace(/\.00$/, '').replace('.', ',')}<span className="text-3xl text-slate-300 ml-2">/10</span>
                                </div>
                                ) : (
                                <div className="text-2xl font-black text-amber-500 animate-pulse">
                                    Chờ chấm điểm
                                </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap justify-center gap-4">
                            {hasPopulatedAnswerKey(examData.answer_key) ? (
                                <>
                                    {details.part1.total > 0 && (
                                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl w-44">
                                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">P.I: Trắc nghiệm</p>
                                            <p className="text-xl font-black text-blue-600">{details.part1.correct}/{details.part1.total} <span className="text-sm text-slate-500 font-medium">câu đúng</span></p>
                                            <p className="text-xs font-bold text-blue-400 mt-1">{details.part1.score.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')} điểm</p>
                                        </div>
                                    )}
                                    {details.part2.total > 0 && (
                                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl w-44">
                                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">P.II: Đúng/Sai</p>
                                            <p className="text-xl font-black text-amber-600">{details.part2.correct}/{details.part2.total} <span className="text-sm text-slate-500 font-medium">câu đúng hết</span></p>
                                            <p className="text-xs font-bold text-amber-400 mt-1">{details.part2.score.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')} điểm</p>
                                        </div>
                                    )}
                                    {details.part3.total > 0 && (
                                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl w-44">
                                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">P.III: Trả lời ngắn</p>
                                            <p className="text-xl font-black text-emerald-600">{details.part3.correct}/{details.part3.total} <span className="text-sm text-slate-500 font-medium">câu đúng</span></p>
                                            <p className="text-xs font-bold text-emerald-400 mt-1">{details.part3.score.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')} điểm</p>
                                        </div>
                                    )}
                                </>
                            ) : !hasReviewAnswerKey ? (
                                <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl min-w-[12rem] text-center">
                                    <p className="text-xs font-bold text-amber-500 uppercase mb-1">Tổng số câu đã làm</p>
                                    <p className="text-xl font-black text-amber-600">{fallbackTotalQuestions > 0 ? fallbackTotalQuestions : Object.keys(answers).length} <span className="text-sm text-slate-500 font-medium">câu</span></p>
                                </div>
                            ) : (
                                fallbackTotalQuestions > 0 && (
                                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl min-w-[12rem]">
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Kết quả lưu</p>
                                        <p className="text-xl font-black text-blue-600">{fallbackCorrectCount}/{fallbackTotalQuestions} <span className="text-sm text-slate-500 font-medium">câu đúng</span></p>
                                    </div>
                                )
                            )}
                        </div>


                        {/* Tài nguyên VIP */}
                        <div className="mt-8 flex justify-center w-full">
                            <VipResourcePanel
                                documentResourceUrl={documentResourceUrl}
                                documentResourceLabel={documentResourceLabel}
                                videoReviewUrl={videoReviewUrl}
                                isVip={isVip}
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-4 justify-center">
                    <button onClick={() => navigate('/exam-room')} className="px-6 sm:px-8 py-3 sm:py-4 rounded-2xl bg-white border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors shadow-sm w-full sm:w-auto">
                        Quay lại danh sách đề
                    </button>
                    <button onClick={() => setShowReview(true)} className="px-6 sm:px-8 py-3 sm:py-4 rounded-2xl bg-slate-900 border-2 border-slate-900 text-white font-bold hover:bg-slate-800 transition-colors shadow-xl shadow-slate-900/20 w-full sm:w-auto">
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
