import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const defaultStudentMilestones = [
    { id: 's1', title: 'Lớp 10 - Nền tảng', subtitle: 'Làm quen môi trường THPT, định hình khối thi cơ bản.', status: 'done', progress: 100 },
    { id: 's2', title: 'Lớp 11 - Tăng tốc', subtitle: 'Hoàn tất 80% kiến thức nền tảng, làm đề thi ĐGNL lứa sớm.', status: 'active', progress: 60 },
    { id: 's3', title: 'Lớp 12 - Thực chiến', subtitle: 'Luyện đề 100%. Mục tiêu đỗ nguyện vọng 1.', status: 'locked', progress: 0 }
];

const defaultUniversityMilestones = [
    { id: 'u1', title: 'Học kỳ 1 - Năm 1', subtitle: 'Môn học đại cương, làm quen môi trường.', status: 'done', progress: 100 },
    { id: 'u2', title: 'Học kỳ 2 - Năm 1', subtitle: 'Bắt đầu học môn cơ sở ngành.', status: 'active', progress: 35 },
    { id: 'u3', title: 'Học kỳ 1 - Năm 2', subtitle: 'Dự kiến học chuyên ngành.', status: 'locked', progress: 0 }
];

export default function Roadmap() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();

    // Modes: 'student' (Học sinh) | 'university' (Sinh viên)
    const [mode, setMode] = useState('student');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Settings
    const [creditsPerSemester, setCreditsPerSemester] = useState(18);
    const subjectCount = Math.round(creditsPerSemester / 3);
    const [targetTHPT, setTargetTHPT] = useState(24);
    const [targetDGNL, setTargetDGNL] = useState(850);

    // Milestones State
    const [milestones, setMilestones] = useState([]);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingMilestone, setEditingMilestone] = useState({ id: '', title: '', subtitle: '', status: 'active', progress: 0 });

    useEffect(() => {
        if (profile) {
            setMode(profile.user_mode || 'student');
            setTargetTHPT(profile.target_thpt || 24);
            setTargetDGNL(profile.target_dgnl || null);
        }
    }, [profile]);

    // Load custom roadmap milestones
    useEffect(() => {
        if (!user) return;
        const storageKey = `roadmap_${user.id}_${mode}`;
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                setMilestones(JSON.parse(saved));
            } catch (e) {
                setMilestones(mode === 'student' ? defaultStudentMilestones : defaultUniversityMilestones);
            }
        } else {
            setMilestones(mode === 'student' ? defaultStudentMilestones : defaultUniversityMilestones);
        }
    }, [user, mode]);

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

    const handleSaveMilestones = (newMilestones) => {
        setMilestones(newMilestones);
        if (user) {
            const storageKey = `roadmap_${user.id}_${mode}`;
            localStorage.setItem(storageKey, JSON.stringify(newMilestones));
        }
    };

    const openEditModal = (milestone = null) => {
        if (milestone) {
            setEditingMilestone({ ...milestone });
        } else {
            setEditingMilestone({ id: Date.now().toString(), title: '', subtitle: '', status: 'active', progress: 0 });
        }
        setIsEditModalOpen(true);
    };

    const saveMilestone = () => {
        if (!editingMilestone.title.trim()) {
            alert("Vui lòng nhập tiêu đề");
            return;
        }
        let updated;
        const index = milestones.findIndex(m => m.id === editingMilestone.id);
        if (index >= 0) {
            updated = [...milestones];
            updated[index] = editingMilestone;
        } else {
            updated = [...milestones, editingMilestone];
        }
        handleSaveMilestones(updated);
        setIsEditModalOpen(false);
    };

    const deleteMilestone = (id) => {
        if (window.confirm("Bạn có chắc chắn muốn xóa mốc này?")) {
            const updated = milestones.filter(m => m.id !== id);
            handleSaveMilestones(updated);
        }
    };
    
    const moveMilestone = (index, direction) => {
        if (direction === 'up' && index > 0) {
            const updated = [...milestones];
            const temp = updated[index];
            updated[index] = updated[index - 1];
            updated[index - 1] = temp;
            handleSaveMilestones(updated);
        } else if (direction === 'down' && index < milestones.length - 1) {
            const updated = [...milestones];
            const temp = updated[index];
            updated[index] = updated[index + 1];
            updated[index + 1] = temp;
            handleSaveMilestones(updated);
        }
    };

    // Calculate overall progress based on milestones
    const overallProgress = milestones.length > 0 
        ? Math.round(milestones.reduce((acc, m) => acc + (m.status === 'done' ? 100 : m.status === 'active' ? (m.progress || 0) : 0), 0) / milestones.length)
        : 0;

    return (
        <div className="min-h-screen bg-[#f7f6f8] dark:bg-[#191022] font-display text-slate-900 dark:text-slate-100 pb-24 overflow-x-hidden">
            {/* Background Accents */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-[10%] -left-[20%] w-[80%] h-[40%] bg-[#7f13ec]/20 blur-[120px] rounded-full"></div>
                <div className="absolute top-[40%] -right-[10%] w-[60%] h-[30%] bg-blue-500/10 blur-[100px] rounded-full"></div>
            </div>

            {/* Header Section */}
            <header className="relative z-30 flex items-center justify-center bg-white/10 dark:bg-[#191022]/80 backdrop-blur-md">
                <div className="w-full max-w-4xl px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border-2 border-[#7f13ec]/30 overflow-hidden bg-slate-200 dark:bg-slate-800">
                            <img className="w-full h-full object-cover" src={user?.user_metadata?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} alt="Profile" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold leading-none">Lộ trình của bạn</h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Đấu Trường Học Tập • Tùy chỉnh cá nhân
                            </p>
                        </div>
                    </div>
                    <button onClick={() => setIsSettingsOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-[#7f13ec]/10 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#7f13ec]/20 transition-colors">
                        <span className="material-symbols-outlined">settings</span>
                    </button>
                </div>
            </header>

            <main className="w-full max-w-4xl mx-auto flex flex-col gap-6 px-4 sm:px-6 pt-6">

                {/* Mode Switcher */}
                <div className="flex bg-slate-200/50 dark:bg-[#1a0f12] p-1 rounded-xl w-full max-w-xs mx-auto mb-2 border border-slate-300/50 dark:border-white/5">
                    <button onClick={() => setMode('student')} className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${mode === 'student' ? 'bg-white dark:bg-[#2a1a1f] shadow-sm text-[#7f13ec]' : 'text-slate-500 hover:text-slate-700'}`}>
                        <span className="material-symbols-outlined text-[18px]">backpack</span> Học Sinh
                    </button>
                    <button onClick={() => setMode('university')} className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${mode === 'university' ? 'bg-white dark:bg-[#2a1a1f] shadow-sm text-[#7f13ec]' : 'text-slate-500 hover:text-slate-700'}`}>
                        <span className="material-symbols-outlined text-[18px]">school</span> Sinh Viên
                    </button>
                </div>

                {/* Overview Banner */}
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
                                            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#7f13ec]/10 border border-[#7f13ec]/30 transition-colors">
                                                <span className="text-sm font-bold text-[#7f13ec]">THPT:</span>
                                                <span className="text-sm font-bold text-[#7f13ec]">{targetTHPT}đ</span>
                                            </div>
                                            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 transition-colors">
                                                <span className="text-sm font-bold text-blue-500">ĐGNL:</span>
                                                <span className="text-sm font-bold text-blue-500">{targetDGNL || 0}đ</span>
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
                                    <circle className="stroke-[#7f13ec]" cx="18" cy="18" fill="none" r="16" strokeDasharray="100" strokeDashoffset={100 - overallProgress} strokeLinecap="round" strokeWidth="3" style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}></circle>
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="font-bold text-[#7f13ec] text-xl">{overallProgress}%</span>
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
                    <div className="flex justify-between items-center mb-6 border-b border-slate-200 dark:border-white/10 pb-4">
                        <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                            <span className="material-symbols-outlined text-[#7f13ec]">hotel_class</span>
                            Lộ trình của tôi
                        </h3>
                        <button onClick={() => openEditModal()} className="flex items-center gap-1 bg-[#7f13ec]/10 text-[#7f13ec] px-3 py-1.5 rounded-lg hover:bg-[#7f13ec]/20 transition-colors font-bold text-sm">
                            <span className="material-symbols-outlined text-[18px]">add</span>
                            Thêm mốc
                        </button>
                    </div>

                    <div className="space-y-0 pt-2">
                        {milestones.length === 0 ? (
                            <div className="text-center py-10 text-slate-500">
                                <span className="material-symbols-outlined text-4xl mb-2">timeline</span>
                                <p>Lộ trình đang trống.</p>
                                <p className="text-sm">Bấm "Thêm mốc" để tự thiết kế mục tiêu của bạn.</p>
                            </div>
                        ) : (
                            milestones.map((m, index) => {
                                const isLast = index === milestones.length - 1;
                                
                                let iconBg, ringColor, lineGrad, cardBg, titleColor, statusBadge, badgeColor;
                                if (m.status === 'done') {
                                    iconBg = 'bg-[#7f13ec] text-white shadow-[0_0_15px_rgba(127,19,236,0.5)]';
                                    lineGrad = 'bg-[#7f13ec]';
                                    cardBg = 'bg-white dark:bg-[#1a0f12] border-slate-200 dark:border-white/10 shadow-sm';
                                    titleColor = 'text-slate-900 dark:text-white';
                                    statusBadge = 'Hoàn thành';
                                    badgeColor = 'bg-green-500/20 text-green-600 dark:text-green-400';
                                } else if (m.status === 'active') {
                                    iconBg = 'bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.5)]';
                                    lineGrad = 'bg-slate-200 dark:bg-slate-700'; // dashed config below
                                    cardBg = 'bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-400/50 shadow-md';
                                    titleColor = 'text-amber-700 dark:text-amber-500';
                                    statusBadge = 'Đang thực hiện';
                                    badgeColor = 'bg-amber-500/20 text-amber-600 dark:text-amber-500 animate-pulse border border-amber-500/30';
                                } else {
                                    iconBg = 'bg-slate-200 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-slate-400';
                                    lineGrad = 'bg-transparent';
                                    cardBg = 'bg-slate-50 dark:bg-[#1a0f12] border-slate-200 dark:border-white/5 opacity-60 hover:opacity-100 transition-opacity';
                                    titleColor = 'text-slate-500 dark:text-slate-400';
                                    statusBadge = 'Đã khóa';
                                    badgeColor = 'bg-slate-500/10 text-slate-500 border border-slate-500/20';
                                }

                                return (
                                    <div key={m.id} className="flex gap-4 group">
                                        <div className="flex flex-col items-center">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 relative ${iconBg}`}>
                                                {m.status === 'done' && <span className="material-symbols-outlined">done_all</span>}
                                                {m.status === 'active' && <span className="material-symbols-outlined animate-pulse">model_training</span>}
                                                {m.status === 'locked' && <span className="material-symbols-outlined">lock</span>}
                                            </div>
                                            {!isLast && (
                                                <div 
                                                    className={`w-1 h-full min-h-[50px] ${lineGrad}`} 
                                                    style={m.status === 'active' ? { backgroundImage: 'linear-gradient(to bottom, #f59e0b 50%, transparent 50%)', backgroundSize: '1px 12px' } : {}}
                                                ></div>
                                            )}
                                        </div>
                                        <div className="pb-10 flex-1 relative">
                                            <div className={`p-5 rounded-xl border ${cardBg}`}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className={`font-bold text-lg ${titleColor}`}>{m.title}</h4>
                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-tighter ${badgeColor}`}>
                                                        {statusBadge}
                                                    </span>
                                                </div>
                                                <p className={`text-sm mb-4 ${m.status === 'locked' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-400'}`}>
                                                    {m.subtitle}
                                                </p>
                                                
                                                {m.status === 'active' && m.progress !== undefined && (
                                                    <div className="h-2.5 w-full bg-amber-200 dark:bg-amber-900/40 rounded-full overflow-hidden">
                                                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${m.progress}%` }}></div>
                                                    </div>
                                                )}

                                                {/* Mini Edit Controls shown on hover */}
                                                <div className="absolute top-7 -right-4 md:-right-8 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 z-20">
                                                    <button onClick={() => openEditModal(m)} className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg hover:bg-blue-600" title="Chỉnh sửa">
                                                        <span className="material-symbols-outlined text-[16px]">edit</span>
                                                    </button>
                                                    <button onClick={() => deleteMilestone(m.id)} className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg hover:bg-rose-600" title="Xóa">
                                                        <span className="material-symbols-outlined text-[16px]">delete</span>
                                                    </button>
                                                    <div className="flex mt-1">
                                                        <button onClick={() => moveMilestone(index, 'up')} disabled={index===0} className="w-8 h-6 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-l-full flex justify-center items-center hover:bg-slate-300 disabled:opacity-50">
                                                            <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                                                        </button>
                                                        <button onClick={() => moveMilestone(index, 'down')} disabled={isLast} className="w-8 h-6 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-r-full flex justify-center items-center hover:bg-slate-300 disabled:opacity-50">
                                                            <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </section>

            </main>

            {/* Editing Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
                    <div className="bg-white dark:bg-[#191022] rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-[#7f13ec]">
                                <span className="material-symbols-outlined">edit_note</span> Tùy chỉnh mốc
                            </h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-900 bg-slate-100 dark:bg-white/5 rounded-full w-8 h-8 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold mb-1 text-slate-700 dark:text-slate-200">Tên giai đoạn / Mục tiêu</label>
                                <input 
                                    type="text" 
                                    value={editingMilestone.title}
                                    onChange={(e) => setEditingMilestone({...editingMilestone, title: e.target.value})}
                                    placeholder="Vd: Luyện đề tháng 3"
                                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#7f13ec]"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1 text-slate-700 dark:text-slate-200">Mô tả chi tiết</label>
                                <textarea 
                                    rows="2"
                                    value={editingMilestone.subtitle}
                                    onChange={(e) => setEditingMilestone({...editingMilestone, subtitle: e.target.value})}
                                    placeholder="Vd: Làm mỗi tuần 2 đề đánh giá năng lực..."
                                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#7f13ec] resize-none"
                                ></textarea>
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1 text-slate-700 dark:text-slate-200">Trạng thái</label>
                                <select 
                                    value={editingMilestone.status}
                                    onChange={(e) => setEditingMilestone({...editingMilestone, status: e.target.value})}
                                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#7f13ec]"
                                >
                                    <option value="done">Hoàn thành</option>
                                    <option value="active">Đang thực hiện</option>
                                    <option value="locked">Chưa bắt đầu (Khóa)</option>
                                </select>
                            </div>
                            {editingMilestone.status === 'active' && (
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-slate-700 dark:text-slate-200">Tiến độ ({editingMilestone.progress}%)</label>
                                    <input 
                                        type="range" 
                                        min="0" max="100" 
                                        value={editingMilestone.progress}
                                        onChange={(e) => setEditingMilestone({...editingMilestone, progress: Number(e.target.value)})}
                                        className="w-full accent-amber-500"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="mt-8 flex gap-3">
                            <button onClick={saveMilestone} className="w-full py-3 bg-[#7f13ec] text-white font-bold rounded-xl shadow-lg shadow-[#7f13ec]/30 hover:bg-[#6b0fce] transition-colors flex justify-center items-center gap-2">
                                <span className="material-symbols-outlined text-[18px]">check</span> Lưu Lại
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* General Settings Modal */}
            {isSettingsOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
                    <div className="bg-white dark:bg-[#191022] rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-[#7f13ec]">
                                <span className="material-symbols-outlined">tune</span> Cài đặt chung
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
                                        <input type="range" min="15" max="30" step="0.25" value={targetTHPT} onChange={(e) => setTargetTHPT(Number(e.target.value))} className="w-full accent-[#7f13ec]" />
                                    </div>
                                    <div className="p-5 bg-slate-50 dark:bg-[#1a0f12] rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
                                        <label className="block text-sm font-bold mb-3 text-slate-700 dark:text-slate-200 flex items-center justify-between">
                                            <span>Mục tiêu Đánh giá năng lực</span>
                                            <span className="font-black text-xl text-[#7f13ec]">{targetDGNL}đ</span>
                                        </label>
                                        <input type="range" min="500" max="1200" step="10" value={targetDGNL} onChange={(e) => setTargetDGNL(Number(e.target.value))} className="w-full accent-[#7f13ec]" />
                                    </div>
                                </>
                            ) : (
                                <div className="p-5 bg-slate-50 dark:bg-[#1a0f12] rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
                                    <label className="block text-sm font-bold mb-3 text-slate-700 dark:text-slate-200 flex items-center justify-between">
                                        <span>Số tín chỉ mục tiêu / kỳ</span>
                                        <span className="font-black text-xl text-[#7f13ec]">{creditsPerSemester}TC</span>
                                    </label>
                                    <input type="range" min="10" max="25" value={creditsPerSemester} onChange={(e) => setCreditsPerSemester(Number(e.target.value))} className="w-full accent-[#7f13ec]" />
                                </div>
                            )}
                        </div>

                        <div className="mt-8 flex gap-3">
                            <button onClick={() => setIsSettingsOpen(false)} className="flex-1 py-3 bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-white/20 transition-colors">Hủy bỏ</button>
                            <button onClick={handleSaveSettings} disabled={isSaving} className="flex-1 py-3 bg-[#7f13ec] text-white font-bold rounded-xl shadow-lg shadow-[#7f13ec]/30 hover:bg-[#6b0fce] transition-colors flex justify-center items-center gap-2 disabled:opacity-70">
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

