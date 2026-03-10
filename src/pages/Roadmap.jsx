import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Roadmap() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();

    // Modes: 'student' (Học sinh) | 'university' (Sinh viên)
    const [mode, setMode] = useState('student');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // University Settings
    const [creditsPerSemester, setCreditsPerSemester] = useState(18);
    const subjectCount = Math.round(creditsPerSemester / 3);

    // High School Settings
    const [targetTHPT, setTargetTHPT] = useState(24);
    const [targetDGNL, setTargetDGNL] = useState(850);

    useEffect(() => {
        if (profile) {
            setMode(profile.user_mode || 'student');
            setTargetTHPT(profile.target_thpt || 24);
            setTargetDGNL(profile.target_dgnl || null);
        }
    }, [profile]);

    const handleSaveSettings = async (quiet = false) => {
        if (quiet !== true) setIsSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    user_mode: mode,
                    target_thpt: targetTHPT,
                    target_dgnl: targetDGNL || null
                })
                .eq('id', user.id);
            if (error) throw error;
            if (quiet !== true) {
                setIsSettingsOpen(false);
                window.location.reload();
            }
        } catch (err) {
            if (quiet !== true) alert('Lỗi lưu cài đặt: ' + err.message);
        } finally {
            if (quiet !== true) setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f7f6f8] dark:bg-[#191022] font-display text-slate-900 dark:text-slate-100 pb-24 overflow-x-hidden">
            {/* Background Accents */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-[10%] -left-[20%] w-[80%] h-[40%] bg-[#7f13ec]/20 blur-[120px] rounded-full"></div>
                <div className="absolute top-[40%] -right-[10%] w-[60%] h-[30%] bg-blue-500/10 blur-[100px] rounded-full"></div>
            </div>

            {/* Header Section */}
            <header className="sticky top-0 z-30 flex items-center justify-center bg-white/10 dark:bg-[#191022]/80 backdrop-blur-md">
                <div className="w-full max-w-4xl px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border-2 border-[#7f13ec]/30 overflow-hidden bg-slate-200 dark:bg-slate-800">
                            <img
                                className="w-full h-full object-cover"
                                src={user?.user_metadata?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'}
                                alt="Profile"
                            />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold leading-none">Lộ trình của bạn</h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Đấu Trường Học Tập • {mode === 'student' ? 'Học sinh THPT' : 'Sinh viên'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-[#7f13ec]/10 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#7f13ec]/20 transition-colors"
                    >
                        <span className="material-symbols-outlined">settings</span>
                    </button>
                </div>
            </header>

            <main className="w-full max-w-4xl mx-auto flex flex-col gap-6 px-4 sm:px-6 pt-6">

                {/* Mode Switcher */}
                <div className="flex bg-slate-200/50 dark:bg-[#1a0f12] p-1 rounded-xl w-full max-w-xs mx-auto mb-2 border border-slate-300/50 dark:border-white/5">
                    <button
                        onClick={() => setMode('student')}
                        className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${mode === 'student' ? 'bg-white dark:bg-[#2a1a1f] shadow-sm text-[#7f13ec]' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">backpack</span> Học Sinh
                    </button>
                    <button
                        onClick={() => setMode('university')}
                        className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${mode === 'university' ? 'bg-white dark:bg-[#2a1a1f] shadow-sm text-[#7f13ec]' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">school</span> Sinh Viên
                    </button>
                </div>

                {/* Overview Banner (Glassmorphism) */}
                <section className="relative z-10">
                    <div className="relative overflow-hidden p-6 rounded-2xl bg-white/40 dark:bg-[#7f13ec]/10 border border-white/20 dark:border-[#7f13ec]/20 backdrop-blur-xl shadow-xl">
                        <div className="flex items-center justify-between">
                            <div className="space-y-4">
                                <div>
                                    <p className="text-[#7f13ec] font-semibold text-sm uppercase tracking-wider">Tiến độ phấn đấu</p>
                                    <h2 className="text-3xl font-bold mt-1 text-slate-800 dark:text-white">
                                        {mode === 'student' ? 'Thi Đại Học' : 'Tốt Nghiệp 4.0'}
                                    </h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    {mode === 'student' ? (
                                        <>
                                            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#7f13ec]/10 border border-[#7f13ec]/30 transition-colors focus-within:border-[#7f13ec] focus-within:bg-[#7f13ec]/20">
                                                <span className="material-symbols-outlined text-sm text-[#7f13ec] mr-1">menu_book</span>
                                                <span className="text-sm font-bold text-[#7f13ec]">THPT:</span>
                                                <input
                                                    type="number"
                                                    className="w-12 bg-transparent outline-none text-sm font-bold text-[#7f13ec] text-center"
                                                    value={targetTHPT}
                                                    onChange={(e) => setTargetTHPT(e.target.value)}
                                                    onBlur={() => handleSaveSettings(true)}
                                                    step="0.01"
                                                />
                                                <span className="text-sm font-bold text-[#7f13ec]">đ</span>
                                            </div>
                                            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 transition-colors focus-within:border-blue-500 focus-within:bg-blue-500/20">
                                                <span className="material-symbols-outlined text-sm text-blue-500 mr-1">psychology</span>
                                                <span className="text-sm font-bold text-blue-500">ĐGNL:</span>
                                                <input
                                                    type="number"
                                                    className="w-12 bg-transparent outline-none text-sm font-bold text-blue-500 text-center"
                                                    value={targetDGNL || ''}
                                                    onChange={(e) => setTargetDGNL(e.target.value)}
                                                    onBlur={() => handleSaveSettings(true)}
                                                    placeholder="0"
                                                />
                                                <span className="text-sm font-bold text-blue-500">đ</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#7f13ec]/20 border border-[#7f13ec]/30 w-fit">
                                            <span className="material-symbols-outlined text-sm text-[#7f13ec]">grade</span>
                                            <span className="text-sm font-medium">GPA hiện tại: 3.8/4.0</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Progress Ring */}
                            <div className="relative w-24 h-24 shrink-0 hidden sm:block">
                                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                    <circle className="stroke-slate-200 dark:stroke-[#7f13ec]/20" cx="18" cy="18" fill="none" r="16" strokeWidth="3"></circle>
                                    <circle className="stroke-[#7f13ec]" cx="18" cy="18" fill="none" r="16" strokeDasharray="100" strokeDashoffset={mode === 'student' ? "40" : "55"} strokeLinecap="round" strokeWidth="3"></circle>
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="font-bold text-[#7f13ec] text-xl">{mode === 'student' ? '60%' : '45%'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-col sm:flex-row gap-3">
                            <button onClick={() => navigate(mode === 'student' ? '/schools' : '/gpa')} className="flex-1 py-3 bg-[#7f13ec] text-white font-bold rounded-xl shadow-lg shadow-[#7f13ec]/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-[#6b0fce]">
                                <span className="material-symbols-outlined">{mode === 'student' ? 'search' : 'calculate'}</span>
                                {mode === 'student' ? 'Tìm trường phù hợp' : 'Tính điểm GPA'}
                            </button>
                        </div>
                    </div>
                </section>

                {/* Timeline Section */}
                <section className="relative z-10 mt-2 bg-white/50 dark:bg-[#201216]/50 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-800 dark:text-white border-b border-slate-200 dark:border-white/10 pb-4">
                        <span className="material-symbols-outlined text-[#7f13ec]">hotel_class</span>
                        {mode === 'student' ? 'Hành trình 3 năm THPT' : 'Chặng đường Đại học'}
                    </h3>

                    <div className="space-y-0 pt-2">
                        {mode === 'student' ? (
                            <>
                                {/* Milestone: Done */}
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-10 rounded-full bg-[#7f13ec] text-white flex items-center justify-center z-10 shadow-[0_0_15px_rgba(127,19,236,0.5)]">
                                            <span className="material-symbols-outlined">done_all</span>
                                        </div>
                                        <div className="w-1 h-full bg-[#7f13ec]"></div>
                                    </div>
                                    <div className="pb-10 flex-1">
                                        <div className="p-5 rounded-xl bg-white dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 shadow-sm">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-lg text-slate-900 dark:text-white">Lớp 10 - Nền tảng</h4>
                                                <span className="text-[10px] font-bold px-2 py-1 rounded bg-green-500/20 text-green-600 dark:text-green-400 uppercase tracking-tighter">Hoàn thành</span>
                                            </div>
                                            <p className="text-sm text-slate-500">Làm quen môi trường THPT, định hình khối thi cơ bản.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Milestone: In Progress */}
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center z-10 shadow-[0_0_15px_rgba(245,158,11,0.5)] relative">
                                            <span className="material-symbols-outlined animate-pulse">model_training</span>
                                        </div>
                                        <div className="w-1 h-full bg-slate-200 dark:bg-slate-700" style={{ backgroundImage: 'linear-gradient(to bottom, #f59e0b 50%, transparent 50%)', backgroundSize: '1px 12px' }}></div>
                                    </div>
                                    <div className="pb-10 flex-1">
                                        <div className="p-5 rounded-xl bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-400/50 shadow-md">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-lg text-amber-700 dark:text-amber-500">Lớp 11 - Tăng tốc</h4>
                                                <span className="text-[10px] font-bold px-2 py-1 rounded bg-amber-500/20 text-amber-600 dark:text-amber-500 uppercase tracking-tighter animate-pulse border border-amber-500/30">
                                                    Đang thực hiện
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Hoàn tất 80% kiến thức nền tảng, làm đề thi ĐGNL lứa sớm.</p>
                                            <div className="h-2.5 w-full bg-amber-200 dark:bg-amber-900/40 rounded-full overflow-hidden">
                                                <div className="h-full bg-amber-500 rounded-full" style={{ width: '60%' }}></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Milestone: Locked */}
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-slate-400 flex items-center justify-center z-10">
                                            <span className="material-symbols-outlined">lock</span>
                                        </div>
                                        <div className="w-0.5 h-16 bg-transparent"></div>
                                    </div>
                                    <div className="pb-6 flex-1 opacity-60">
                                        <div className="p-5 rounded-xl bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/5">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-slate-500 dark:text-slate-400">Lớp 12 - Thực chiến kì thi</h4>
                                                <span className="material-symbols-outlined text-slate-400 text-sm">lock</span>
                                            </div>
                                            <p className="text-sm text-slate-400 dark:text-slate-500">Luyện đề 100%. Mục tiêu đạt {targetTHPT} điểm THPT Quốc Gia.</p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Milestone: Done */}
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-10 rounded-full bg-[#7f13ec] text-white flex items-center justify-center z-10 shadow-[0_0_15px_rgba(127,19,236,0.5)]">
                                            <span className="material-symbols-outlined">check_circle</span>
                                        </div>
                                        <div className="w-1 h-full bg-[#7f13ec]"></div>
                                    </div>
                                    <div className="pb-10 flex-1">
                                        <div className="p-5 rounded-xl bg-white dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 shadow-sm">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-lg text-slate-900 dark:text-white">Học kỳ 1 - Năm 1</h4>
                                                <span className="text-[10px] font-bold px-2 py-1 rounded bg-green-500/20 text-green-600 dark:text-green-400 uppercase tracking-tighter">Hoàn thành</span>
                                            </div>
                                            <p className="text-sm text-slate-500">{subjectCount} môn học | {creditsPerSemester} tín chỉ</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Milestone: In Progress */}
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-10 rounded-full bg-[#7f13ec]/20 border-2 border-[#7f13ec] flex items-center justify-center z-10 relative">
                                            <div className="w-3 h-3 bg-[#7f13ec] rounded-full animate-pulse"></div>
                                        </div>
                                        <div className="w-1 h-full bg-slate-200 dark:bg-slate-700" style={{ backgroundImage: 'linear-gradient(to bottom, #7f13ec 50%, transparent 50%)', backgroundSize: '1px 12px' }}></div>
                                    </div>
                                    <div className="pb-10 flex-1">
                                        <div className="p-5 rounded-xl bg-purple-50 dark:bg-purple-900/10 border-2 border-[#7f13ec]/40 shadow-md">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-lg text-[#7f13ec] dark:text-[#a855f7]">Học kỳ 2 - Năm 1</h4>
                                                <span className="text-[10px] font-bold px-2 py-1 rounded bg-[#7f13ec]/20 text-[#7f13ec] dark:text-[#a855f7] uppercase tracking-tighter animate-pulse border border-[#7f13ec]/30">Đang thực hiện</span>
                                            </div>
                                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{subjectCount} môn học | {creditsPerSemester} tín chỉ</p>
                                            <div className="h-2.5 w-full bg-purple-200 dark:bg-purple-900/40 rounded-full overflow-hidden">
                                                <div className="h-full bg-[#7f13ec] rounded-full" style={{ width: '35%' }}></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Milestone: Locked */}
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-slate-400 flex items-center justify-center z-10">
                                            <span className="material-symbols-outlined">lock</span>
                                        </div>
                                        <div className="w-0.5 h-16 bg-transparent"></div>
                                    </div>
                                    <div className="pb-6 flex-1 opacity-60">
                                        <div className="p-5 rounded-xl bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/5">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-slate-500 dark:text-slate-400">Học kỳ 1 - Năm 2</h4>
                                                <span className="material-symbols-outlined text-slate-400 text-sm">lock</span>
                                            </div>
                                            <p className="text-sm text-slate-400 dark:text-slate-500">Dự kiến: {subjectCount} môn | {creditsPerSemester} tín chỉ</p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </section>

            </main>

            {/* Settings Modal */}
            {isSettingsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
                    <div className="bg-white dark:bg-[#191022] rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-[#7f13ec]">
                                <span className="material-symbols-outlined">tune</span> Cài đặt lộ trình
                            </h3>
                            <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/5 rounded-full w-8 h-8 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                        </div>

                        <div className="space-y-6">
                            {mode === 'student' ? (
                                <>
                                    <div className="p-5 bg-slate-50 dark:bg-[#1a0f12] rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
                                        <label className="block text-sm font-bold mb-3 text-slate-700 dark:text-slate-200 flex items-center justify-between">
                                            <span>Mục tiêu điểm thi THPT</span>
                                            <span className="font-black text-xl text-[#7f13ec]">{targetTHPT}đ</span>
                                        </label>
                                        <input
                                            type="range"
                                            min="15"
                                            max="30"
                                            step="0.25"
                                            value={targetTHPT}
                                            onChange={(e) => setTargetTHPT(Number(e.target.value))}
                                            className="w-full accent-[#7f13ec]"
                                        />
                                    </div>
                                    <div className="p-5 bg-slate-50 dark:bg-[#1a0f12] rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
                                        <label className="block text-sm font-bold mb-3 text-slate-700 dark:text-slate-200 flex items-center justify-between">
                                            <span>Mục tiêu Đánh giá năng lực</span>
                                            <span className="font-black text-xl text-[#7f13ec]">{targetDGNL}đ</span>
                                        </label>
                                        <input
                                            type="range"
                                            min="500"
                                            max="1200"
                                            step="10"
                                            value={targetDGNL}
                                            onChange={(e) => setTargetDGNL(Number(e.target.value))}
                                            className="w-full accent-[#7f13ec]"
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="p-5 bg-slate-50 dark:bg-[#1a0f12] rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
                                    <label className="block text-sm font-bold mb-3 text-slate-700 dark:text-slate-200 flex items-center justify-between">
                                        <span>Số tín chỉ mục tiêu / kỳ</span>
                                        <span className="font-black text-xl text-[#7f13ec]">{creditsPerSemester}TC</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="10"
                                        max="25"
                                        value={creditsPerSemester}
                                        onChange={(e) => setCreditsPerSemester(Number(e.target.value))}
                                        className="w-full accent-[#7f13ec]"
                                    />
                                    <p className="text-sm text-slate-500 mt-4 font-medium flex items-center gap-2">
                                        <span className="material-symbols-outlined text-amber-500 text-[18px]">lightbulb</span>
                                        Hệ thống sẽ dự kiến phân bổ khoảng <b>{subjectCount} môn học</b> mỗi kỳ.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="mt-8 flex gap-3">
                            <button onClick={() => setIsSettingsOpen(false)} className="flex-1 py-3 bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-white/20 transition-colors">
                                Hủy bỏ
                            </button>
                            <button
                                onClick={handleSaveSettings}
                                disabled={isSaving}
                                className="flex-1 py-3 bg-[#7f13ec] text-white font-bold rounded-xl shadow-lg shadow-[#7f13ec]/30 hover:bg-[#6b0fce] transition-colors flex justify-center items-center gap-2 disabled:opacity-70"
                            >
                                <span className="material-symbols-outlined text-[18px]">save</span>
                                {isSaving ? 'Đang lưu...' : 'Lưu kết quả'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
