import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getExamIndex } from '../utils/examIndexCache';
import { normalizeExamTimeMinutes } from '../utils/examTime';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const DEFAULT_EXAM_META = {
    status: 'ongoing',
    color: 'from-[#fe5f36] to-pink-600',
    icon: 'quiz',
    participants: 0
};

const SUBJECT_LABELS = {
    toan: 'Toán học',
    ly: 'Vật lý',
    hoa: 'Hóa học',
    sinh: 'Sinh học',
    van: 'Ngữ văn',
    anh: 'Tiếng Anh',
    su: 'Lịch sử',
    dia: 'Địa lý',
    tin: 'Tin học',
    gdktpl: 'GD KT&PL'
};

const SUBJECT_ICONS = {
    toan: 'calculate',
    ly: 'bolt',
    hoa: 'science',
    sinh: 'biotech',
    van: 'menu_book',
    anh: 'translate',
    su: 'history_edu',
    dia: 'public',
    tin: 'memory',
    gdktpl: 'balance'
};

function getExamHref(exam) {
    const routePath = exam?.examPath || exam?.id;
    const folder = exam?.subjectFolder || exam?.subject;

    if (!folder || !routePath) {
        return null;
    }

    return `/exam/${encodeURIComponent(folder)}/${encodeURIComponent(routePath)}`;
}

function getSubjectKey(exam) {
    return String(exam?.subjectFolder || exam?.subject || '').trim().toLowerCase();
}

function getSubjectLabel(subjectKey) {
    return SUBJECT_LABELS[subjectKey] || String(subjectKey || 'Khác').toUpperCase();
}

function getSubjectIcon(subjectKey) {
    return SUBJECT_ICONS[subjectKey] || 'book_2';
}

function getSafeTitle(exam) {
    return String(exam?.title || exam?.id || 'Đề thi chưa đặt tên').trim();
}

function getDisplayTime(exam) {
    const normalizedTime = normalizeExamTimeMinutes(
        exam?.subjectFolder || exam?.subject,
        exam?.time
    );

    if (normalizedTime !== null) {
        return `${normalizedTime} phút`;
    }

    return exam?.time ? String(exam.time) : '--';
}

function getPhaseLabel(title) {
    const normalized = String(title || '').toLowerCase();

    if (/thi thử/.test(normalized)) return 'Thi thử';
    if (/\bgk\b|giữa kỳ/.test(normalized)) return 'Giữa kỳ';
    if (/\bck\b|cuối kỳ/.test(normalized)) return 'Cuối kỳ';
    if (/chuyên đề/.test(normalized)) return 'Chuyên đề';
    return 'Tổng hợp';
}

function getTermLabel(exam) {
    const source = `${exam?.title || ''} ${exam?.examPath || ''} ${exam?.id || ''}`;
    const semesterMatch = source.match(/\b([12]\d{2})\b/);

    if (semesterMatch?.[1]) {
        return `Học kỳ ${semesterMatch[1]}`;
    }

    return getSubjectLabel(getSubjectKey(exam));
}

function SubjectSidebarItem({ item, active, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full rounded-[22px] border px-4 py-4 text-left transition-all ${
                active
                    ? 'border-transparent bg-gradient-to-r from-[#e36488] to-[#ff7aa2] text-white shadow-[0_16px_32px_rgba(227,100,136,0.2)]'
                    : 'border-[#f0bfd0] bg-white text-[#37203b] hover:border-[#e69db7]'
            }`}
        >
            <div className="flex items-center gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                    active ? 'bg-white/20 text-white' : 'bg-[#fff1f6] text-[#d84f7c]'
                }`}>
                    <span className="material-symbols-outlined text-[22px]">{getSubjectIcon(item.key)}</span>
                </div>
                <div className="min-w-0 flex-1">
                    <p className={`truncate text-[14px] font-black ${active ? 'text-white' : 'text-[#37203b]'}`}>
                        {item.label}
                    </p>
                    <p className={`mt-1 text-[11px] font-semibold ${active ? 'text-white/80' : 'text-slate-500'}`}>
                        {item.count} đề thi
                    </p>
                </div>
                <span className={`material-symbols-outlined text-[22px] ${active ? 'text-white' : 'text-slate-400'}`}>
                    chevron_right
                </span>
            </div>
        </button>
    );
}

