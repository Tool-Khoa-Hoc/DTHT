import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getExamIndex } from '../utils/examIndexCache';

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

const SUBJECT_LABELS = {
    'toan': 'Toán Học',
    'ly': 'Vật Lý',
    'hoa': 'Hóa Học',
    'sinh': 'Sinh Học',
    'van': 'Ngữ Văn',
    'anh': 'Tiếng Anh',
    'su': 'Lịch Sử',
    'dia': 'Địa Lý',
    'tin': 'Tin Học',
    'gdktpl': 'GD KT&PL'
};

function useDraggableScroll() {
  const ref = React.useRef(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragged, setDragged] = React.useState(false);
  const startX = React.useRef(0);
  const scrollLeft = React.useRef(0);

  const onMouseDown = React.useCallback((e) => {
    if (!ref.current) return;
    setIsDragging(true);
    setDragged(false);
    startX.current = e.pageX - ref.current.offsetLeft;
    scrollLeft.current = ref.current.scrollLeft;
  }, []);

  const onMouseLeave = React.useCallback(() => setIsDragging(false), []);
  const onMouseUp = React.useCallback(() => setIsDragging(false), []);

  const onMouseMove = React.useCallback((e) => {
    if (!isDragging || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    if (Math.abs(x - startX.current) > 3) {
      setDragged(true);
    }
    ref.current.scrollLeft = scrollLeft.current - (x - startX.current) * 2;
  }, [isDragging]);

  return {
    events: {
      ref,
      onMouseDown,
      onMouseLeave,
      onMouseUp,
      onMouseMove
    },
    dragged,
    isDragging
  };
}

function ExamCard({ exam, onJoin }) {
    const examMeta = { ...DEFAULT_EXAM_META, ...exam };
    const examHref = getExamHref(examMeta);
    const isOngoing = examMeta.status === 'ongoing';
    const displayQuestionCount = Number.isFinite(Number(examMeta.questions)) ? Number(examMeta.questions) : '?';
    const displayTime = Number.isFinite(Number(examMeta.time))
        ? `${Number(examMeta.time)} phút`
        : (examMeta.time || '--');

    // Fix for the title where it shouldn't just be uppercase THPT
    let displayTitle = examMeta.title;
    if (examMeta.subject) {
        displayTitle = displayTitle.replace(/TSA/gi, `${examMeta.subject.toUpperCase()} THPT`);
    }
    const displayBadge = examMeta.subject ? `${examMeta.subject.toUpperCase()} THPT` : 'ĐÁNH GIÁ NĂNG LỰC';

    const bgImage = (examMeta.subject && examMeta.subject.toLowerCase() === 'sinh') ? '/y.png' : '/bk.png';

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
        <article className="group relative bg-[#1a0f12]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 transition-all duration-300 hover:shadow-2xl hover:shadow-[#4f46e5]/10 hover:-translate-y-1 overflow-hidden min-h-[260px] h-full flex flex-col">
            <div className="relative -mx-4 -mt-4 mb-3 shrink-0 h-28 overflow-hidden">
                <img src={bgImage} alt="Background" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            </div>

            <div className="flex flex-col flex-1 min-h-0">
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

                <h3
                    className="text-[13px] md:text-sm font-bold text-white leading-snug group-hover:text-[#4f46e5] transition-colors mb-2 line-clamp-3 min-h-[2.5rem]"
                    title={displayTitle}
                >
                    {displayTitle}
                </h3>

                <div className="flex items-center justify-between bg-white/5 rounded-xl p-2 mb-3 mt-auto border border-white/5">
                    <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                            <span className="material-symbols-outlined text-[12px]">help</span>
                        </div>
                        <div className="leading-tight">
                            <div className="text-[9px] text-slate-400">Câu hỏi</div>
                            <div className="font-bold text-[10px] text-slate-200">{displayQuestionCount} câu</div>
                        </div>
                    </div>
                    <div className="w-px h-6 bg-white/10"></div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 shrink-0">
                            <span className="material-symbols-outlined text-[12px]">schedule</span>
                        </div>
                        <div className="leading-tight">
                            <div className="text-[9px] text-slate-400">Thời gian</div>
                            <div className="font-bold text-[10px] text-slate-200">{displayTime}</div>
                        </div>
                    </div>
                </div>

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
                            onClick={() => onJoin(examMeta)}
                            className={`flex-1 h-9 rounded-xl font-bold text-xs transition-all flex items-center justify-center ${actionClass}`}
                        >
                            {actionLabel}
                        </button>
                    )}
                </div>
            </div>
        </article>
    );
}

