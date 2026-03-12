import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const EXAMS = [
    {
        id: 'math-2025',
        title: 'Thi Thử Toán THPTQG 2025 Lần 1',
        subject: 'Toán học',
        time: '90 phút',
        questions: 50,
        participants: 1245,
        status: 'ongoing',
        color: 'from-blue-500 to-indigo-600',
        icon: 'functions'
    },
    {
        id: 'phys-2025',
        title: 'Đề VIP Vật Lý - Chống Sai Ngu',
        subject: 'Vật lý',
        time: '50 phút',
        questions: 40,
        participants: 890,
        status: 'upcoming',
        startTime: '20:00 Hôm nay',
        color: 'from-emerald-500 to-teal-600',
        icon: 'architecture'
    },
    {
        id: 'eng-2025',
        title: 'Thi Thử Tiếng Anh Bám Sát Minh Họa',
        subject: 'Tiếng Anh',
        time: '60 phút',
        questions: 50,
        participants: 2100,
        status: 'ongoing',
        color: 'from-rose-500 to-pink-600',
        icon: 'language'
    },
    {
        id: 'chem-2025',
        title: 'Chinh Phục Lý Thuyết Hóa Học',
        subject: 'Hóa học',
        time: '50 phút',
        questions: 40,
        participants: 650,
        status: 'ended',
        color: 'from-amber-500 to-orange-600',
        icon: 'science'
    }
];

