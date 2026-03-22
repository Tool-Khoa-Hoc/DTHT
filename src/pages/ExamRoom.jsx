import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const DEFAULT_EXAM_META = {
    status: 'ongoing',
    color: 'from-[#fe5f36] to-pink-600',
    icon: 'quiz',
    participants: 0
};

function getExamHref(exam) {
    const routePath = exam?.examPath || exam?.id;
    const folder = exam?.subjectFolder || exam?.subject;

    if (!folder || !routePath) {
        return null;
    }

    return `/exam/${encodeURIComponent(folder)}/${encodeURIComponent(routePath)}`;
}

export default function ExamRoom() {
    const navigate = useNavigate();
  const [activeSubject, setActiveSubject] = useState('all');
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        fetch('/data/exams/index.json', { cache: 'no-store' })
            .then(res => res.json())
            .then(data => {
                setExams(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load exams", err);
                setLoading(false);
            });
    }, []);

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

    const uniqueSubjects = ['all', ...new Set(exams.map(e => e.subject))];

    return (
        <div className="bg-[#0f080a] text-white min-h-screen font-display relative">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#fe5f36]/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#7f13ec]/10 blur-[120px] rounded-full pointer-events-none" />

            {/* Header */}
            <div className="relative z-10 px-6 py-6 text-center border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
                <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-gradient-to-br from-[#fe5f36]/20 to-[#7f13ec]/20 border border-white/10 mb-3 shadow-2xl shadow-[#fe5f36]/20">
                    <span className="material-symbols-outlined text-2xl text-transparent bg-clip-text bg-gradient-to-r from-[#fe5f36] to-[#7f13ec]">
                        quiz
                    </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black mb-2 tracking-tight drop-shadow-md">
                    Phòng Thi <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#fe5f36] to-pink-500">Trực Tuyến</span>
                </h1>
                <p className="text-[11px] sm:text-xs text-slate-400 max-w-xl mx-auto font-medium px-4">
                    Thử sức với các đề thi bám sát cấu trúc thật. Rèn luyện tâm lý phòng thi và đánh giá năng lực bản thân.
                </p>
            </div>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 relative z-10">
                {/* Filters */}
                <div className="flex items-center justify-end mb-8">
                    <select
                        value={activeSubject}
                        onChange={(e) => setActiveSubject(e.target.value)}
                        className="w-full sm:w-auto bg-[#1a0f12]/80 border border-white/10 text-slate-300 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:border-[#fe5f36] focus:ring-1 focus:ring-[#fe5f36] transition-colors"
                    >
                        {uniqueSubjects.map(subject => (
                            <option key={subject} value={subject}>
                                {subject === 'all' ? 'Tất cả môn học' : subject.toUpperCase()}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Exam Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    {loading ? (
                        <div className="col-span-full py-12 text-center text-slate-400">Đang tải danh sách đề thi...</div>
                    ) : exams
                        .filter(e => activeSubject === 'all' || e.subject === activeSubject)
                        .map((exam) => {
                            const examMeta = { ...DEFAULT_EXAM_META, ...exam };
                            const examHref = getExamHref(examMeta);
                            const isOngoing = examMeta.status === 'ongoing';

                            // Fix for the title where it shouldn't just be uppercase THPT
                            let displayTitle = examMeta.title;
                            if (examMeta.subject) {
                                displayTitle = displayTitle.replace(/TSA/gi, `${examMeta.subject.toUpperCase()} THPT`);
                            }
                            const displayBadge = examMeta.subject ? `${examMeta.subject.toUpperCase()} THPT` : 'ĐÁNH GIÁ NĂNG LỰC';

                            // Specific background image for Biology
                            const bgImage = (examMeta.subject && examMeta.subject.toLowerCase() === 'sinh') ? '/y.png' : '/bk.png';

                            // Calculate generic status properties equivalent to old statusMeta
                            let actionLabel = 'XEM LẠI';
                            let actionClass = 'bg-transparent border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5 focus:ring-white/15';
                            if (examMeta.status === 'ongoing') {
                                actionLabel = 'Bắt đầu thi';
                                actionClass = 'bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-lg shadow-[#4f46e5]/30 border border-[#4f46e5]/50';
                            } else if (examMeta.status === 'upcoming') {
                                actionLabel = 'ĐẶT LỊCH';
                                actionClass = 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white focus:ring-white/20';
                            }

                            return (
                                <article
                                    key={examMeta.id}
                                    className="group relative bg-[#1a0f12]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 transition-all duration-300 hover:shadow-2xl hover:shadow-[#4f46e5]/10 hover:-translate-y-1 overflow-hidden min-h-[260px] flex flex-col"
                                >
                                    {/* Image Section */}
                                    <div className="relative -mx-4 -mt-4 mb-3 shrink-0 h-[35%] overflow-hidden">
                                        <img src={bgImage} alt="Background" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                    </div>

                                    {/* Content Section */}
                                    <div className="flex flex-col flex-1 min-h-0">
                                        {/* Badge & Rating */}
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-1 text-[#4f46e5] bg-[#4f46e5]/10 px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold border border-[#4f46e5]/20">
                                                <span className="material-symbols-outlined text-[12px]">description</span>
                                                <span className="truncate max-w-[120px]">{displayBadge}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-amber-400 text-[10px] font-bold shrink-0">
                                                <span className="material-symbols-outlined text-[12px]">star</span>
                                                4.8
                                            </div>
                                        </div>

                                        {/* Title */}
                                        <h3
                                            className="text-[13px] md:text-sm font-bold text-white leading-snug group-hover:text-[#4f46e5] transition-colors mb-2 line-clamp-3 min-h-[2.5rem]"
                                            title={displayTitle}
                                        >
                                            {displayTitle}
                                        </h3>

                                        {/* Meta Stats */}
                                        <div className="flex items-center justify-between bg-white/5 rounded-xl p-2 mb-3 mt-auto border border-white/5">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                                                    <span className="material-symbols-outlined text-[12px]">help</span>
                                                </div>
                                                <div className="leading-tight">
                                                    <div className="text-[9px] text-slate-400">Câu hỏi</div>
                                                    <div className="font-bold text-[10px] text-slate-200">{examMeta.questions} câu</div>
                                                </div>
                                            </div>
                                            <div className="w-px h-6 bg-white/10"></div>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 shrink-0">
                                                    <span className="material-symbols-outlined text-[12px]">schedule</span>
                                                </div>
                                                <div className="leading-tight">
                                                    <div className="text-[9px] text-slate-400">Thời gian</div>
                                                    <div className="font-bold text-[10px] text-slate-200">{typeof examMeta.time === 'number' ? `${examMeta.time} phút` : examMeta.time}</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 mt-auto">
                                            {isOngoing && examHref ? (
                                                <Link
                                                    to={examHref}
                                                    className={`flex-1 h-9 rounded-xl font-bold text-xs transition-all flex items-center justify-center ${actionClass}`}
                                                >
                                                    {actionLabel}
                                                </Link>
                                            ) : (
                                                <button
                                                    onClick={() => handleJoin(examMeta)}
                                                    className={`flex-1 h-9 rounded-xl font-bold text-xs transition-all flex items-center justify-center ${actionClass}`}
                                                >
                                                    {actionLabel}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            )
                        })}
                </div>
            </main>
        </div>
    );
}
