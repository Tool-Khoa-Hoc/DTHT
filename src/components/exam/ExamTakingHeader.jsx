import React from 'react';
import { useNavigate } from 'react-router-dom';

export const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export default function ExamTakingHeader({ examData, timeLeft }) {
    const navigate = useNavigate();

    return (
        <header className="relative bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between z-30 shadow-sm shrink-0">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => {
                        if (window.confirm('Tiến trình làm bài đã được lưu. Bạn muốn thoát?')) {
                            navigate('/exam-room');
                        }
                    }}
                    className="relative z-50 flex items-center justify-center w-12 h-12 rounded-full hover:bg-slate-100 transition-colors text-slate-600 cursor-pointer active:bg-slate-200"
                >
                    <span className="material-symbols-outlined text-[24px]">arrow_back</span>
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
    );
}