export default function ExamRoom() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('all');
    const [activeSubject, setActiveSubject] = useState('all');
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        fetch('/data/exams/list.json')
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

    const handleJoin = (folder, id, status) => {
        if (status === 'upcoming') {
            alert('Kỳ thi chưa bắt đầu. Vui lòng quay lại sau!');
            return;
        }
        if (status === 'ended') {
            alert('Kỳ thi đã kết thúc. Bạn có thể xem lại đề trong Thư viện.');
            return;
        }
        navigate(`/exam/${folder}/${id}`);
    };

    const uniqueSubjects = ['all', ...new Set(exams.map(e => e.subject))];

    return (
        <div className="bg-[#0f080a] text-white min-h-screen font-display relative">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#fe5f36]/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#7f13ec]/10 blur-[120px] rounded-full pointer-events-none" />

            {/* Header */}
            <div className="relative z-10 px-6 py-10 md:py-14 text-center border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
                <div className="inline-flex items-center justify-center p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#fe5f36]/20 to-[#7f13ec]/20 border border-white/10 mb-4 sm:mb-6 shadow-2xl shadow-[#fe5f36]/20">
                    <span className="material-symbols-outlined text-4xl sm:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-[#fe5f36] to-[#7f13ec]">
                        quiz
                    </span>
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mb-3 sm:mb-4 tracking-tight drop-shadow-md">
                    Phòng Thi <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#fe5f36] to-pink-500">Trực Tuyến</span>
                </h1>
                <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto font-medium px-4">
                    Thử sức với các đề thi bám sát cấu trúc thật. Rèn luyện tâm lý phòng thi và đánh giá năng lực bản thân.
                </p>
            </div>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 relative z-10">
                {/* Filters */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
                    <div className="flex bg-white/5 p-1.5 rounded-2xl w-full sm:w-auto overflow-x-auto scrollbar-hide border border-white/5 backdrop-blur-sm shadow-inner">
                        <button onClick={() => setActiveTab('all')} className={`whitespace-nowrap flex-1 sm:flex-none px-5 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${activeTab === 'all' ? 'bg-[#fe5f36] text-white shadow-lg shadow-[#fe5f36]/30 px-6' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>Tất cả trạng thái</button>
                        <button onClick={() => setActiveTab('ongoing')} className={`whitespace-nowrap flex-1 sm:flex-none px-5 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${activeTab === 'ongoing' ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>Đang diễn ra</button>
                        <button onClick={() => setActiveTab('upcoming')} className={`whitespace-nowrap flex-1 sm:flex-none px-5 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${activeTab === 'upcoming' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>Sắp tới</button>
                    </div>

                    <select 
                        value={activeSubject}
                        onChange={(e) => setActiveSubject(e.target.value)}
                        className="w-full sm:w-auto bg-[#1a0f12]/80 border border-white/10 text-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:border-[#fe5f36] focus:ring-1 focus:ring-[#fe5f36] transition-colors"
                    >
                        {uniqueSubjects.map(subject => (
                            <option key={subject} value={subject}>
                                {subject === 'all' ? 'Tất cả môn học' : subject}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Exam Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-6">
                    {loading ? (
                         <div className="col-span-full py-12 text-center text-slate-400">Đang tải danh sách đề thi...</div>
                    ) : exams
                        .filter(e => activeTab === 'all' || e.status === activeTab)
                        .filter(e => activeSubject === 'all' || e.subject === activeSubject)
                        .map((exam) => (
                        <div key={exam.id} className="group relative bg-[#1a0f12]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 transition-all duration-300 hover:shadow-2xl hover:shadow-[#fe5f36]/10 hover:-translate-y-1 overflow-hidden flex flex-col sm:flex-row gap-6">
                            
                            {/* Colorful background accent */}
                            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${exam.color} opacity-10 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform duration-500`} />
                            
                            {/* Icon column */}
                            <div className="shrink-0 flex sm:flex-col items-center gap-4 sm:border-r border-white/10 sm:pr-6">
                                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br ${exam.color} shadow-lg text-white`}>
                                    <span className="material-symbols-outlined text-3xl">{exam.icon}</span>
                                </div>
                                
                                {exam.status === 'ongoing' && (
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-400 text-xs font-bold rounded-lg border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.2)]">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                        LIVE
                                    </div>
                                )}
                                {exam.status === 'upcoming' && (
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-400 text-xs font-bold rounded-lg border border-amber-500/20">
                                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                                        Sắp diễn ra
                                    </div>
                                )}
                                {exam.status === 'ended' && (
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-500/10 text-slate-400 text-xs font-bold rounded-lg border border-slate-500/20">
                                        Đã kết thúc
                                    </div>
                                )}
                            </div>

                            {/* Info column */}
                            <div className="flex-1 flex flex-col justify-between">
                                <div>
                                    <h3 className="text-xl font-bold mb-2 text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-slate-300 transition-colors line-clamp-2">
                                        {exam.title}
                                    </h3>
                                    
                                    <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-400 mb-4">
                                        <span className="flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[16px]">menu_book</span>
                                            {exam.subject}
                                        </span>
                                        <span className="w-1 h-1 rounded-full bg-slate-600" />
                                        <span className="flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[16px]">timer</span>
                                            {exam.time}
                                        </span>
                                        <span className="w-1 h-1 rounded-full bg-slate-600" />
                                        <span className="flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[16px]">format_list_numbered</span>
                                            {exam.questions} câu
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="flex -space-x-2">
                                            {[1,2,3].map(i => (
                                              <img key={i} src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${exam.id}${i}`} className="w-7 h-7 rounded-full border border-[#1a0f12] bg-slate-800" alt="avatar" />
                                            ))}
                                        </div>
                                        <span className="text-xs font-medium text-slate-400">+{exam.participants} thí sinh</span>
                                    </div>

                                    <button 
                                        onClick={() => handleJoin(exam.subjectFolder, exam.id, exam.status)}
                                        className={`shrink-0 px-6 py-2.5 rounded-xl font-bold text-sm transition-all focus:ring-2 focus:outline-none flex items-center justify-center gap-2 ${
                                            exam.status === 'ongoing' 
                                                ? 'bg-gradient-to-r from-[#fe5f36] to-pink-600 text-white hover:shadow-lg hover:shadow-[#fe5f36]/30 hover:scale-[1.02] active:scale-95 focus:ring-[#fe5f36]/50' 
                                                : exam.status === 'upcoming'
                                                    ? 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white focus:ring-white/20'
                                                    : 'bg-transparent text-slate-500 hover:text-slate-300 border border-white/5 hover:bg-white/5 focus:ring-white/10'
                                        }`}
                                    >
                                        {exam.status === 'ongoing' ? 'VÀO THI NGAY' : exam.status === 'upcoming' ? 'ĐẶT LỊCH' : 'XEM LẠI'}
                                        {exam.status === 'ongoing' && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