function ExamListItem({ exam, onJoin }) {
    const examMeta = { ...DEFAULT_EXAM_META, ...exam };
    const examHref = getExamHref(examMeta);
    const phaseLabel = getPhaseLabel(getSafeTitle(examMeta));

    const actionButtonClass = 'flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#e36488] to-[#ff7aa2] text-white shadow-[0_14px_30px_rgba(227,100,136,0.24)] transition-transform hover:scale-105';

    const action = examMeta.status === 'ongoing' && examHref ? (
        <Link to={examHref} className={actionButtonClass} title="Vào thi">
            <span className="material-symbols-outlined text-[24px]">arrow_outward</span>
        </Link>
    ) : (
        <button type="button" onClick={() => onJoin(examMeta)} className={actionButtonClass} title="Mở đề thi">
            <span className="material-symbols-outlined text-[24px]">arrow_outward</span>
        </button>
    );

    const isCompleted = examMeta.isCompleted;

    return (
        <article className={`rounded-[24px] border px-5 py-5 shadow-[0_14px_38px_rgba(205,124,157,0.08)] transition-all ${
            isCompleted 
                ? 'border-[#f0e4e9] bg-slate-50/50 opacity-80' 
                : 'border-[#ecd3dd] bg-white hover:border-[#e5a9bf]'
        }`}>
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-black leading-snug text-[#2f1731] sm:text-[1.45rem]" title={getSafeTitle(examMeta)}>
                            {getSafeTitle(examMeta)}
                        </h3>
                        {isCompleted && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-600 border border-emerald-200 uppercase tracking-wider">
                                Đã làm
                            </span>
                        )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2.5 text-[13px] text-slate-600">
                        <span className="inline-flex items-center gap-2 font-semibold">
                            <span className="material-symbols-outlined text-[20px] text-[#e36488]">edit_document</span>
                            {getTermLabel(examMeta)}
                        </span>
                        <span className="hidden h-5 w-px bg-[#f0d7e1] sm:block" />
                        <span className="inline-flex items-center gap-2 font-semibold">
                            <span className="material-symbols-outlined text-[20px] text-[#e36488]">description</span>
                            {phaseLabel}
                        </span>
                        <span className="hidden h-5 w-px bg-[#f0d7e1] sm:block" />
                        <span className="inline-flex items-center gap-2 font-semibold">
                            <span className="material-symbols-outlined text-[20px] text-[#e36488]">schedule</span>
                            {getDisplayTime(examMeta)}
                        </span>
                    </div>
                </div>

                <div className="shrink-0">
                    {action}
                </div>
            </div>
        </article>
    );
}

export default function ExamRoom() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [activeSubject, setActiveSubject] = useState('');
    const [exams, setExams] = useState([]);
    const [completedExamIds, setCompletedExamIds] = useState(new Set());
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // Fetch exams and user progress in parallel
                const [examData, progressResult] = await Promise.all([
                    getExamIndex({ forceRefresh: true }),
                    user?.id ? supabase
                        .from('exam_progress')
                        .select('exam_id')
                        .eq('user_id', user.id)
                        .eq('status', 'submitted') : Promise.resolve({ data: [] })
                ]);

                const nextExams = Array.isArray(examData) ? examData : [];
                const nextSubjects = Array.from(new Set(nextExams.map((exam) => getSubjectKey(exam)).filter(Boolean)))
                    .sort((a, b) => getSubjectLabel(a).localeCompare(getSubjectLabel(b), 'vi'));

                const completedIds = new Set((progressResult.data || []).map(p => p.exam_id.toLowerCase()));
                
                setExams(nextExams);
                setCompletedExamIds(completedIds);
                setActiveSubject((current) => current || nextSubjects[0] || '');
            } catch (err) {
                console.error('Failed to load exams', err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [user?.id]);

    const handleJoin = (exam) => {
        const status = exam?.status ?? DEFAULT_EXAM_META.status;

        if (status === 'upcoming') {
            alert('Kỳ thi chưa bắt đầu. Vui lòng quay lại sau!');
            return;
        }
        if (status === 'ended') {
            alert('Kỳ thi đã kết thúc. Bạn có thể xem lại đề trong Thư viện.');
            return;
        }

        const examHref = getExamHref(exam);
        if (!examHref) {
            alert('Đề thi này chưa có đường dẫn hợp lệ.');
            return;
        }

        navigate(examHref);
    };

    const subjectCounts = exams.reduce((acc, exam) => {
        const key = getSubjectKey(exam);
        if (!key) return acc;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    const subjectItems = Object.keys(subjectCounts)
        .sort((a, b) => getSubjectLabel(a).localeCompare(getSubjectLabel(b), 'vi'))
        .map((key) => ({
            key,
            label: getSubjectLabel(key),
            count: subjectCounts[key]
        }));

    const selectedSubject = subjectItems.find((item) => item.key === activeSubject) || null;
    const filteredExams = exams
        .filter((exam) => getSubjectKey(exam) === activeSubject)
        .map(exam => ({
            ...exam,
            isCompleted: (
                completedExamIds.has((exam.id || '').toLowerCase()) ||
                completedExamIds.has((exam.examPath || '').toLowerCase())
            )
        }))
        .sort((a, b) => {
            // Sort by completion status first (not completed first)
            if (a.isCompleted !== b.isCompleted) {
                return a.isCompleted ? 1 : -1;
            }
            // Then sort by title
            return getSafeTitle(a).localeCompare(getSafeTitle(b), 'vi');
        });

    return (
        <div className="min-h-screen bg-[linear-gradient(180deg,#fff9fb_0%,#fff5f8_100%)] text-[#311a34] font-display">
            <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
                    <aside className="lg:sticky lg:top-6">
                        <div className="rounded-[30px] bg-[linear-gradient(180deg,#fff2f7_0%,#ffeaf2_100%)] p-5 shadow-[0_20px_45px_rgba(205,124,157,0.08)]">
                            <p className="text-[1.7rem] font-black tracking-[-0.03em] text-[#2f1731]">Môn học</p>

                            <div className="mt-6 space-y-3">
                                {loading
                                    ? Array.from({ length: 5 }).map((_, index) => (
                                        <div key={`subject_skeleton_${index + 1}`} className="h-[76px] rounded-[22px] bg-white/80 animate-pulse" />
                                    ))
                                    : subjectItems.map((item) => (
                                        <SubjectSidebarItem
                                            key={item.key}
                                            item={item}
                                            active={item.key === activeSubject}
                                            onClick={() => setActiveSubject(item.key)}
                                        />
                                    ))}
                            </div>
                        </div>
                    </aside>

                    <section className="min-w-0">
                        <div className="rounded-[30px] bg-white/90 p-5 shadow-[0_20px_45px_rgba(205,124,157,0.08)] sm:p-6">
                            <div className="mb-6 flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#d84f7c]">
                                        {selectedSubject?.label || 'Danh sách đề thi'}
                                    </p>
                                    <p className="mt-2 text-[1.7rem] font-black tracking-[-0.03em] text-[#2f1731]">
                                        {loading ? 'Đang tải...' : `${filteredExams.length} kết quả`}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {loading ? (
                                    Array.from({ length: 4 }).map((_, index) => (
                                        <div
                                            key={`exam_skeleton_${index + 1}`}
                                            className="rounded-[24px] border border-[#ecd3dd] bg-white p-6 shadow-[0_14px_38px_rgba(205,124,157,0.08)]"
                                        >
                                            <div className="animate-pulse">
                                                <div className="h-8 w-3/4 rounded-xl bg-[#fde8ef]" />
                                                <div className="mt-4 flex gap-3">
                                                    <div className="h-6 w-28 rounded-full bg-[#fff2f6]" />
                                                    <div className="h-6 w-24 rounded-full bg-[#fff2f6]" />
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : filteredExams.length > 0 ? (
                                    filteredExams.map((exam) => (
                                        <ExamListItem
                                            key={`${getSubjectKey(exam)}:${exam?.examPath || exam?.id || getSafeTitle(exam)}`}
                                            exam={exam}
                                            onJoin={handleJoin}
                                        />
                                    ))
                                ) : (
                                    <div className="rounded-[24px] border border-dashed border-[#ebb9ca] bg-[#fff8fb] px-6 py-16 text-center">
                                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#e36488] shadow-sm">
                                            <span className="material-symbols-outlined text-[30px]">folder_off</span>
                                        </div>
                                        <p className="mt-5 text-lg font-black text-[#2f1731]">Chưa có đề thi cho môn này</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