function ExamRow({ subject, exams, onJoin, searchQuery }) {
    const scroll = useDraggableScroll();
    const [showAll, setShowAll] = useState(false);
    
    const filteredExams = exams
        .filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));

    if (filteredExams.length === 0) return null;

    const subjectLabel = SUBJECT_LABELS[subject] || subject.toUpperCase();
    const MAX_EXAMS = 10;
    const displayedExams = showAll ? filteredExams : filteredExams.slice(0, MAX_EXAMS);

    return (
        <div className="mb-10">
            <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#fe5f36]/20 to-[#7f13ec]/20 flex items-center justify-center border border-white/10">
                        <span className="material-symbols-outlined text-transparent bg-clip-text bg-gradient-to-r from-[#fe5f36] to-[#7f13ec] text-sm">
                            school
                        </span>
                    </div>
                    <h2 className="text-xl font-black text-white tracking-tight">{subjectLabel}</h2>
                    <span className="ml-2 text-xs font-bold text-slate-500 bg-white/5 px-2 py-1 rounded-full">{filteredExams.length} Đề thi</span>
                </div>
                
                {filteredExams.length > MAX_EXAMS && (
                    <button 
                        onClick={() => setShowAll(!showAll)}
                        className="flex items-center gap-1 text-sm font-bold text-[#4f46e5] hover:text-[#6366f1] transition-colors bg-[#4f46e5]/10 px-3 py-1.5 rounded-xl"
                    >
                        {showAll ? 'Rút gọn' : 'Xem tất cả'}
                        <span className="material-symbols-outlined text-[16px]">
                            {showAll ? 'keyboard_double_arrow_left' : 'keyboard_double_arrow_right'}
                        </span>
                    </button>
                )}
            </div>
            
            <div 
                {...(!showAll ? scroll.events : {})}
                onClickCapture={(e) => {
                    if (!showAll && scroll.dragged) {
                        e.stopPropagation();
                        e.preventDefault();
                    }
                }}
                className={
                    showAll 
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4 px-1" 
                    : `flex gap-4 overflow-x-auto no-scrollbar pb-4 px-1 ${scroll.isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`
                }
            >
                {displayedExams.map(exam => (
                    <div key={exam.id} className={showAll ? "h-full" : "w-[280px] sm:w-[300px] shrink-0"}>
                        <ExamCard exam={exam} onJoin={onJoin} />
                    </div>
                ))}
                
                {!showAll && filteredExams.length > MAX_EXAMS && (
                    <div className="w-[200px] sm:w-[220px] shrink-0 flex items-center justify-center p-4">
                        <button
                            onClick={() => setShowAll(true)}
                            className="flex flex-col items-center justify-center gap-3 w-full h-[60%] rounded-2xl border-2 border-dashed border-white/10 text-slate-400 hover:text-white hover:border-[#4f46e5]/50 hover:bg-[#4f46e5]/10 transition-all group"
                        >
                            <div className="w-12 h-12 rounded-full bg-white/5 group-hover:bg-[#4f46e5]/20 flex items-center justify-center transition-colors">
                                <span className="material-symbols-outlined text-2xl group-hover:translate-x-1 transition-transform">
                                    arrow_forward
                                </span>
                            </div>
                            <span className="font-bold text-sm">Xem thêm {filteredExams.length - MAX_EXAMS} đề</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ExamRoom() {
    const navigate = useNavigate();
    const [activeSubject, setActiveSubject] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const filterScroll = useDraggableScroll();

    React.useEffect(() => {
        getExamIndex({ forceRefresh: true })
            .then((data) => {
                setExams(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch((err) => {
                console.error('Failed to load exams', err);
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

            <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
                {/* Filters & Search */}
                <div className="flex flex-col gap-4 mb-8">
                    <div className="relative w-full sm:max-w-md group">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#fe5f36] transition-colors">
                            search
                        </span>
                        <input
                            type="text"
                            placeholder="Tìm kiếm tên đề thi..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 backdrop-blur-md border border-white/10 text-slate-200 rounded-xl pl-12 pr-4 py-2.5 text-sm font-medium focus:outline-none focus:border-[#fe5f36] focus:ring-1 focus:ring-[#fe5f36] transition-all placeholder:text-slate-600 shadow-sm"
                        />
                    </div>
                    
                    <div 
                        {...filterScroll.events}
                        onClickCapture={(e) => {
                            if (filterScroll.dragged) {
                                e.stopPropagation();
                                e.preventDefault();
                            }
                        }}
                        className={`flex gap-2 p-1 overflow-x-auto no-scrollbar ${filterScroll.isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
                    >
                        {uniqueSubjects.map(subject => {
                            const label = subject === 'all' ? 'Tất cả môn học' : (SUBJECT_LABELS[subject] || subject.toUpperCase());
                            const isActive = activeSubject === subject;
                            return (
                                <button
                                    key={subject}
                                    onClick={() => setActiveSubject(subject)}
                                    className={`shrink-0 px-4 py-1.5 sm:px-5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors ${isActive
                                        ? 'bg-[#4f46e5] text-white shadow-lg shadow-[#4f46e5]/25'
                                        : 'bg-white/5 backdrop-blur-md border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Exam Lists */}
                <div>
                    {loading ? (
                        <div className="py-12 text-center text-slate-400 font-medium">Đang tải danh sách đề thi...</div>
                    ) : (
                        <>
                            {uniqueSubjects.filter(sub => sub !== 'all' && (activeSubject === 'all' || activeSubject === sub)).map(subject => {
                                const subjectExams = exams.filter(e => e.subject === subject);
                                return <ExamRow key={subject} subject={subject} exams={subjectExams} onJoin={handleJoin} searchQuery={searchQuery} />
                            })}
                            
                            {/* Empty state if nothing matches */}
                            {uniqueSubjects.filter(sub => sub !== 'all' && (activeSubject === 'all' || activeSubject === sub)).every(subject => exams.filter(e => e.subject === subject && e.title.toLowerCase().includes(searchQuery.toLowerCase())).length === 0) && (
                                <div className="py-20 text-center">
                                    <div className="inline-flex items-center justify-center size-16 rounded-full bg-white/5 border border-white/10 mb-4">
                                        <span className="material-symbols-outlined text-3xl text-slate-500">search_off</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-2">Không tìm thấy đề thi nào</h3>
                                    <p className="text-slate-400 text-sm max-w-xs mx-auto">Chúng tôi không tìm thấy đề thi nào khớp với từ khóa "{searchQuery}"</p>
                                    <button 
                                        onClick={() => setSearchQuery('')}
                                        className="mt-6 text-[#fe5f36] font-bold text-sm hover:underline"
                                    >
                                        Xóa tìm kiếm
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
                
                <style>{`
                  .no-scrollbar::-webkit-scrollbar { display: none; }
                  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                `}</style>
            </main>
        </div>
    );
}
