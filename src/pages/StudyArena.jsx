import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getUserRank } from '../utils/rankHelper';

export default function StudyArena() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('my_campaigns'); // 'my_campaigns', 'public', 'leaderboard'

    // Creation Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isCompleted, setIsCompleted] = useState(false);
    const [isPublicOption, setIsPublicOption] = useState(false);

    // Sub-targets Support
    const [subTargets, setSubTargets] = useState([]);
    const [newSubTarget, setNewSubTarget] = useState('');

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const [myCampaigns, setMyCampaigns] = useState([]);
    const [publicCampaigns, setPublicCampaigns] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [userRanks, setUserRanks] = useState({});

    const [loadingData, setLoadingData] = useState(true);

    useEffect(() => {
        if (user) {
            if (activeTab === 'my_campaigns') fetchMyCampaigns();
            if (activeTab === 'public') fetchPublicCampaigns();
            if (activeTab === 'leaderboard') fetchLeaderboard();
        }
    }, [activeTab, user]);

    const fetchMyCampaigns = async () => {
        setLoadingData(true);
        const { data, error } = await supabase
            .from('campaigns')
            .select('id, user_id, title, description, start_date, end_date, targets, is_completed, is_public')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (!error) setMyCampaigns(data || []);
        setLoadingData(false);
    };

    // Fetch public profile info (safe columns only) for a set of user ids via
    // public_profile_view — the profiles table is locked to own-row + admin, so
    // cross-user reads must go through this definer view.
    const fetchPublicProfilesMap = async (userIds) => {
        const ids = [...new Set((userIds || []).filter(Boolean))];
        if (ids.length === 0) return {};
        const { data, error } = await supabase
            .from('public_profile_view')
            .select('id, display_name, avatar_url, role, is_approved_bang_chu')
            .in('id', ids);
        if (error || !data) return {};
        const map = {};
        data.forEach((p) => { map[p.id] = p; });
        return map;
    };

    const fetchPublicCampaigns = async () => {
        setLoadingData(true);
        const { data, error } = await supabase
            .from('campaigns')
            .select('id, user_id, title, description, start_date, end_date, targets, is_completed, is_public, created_at')
            .eq('is_public', true)
            .order('created_at', { ascending: false });

        if (!error && data) {
            const profilesMap = await fetchPublicProfilesMap(data.map((c) => c.user_id));
            setPublicCampaigns(data.map((c) => ({ ...c, profiles: profilesMap[c.user_id] || null })));
        } else if (!error) {
            setPublicCampaigns([]);
        }
        setLoadingData(false);
    };

    const fetchLeaderboard = async () => {
        setLoadingData(true);
        const { data, error } = await supabase
            .from('campaigns')
            .select('user_id')
            .eq('is_completed', true);

        if (!error && data) {
            const counts = {};
            data.forEach(camp => {
                counts[camp.user_id] = (counts[camp.user_id] || 0) + 1;
            });
            const profilesMap = await fetchPublicProfilesMap(Object.keys(counts));

            // Also populate userRanks so rank badges work everywhere
            setUserRanks(counts);

            const lb = Object.keys(counts).map(uid => ({
                user_id: uid,
                count: counts[uid],
                profile: profilesMap[uid]
            })).sort((a, b) => b.count - a.count);

            setLeaderboard(lb);
        }
        setLoadingData(false);
    };

    const handleAddSubTarget = (e) => {
        e.preventDefault();
        if (!newSubTarget.trim()) return;
        setSubTargets([...subTargets, { id: Date.now().toString(), text: newSubTarget.trim(), completed: false }]);
        setNewSubTarget('');
    };

    const removeSubTarget = (id) => {
        setSubTargets(subTargets.filter(t => t.id !== id));
    };

    const handleCreateCampaign = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        if (!title.trim() || !description.trim()) {
            setMessage({ type: 'error', text: 'Vui lòng nhập tên và mô tả chiến dịch!' });
            setLoading(false);
            return;
        }

        if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
            setMessage({ type: 'error', text: 'Ngày bắt đầu không được lớn hơn ngày kết thúc!' });
            setLoading(false);
            return;
        }

        const { error } = await supabase.from('campaigns').insert([{
            user_id: user.id,
            title: title.trim(),
            description: description.trim(),
            start_date: startDate || null,
            end_date: endDate || null,
            targets: subTargets,
            is_completed: isCompleted,
            is_public: isPublicOption
        }]);

        if (!error) {
            setMessage({ type: 'success', text: 'Tạo chiến dịch thành công!' });
            setTitle('');
            setDescription('');
            setStartDate('');
            setEndDate('');
            setSubTargets([]);
            setIsCompleted(false);
            setIsPublicOption(false);
            fetchMyCampaigns();
        } else {
            setMessage({ type: 'error', text: 'Lỗi khi tạo chiến dịch: ' + error.message });
        }
        setLoading(false);
        setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    };

    // Toggle main campaign status
    const toggleCampaignStatus = async (id, currentStatus) => {
        // Optimistic update
        setMyCampaigns(prev => prev.map(c => c.id === id ? { ...c, is_completed: !currentStatus } : c));

        const { error } = await supabase
            .from('campaigns')
            .update({ is_completed: !currentStatus })
            .eq('id', id);

        if (error) fetchMyCampaigns(); // Revert on error
    };

    // Toggle individual sub-target
    const toggleSubTarget = async (campaignId, subTargetId, currentTargets) => {
        const updatedTargets = currentTargets.map(t =>
            t.id === subTargetId ? { ...t, completed: !t.completed } : t
        );

        const allDone = updatedTargets.length > 0 && updatedTargets.every(t => t.completed);

        // Optimistic update
        setMyCampaigns(prev => prev.map(c =>
            c.id === campaignId ? { ...c, targets: updatedTargets, is_completed: allDone } : c
        ));

        const { error } = await supabase
            .from('campaigns')
            .update({ targets: updatedTargets, is_completed: allDone })
            .eq('id', campaignId);

        if (error) fetchMyCampaigns(); // Revert on error
    };

    const deleteCampaign = async (id) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa chiến dịch này?")) return;
        setMyCampaigns(prev => prev.filter(c => c.id !== id)); // Optimistic
        const { error } = await supabase.from('campaigns').delete().eq('id', id);
        if (error) fetchMyCampaigns();
    };

    // UI Helpers
    const renderProgressBar = (targets, is_completed) => {
        if (is_completed) return <div className="w-full h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] transition-all duration-1000" />;
        if (!targets || targets.length === 0) return <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700" />;

        const completedCount = targets.filter(t => t.completed).length;
        const progress = Math.round((completedCount / targets.length) * 100);

        return (
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                <div
                    className="h-full bg-gradient-to-r from-[#fe5f36] to-pink-500 rounded-full transition-all duration-700 ease-out relative"
                    style={{ width: `${progress}%` }}
                >
                    {/* Glow effect */}
                    <div className="absolute top-0 right-0 bottom-0 w-4 bg-white/30 blur-[2px] rounded-full" />
                </div>
            </div>
        );
    };

    const calculateProgressText = (targets, is_completed) => {
        if (is_completed) return "100%";
        if (!targets || targets.length === 0) return "0%";
        const completedCount = targets.filter(t => t.completed).length;
        return `${Math.round((completedCount / targets.length) * 100)}% (${completedCount}/${targets.length})`;
    };

    return (
        <div className="bg-[#f8f6f6] dark:bg-[#0f080a] font-display text-slate-900 dark:text-white min-h-screen pb-24 relative overflow-hidden">
            {/* Decorative background blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#fe5f36]/20 blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute top-[30%] right-[-5%] w-80 h-80 bg-pink-500/10 blur-[100px] rounded-full pointer-events-none" />

            {/* Header */}
            <header className="relative z-30 px-6 py-4 bg-white/60 dark:bg-[#1a0f12]/60 backdrop-blur-xl border-b border-[#fe5f36]/10 flex flex-col gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#fe5f36] to-pink-600 flex items-center justify-center text-white shadow-lg shadow-[#fe5f36]/30 border border-white/20">
                        <span className="material-symbols-outlined text-2xl">local_fire_department</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#fe5f36] to-pink-600 drop-shadow-sm">Đấu trường học tập</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Lên chiến lược & Bứt phá giới hạn</p>
                    </div>
                </div>

                {/* Main Tabs Segmented Control */}
                <div className="flex bg-slate-200/50 dark:bg-white/5 p-1.5 rounded-2xl w-full max-w-lg overflow-x-auto scrollbar-hide backdrop-blur-sm border border-slate-300/30 dark:border-white/5 relative z-10">
                    <button onClick={() => setActiveTab('my_campaigns')} className={`whitespace-nowrap flex-1 px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'my_campaigns' ? 'bg-white dark:bg-[#201216] shadow-md shadow-black/5 text-[#fe5f36]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                        <span className="material-symbols-outlined text-[20px]">flag</span> Của tôi
                    </button>
                    <button onClick={() => setActiveTab('public')} className={`whitespace-nowrap flex-1 px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'public' ? 'bg-white dark:bg-[#201216] shadow-md shadow-black/5 text-[#fe5f36]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                        <span className="material-symbols-outlined text-[20px]">public</span> Cộng đồng
                    </button>
                    <button onClick={() => setActiveTab('leaderboard')} className={`whitespace-nowrap flex-1 px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'leaderboard' ? 'bg-white dark:bg-[#201216] shadow-md shadow-black/5 text-[#fe5f36]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                        <span className="material-symbols-outlined text-[20px]">trophy</span> Phong Thần
                    </button>
                </div>
            </header>

            <main className="w-full max-w-4xl mx-auto px-4 pt-8 relative z-10">
                {activeTab === 'my_campaigns' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                        {/* Form Section */}
                        <div className="lg:col-span-5 space-y-6">
                            <div className="bg-white/80 dark:bg-[#1a0f12]/80 backdrop-blur-xl border border-slate-200/50 dark:border-white/10 rounded-3xl p-6 shadow-2xl shadow-slate-200/40 dark:shadow-black/40 relative overflow-hidden">
                                {/* Subtle top glare */}
                                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

                                <h2 className="text-xl font-black flex items-center gap-2 text-slate-800 dark:text-white mb-6">
                                    <span className="material-symbols-outlined text-[#fe5f36]">add_task</span> Khởi tạo mục tiêu
                                </h2>

                                {message.text && (
                                    <div className={`p-4 rounded-2xl mb-6 text-sm font-bold flex items-start gap-3 backdrop-blur-md ${message.type === 'error' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'}`}>
                                        <span className="material-symbols-outlined shrink-0">{message.type === 'error' ? 'error' : 'check_circle'}</span>
                                        <p className="mt-0.5">{message.text}</p>
                                    </div>
                                )}

                                <form onSubmit={handleCreateCampaign} className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">Tên chiến dịch <span className="text-red-500">*</span></label>
                                        <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-slate-100/50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl py-3.5 px-4 outline-none focus:ring-2 focus:ring-[#fe5f36]/50 focus:border-[#fe5f36] focus:bg-white dark:focus:bg-[#1a0f12] transition-all text-slate-900 dark:text-white placeholder:text-slate-400" placeholder="VD: Ôn thi Đại Học 2026..." />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">Động lực / Ghi chú <span className="text-red-500">*</span></label>
                                        <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows="2" className="w-full bg-slate-100/50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl py-3.5 px-4 outline-none focus:ring-2 focus:ring-[#fe5f36]/50 focus:border-[#fe5f36] focus:bg-white dark:focus:bg-[#1a0f12] transition-all text-slate-900 dark:text-white resize-none placeholder:text-slate-400" placeholder="Quyết tâm đạt 27 điểm khối A00..."></textarea>
                                    </div>

                                    <div className="flex flex-col gap-4">
                                        <div>
                                            <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">Ngày bắt đầu</label>
                                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full block bg-slate-100/50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#fe5f36]/50 focus:border-[#fe5f36] focus:bg-white dark:focus:bg-[#1a0f12] transition-all text-slate-900 dark:text-white dark:[color-scheme:dark]" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">Ngày kết thúc</label>
                                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} className="w-full block bg-slate-100/50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#fe5f36]/50 focus:border-[#fe5f36] focus:bg-white dark:focus:bg-[#1a0f12] transition-all text-slate-900 dark:text-white dark:[color-scheme:dark]" />
                                        </div>
                                    </div>

                                    {/* Sub Targets Section */}
                                    <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-200/50 dark:border-white/5">
                                        <label className="block text-sm font-bold mb-3 text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                            Chia nhỏ chặng đường
                                            <span className="text-xs font-medium text-slate-500 bg-slate-200 dark:bg-white/10 px-2 py-0.5 rounded-md">{subTargets.length} mục tiêu</span>
                                        </label>

                                        <div className="flex gap-2 mb-3">
                                            <input
                                                type="text"
                                                value={newSubTarget}
                                                onChange={(e) => setNewSubTarget(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSubTarget(e))}
                                                className="w-full bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl py-2.5 px-3 outline-none focus:border-[#fe5f36] transition-all text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
                                                placeholder="VD: Làm xong 5 đề giải tích..."
                                            />
                                            <button type="button" onClick={handleAddSubTarget} className="shrink-0 bg-slate-800 dark:bg-white text-white dark:text-black w-11 h-11 rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-md">
                                                <span className="material-symbols-outlined text-[20px]">add</span>
                                            </button>
                                        </div>

                                        {/* Display added subtargets */}
                                        {subTargets.length > 0 && (
                                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                                {subTargets.map((target, idx) => (
                                                    <div key={target.id} className="group relative flex items-center gap-3 bg-white dark:bg-black/20 p-2.5 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
                                                        <div className="w-5 h-5 shrink-0 rounded-full border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center text-[10px] font-bold text-slate-400">{idx + 1}</div>
                                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 break-words flex-1">{target.text}</span>
                                                        <button type="button" onClick={() => removeSubTarget(target.id)} className="w-7 h-7 shrink-0 rounded-lg bg-red-100 text-red-500 dark:bg-red-500/10 dark:text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white">
                                                            <span className="material-symbols-outlined text-[16px]">close</span>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <label className="group flex items-center justify-between p-3.5 rounded-2xl border-2 border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/3 cursor-pointer hover:border-slate-200 dark:hover:border-white/10 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isPublicOption ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400'}`}>
                                                    <span className="material-symbols-outlined">{isPublicOption ? 'public' : 'lock'}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-sm font-bold text-slate-800 dark:text-slate-200">Chia sẻ với cộng đồng</span>
                                                    <span className="block text-xs font-medium text-slate-500 mt-0.5">Truyền cảm hứng cho người khác</span>
                                                </div>
                                            </div>
                                            <div className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${isPublicOption ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${isPublicOption ? 'left-6' : 'left-0.5'}`} />
                                            </div>
                                            <input type="checkbox" checked={isPublicOption} onChange={(e) => setIsPublicOption(e.target.checked)} className="hidden" />
                                        </label>
                                    </div>

                                    <button type="submit" disabled={loading} className="w-full py-4 bg-gradient-to-r from-[#fe5f36] to-pink-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-[#fe5f36]/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:hover:scale-100 flex items-center justify-center gap-2 overflow-hidden relative group">
                                        <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-[-20deg]" />
                                        {loading ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">rocket_launch</span>}
                                        {loading ? 'Đang tạo...' : 'Khởi động Chiến Dịch'}
                                    </button>
                                </form>
                            </div>
                        </div>

                        {/* List Section */}
                        <div className="lg:col-span-7">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-black tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-pink-500">local_activity</span> Hành trình của bạn
                                </h3>
                            </div>

                            {loadingData ? (
                                <div className="flex justify-center py-12">
                                    <div className="relative w-12 h-12">
                                        <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-white/10" />
                                        <div className="absolute inset-0 rounded-full border-4 border-[#fe5f36] border-t-transparent animate-spin" />
                                    </div>
                                </div>
                            ) : myCampaigns.length === 0 ? (
                                <div className="text-center bg-white/50 dark:bg-[#1a0f12]/50 backdrop-blur-sm border border-slate-200 dark:border-white/5 rounded-3xl p-12 shadow-sm">
                                    <div className="w-20 h-20 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">edit_note</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">Chưa có mục tiêu nào</h3>
                                    <p className="text-sm text-slate-500">Hãy tạo chiến dịch đầu tiên để bắt đầu hành trình chinh phục tri thức.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {myCampaigns.map(camp => (
                                        <div key={camp.id} className={`relative overflow-hidden group p-6 rounded-3xl border transition-all duration-300 hover:shadow-xl ${camp.is_completed ? 'border-green-400/50 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-900/10 shadow-green-500/10' : 'border-slate-200/60 dark:border-white/10 bg-white/80 dark:bg-[#1a0f12]/80 backdrop-blur-xl shadow-black/5 hover:border-[#fe5f36]/40 hover:shadow-[#fe5f36]/10'}`}>

                                            {/* Watermark icon */}
                                            <span className={`material-symbols-outlined absolute -right-6 -bottom-6 text-[120px] opacity-5 pointer-events-none rotate-12 ${camp.is_completed ? 'text-green-500' : 'text-[#fe5f36]'}`}>
                                                {camp.is_completed ? 'verified' : 'bolt'}
                                            </span>

                                            <div className="relative z-10 flex justify-between items-start gap-4 mb-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <h4 className={`font-black text-xl truncate ${camp.is_completed ? 'text-green-700 dark:text-green-400' : 'text-slate-900 dark:text-white'}`}>
                                                            {camp.title}
                                                        </h4>
                                                        {camp.is_public && <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 text-[10px] font-bold tracking-widest uppercase flex items-center gap-1 shrink-0"><span className="material-symbols-outlined text-[12px]">public</span> Global</span>}
                                                    </div>
                                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-white/5 p-3 rounded-2xl border border-slate-100 dark:border-white/5">
                                                        {camp.description}
                                                    </p>
                                                    {(camp.start_date || camp.end_date) && (
                                                        <div className="flex items-center gap-2 mt-3 text-xs font-bold text-slate-500 bg-slate-100 dark:bg-black/20 inline-flex px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/5">
                                                            <span className="material-symbols-outlined text-[14px]">calendar_month</span>
                                                            {camp.start_date ? new Date(camp.start_date).toLocaleDateString('vi-VN') : '---'}
                                                            <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
                                                            {camp.end_date ? new Date(camp.end_date).toLocaleDateString('vi-VN') : '---'}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    <button onClick={() => deleteCampaign(camp.id)} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center shadow-sm" title="Xoá">
                                                        <span className="material-symbols-outlined">delete</span>
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="relative z-10 space-y-4">
                                                {/* Progress bar */}
                                                <div className="pt-2">
                                                    <div className="flex justify-between items-end mb-2">
                                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tiến độ hoàn thành</span>
                                                        <span className={`text-sm font-black ${camp.is_completed ? 'text-green-600 dark:text-green-400' : 'text-[#fe5f36]'}`}>
                                                            {calculateProgressText(camp.targets, camp.is_completed)}
                                                        </span>
                                                    </div>
                                                    {renderProgressBar(camp.targets, camp.is_completed)}
                                                </div>

                                                {/* Sub-targets Checklist */}
                                                {camp.targets && camp.targets.length > 0 && (
                                                    <div className="pt-4 border-t border-slate-100 dark:border-white/10 space-y-2.5">
                                                        {camp.targets.map((target) => (
                                                            <label key={target.id} className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${target.completed ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-500/20' : 'bg-white dark:bg-black/30 border-slate-200 dark:border-white/10 hover:border-[#fe5f36]/40 hover:shadow-sm'}`}>
                                                                <input
                                                                    type="checkbox"
                                                                    className="hidden"
                                                                    checked={target.completed}
                                                                    onChange={() => toggleSubTarget(camp.id, target.id, camp.targets)}
                                                                />
                                                                <div className={`w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${target.completed ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 dark:border-slate-500 bg-transparent'}`}>
                                                                    {target.completed && <span className="material-symbols-outlined text-[16px] font-bold">check</span>}
                                                                </div>
                                                                <span className={`text-sm font-medium transition-colors ${target.completed ? 'text-green-700 dark:text-green-400 line-through opacity-70' : 'text-slate-700 dark:text-slate-200'}`}>
                                                                    {target.text}
                                                                </span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Complete All Button - fallback if no targets or user just wants to mark complete */}
                                                {(!camp.targets || camp.targets.length === 0) && (
                                                    <div className="pt-2">
                                                        <button onClick={() => toggleCampaignStatus(camp.id, camp.is_completed)} className={`w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${camp.is_completed ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white hover:bg-[#fe5f36] hover:text-white hover:shadow-lg hover:shadow-[#fe5f36]/30'}`}>
                                                            <span className="material-symbols-outlined">{camp.is_completed ? 'verified' : 'check_circle'}</span>
                                                            {camp.is_completed ? 'Đã hoàn tất chiến dịch' : 'Đánh dấu hoàn tất'}
                                                        </button>
                                                    </div>
                                                )}

                                                {(camp.targets && camp.targets.length > 0 && !camp.is_completed && camp.targets.every(t => t.completed)) && (
                                                    <div className="pt-2">
                                                        <button onClick={() => toggleCampaignStatus(camp.id, false)} className="w-full py-3 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black flex items-center justify-center gap-2 shadow-xl shadow-green-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all animate-pulse">
                                                            <span className="material-symbols-outlined">celebration</span>
                                                            Nhận thưởng Hoàn tất
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Public Tab Enhanced UI */}
                {activeTab === 'public' && (
                    <div className="space-y-6">
                        {loadingData ? (
                            <div className="flex justify-center py-12">
                                <div className="relative w-12 h-12">
                                    <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-white/10" />
                                    <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
                                </div>
                            </div>
                        ) : publicCampaigns.length === 0 ? (
                            <div className="text-center bg-white/50 dark:bg-[#1a0f12]/50 backdrop-blur-sm border border-slate-200 dark:border-white/5 rounded-3xl p-12 shadow-sm">
                                <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4">public_off</span>
                                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Chưa có ai đăng tải</h3>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {publicCampaigns.map(camp => {
                                    const completedCount = userRanks[camp.user_id] || 0;
                                    const rankInfo = getUserRank(completedCount, camp.profiles?.role, camp.profiles?.is_approved_bang_chu);
                                    const isAdmin = camp.profiles?.role === 'admin';

                                    return (
                                        <div key={camp.id} className={`group relative p-6 rounded-3xl border transition-all duration-300 hover:-translate-y-1 overflow-hidden flex flex-col h-full bg-white dark:bg-[#1a0f12] ${isAdmin ? 'border-red-300/60 shadow-xl shadow-red-500/10' : 'border-slate-200/60 dark:border-white/10 shadow-lg shadow-black/5'}`}>
                                            {/* Beautiful Header Background */}
                                            <div className={`absolute top-0 left-0 right-0 h-24 ${isAdmin ? 'bg-gradient-to-b from-red-400/20 to-transparent' : 'bg-gradient-to-b from-blue-500/10 to-transparent'}`} />

                                            {isAdmin && (
                                                <div className="absolute -right-8 top-5 rotate-45 bg-gradient-to-r from-red-500 to-rose-600 text-white text-[10px] font-black uppercase tracking-wider py-1 px-10 shadow-lg z-20">
                                                    Thống Soái
                                                </div>
                                            )}

                                            <div className="relative z-10 flex items-center gap-3 mb-5">
                                                <Link to={`/profile/${camp.user_id}`} className="relative group/avatar cursor-pointer">
                                                    <img src={camp.profiles?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} alt="Avatar" className={`w-12 h-12 rounded-xl object-cover border-2 shadow-sm transition-transform group-hover/avatar:scale-105 ${isAdmin ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'}`} />
                                                    {isAdmin && <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center border-2 border-white dark:border-[#1a0f12]"><span className="material-symbols-outlined text-white text-[12px]">verified</span></span>}
                                                </Link>
                                                <div>
                                                    <Link to={`/profile/${camp.user_id}`} className={`text-sm font-black flex items-center gap-1 text-slate-800 dark:text-slate-200 hover:text-indigo-500 transition-colors`}>
                                                        {camp.profiles?.display_name || 'Chiến thần ẩn danh'}
                                                    </Link>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${rankInfo.bg} ${rankInfo.color} border ${rankInfo.border}`}>
                                                            <span className="material-symbols-outlined text-[10px]">{rankInfo.icon}</span>
                                                            {rankInfo.name}
                                                        </span>
                                                        <span className="text-[10px] font-medium text-slate-500">{new Date(camp.created_at).toLocaleDateString('vi-VN')}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <h4 className="font-black text-lg mb-2 text-slate-900 dark:text-white line-clamp-2 relative z-10">{camp.title}</h4>

                                            {(camp.start_date || camp.end_date) && (
                                                <div className="flex items-center gap-1.5 mb-3 text-[10px] font-bold text-slate-500 bg-slate-50 dark:bg-white/5 inline-flex px-2.5 py-1 rounded-lg border border-slate-100 dark:border-white/5 relative z-10 w-fit">
                                                    <span className="material-symbols-outlined text-[12px]">calendar_month</span>
                                                    <span>{camp.start_date ? new Date(camp.start_date).toLocaleDateString('vi-VN') : '---'} - {camp.end_date ? new Date(camp.end_date).toLocaleDateString('vi-VN') : '---'}</span>
                                                </div>
                                            )}

                                            <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-6 relative z-10 flex-1">{camp.description}</p>

                                            <div className="relative z-10 mt-auto pt-4 border-t border-slate-100 dark:border-white/10">
                                                <div className="flex justify-between items-end mb-2">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">flag</span> Tiến độ</span>
                                                    <span className={`text-[11px] font-black ${camp.is_completed ? 'text-green-600 dark:text-green-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                        {calculateProgressText(camp.targets, camp.is_completed)}
                                                    </span>
                                                </div>
                                                {renderProgressBar(camp.targets, camp.is_completed)}

                                                {camp.targets && camp.targets.length > 0 && (
                                                    <div className="mt-3 text-[10px] font-bold text-slate-500 tracking-wide uppercase">
                                                        {camp.targets.length} Mục tiêu nhỏ
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Enhanced Leaderboard */}
                {activeTab === 'leaderboard' && (
                    <div className="max-w-2xl mx-auto">
                        <div className="text-center mb-10 pt-4 relative">
                            {/* Glow behind trophy */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-yellow-400/20 blur-[30px] rounded-full pointer-events-none" />

                            <div className="w-20 h-20 bg-gradient-to-tr from-yellow-400 via-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-amber-500/30 rotate-12 relative z-10 border border-white/20">
                                <span className="material-symbols-outlined text-white text-4xl -rotate-12">emoji_events</span>
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Bảng Phong Thần</h2>
                            <p className="text-sm font-medium text-slate-500 bg-white/50 dark:bg-white/5 inline-block px-4 py-1.5 rounded-full border border-slate-200 dark:border-white/5">Nơi vinh danh những chiến binh chăm chỉ nhất</p>
                        </div>

                        {loadingData ? (
                            <div className="flex justify-center py-12">
                                <div className="relative w-12 h-12">
                                    <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-white/10" />
                                    <div className="absolute inset-0 rounded-full border-4 border-yellow-500 border-t-transparent animate-spin" />
                                </div>
                            </div>
                        ) : leaderboard.length === 0 ? (
                            <div className="text-center bg-white/50 dark:bg-[#1a0f12]/50 border border-slate-200 dark:border-white/5 rounded-3xl p-12">
                                <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4">hourglass_empty</span>
                                <p className="font-bold text-slate-600 dark:text-slate-400">Chưa có ai ghi danh bảng vàng.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {leaderboard.map((userStats, index) => {
                                    const rankInfo = getUserRank(userStats.count, userStats.profile?.role, userStats.profile?.is_approved_bang_chu);
                                    const isTop3 = index < 3;
                                    const topStyles = [
                                        'bg-gradient-to-r from-yellow-100 to-amber-50 border-amber-300 text-amber-900 dark:from-yellow-900/30 dark:to-orange-900/20 dark:text-white shadow-lg shadow-amber-500/20 scale-105 z-10', // Top 1
                                        'bg-gradient-to-r from-slate-100 to-slate-50 border-slate-300 text-slate-800 dark:from-slate-800/80 dark:to-slate-900/80 dark:text-white shadow-md shadow-slate-500/10 scale-[1.02]', // Top 2
                                        'bg-gradient-to-r from-orange-100 to-orange-50 border-orange-300 text-orange-900 dark:from-orange-900/30 dark:to-red-900/20 dark:text-white shadow-md shadow-orange-500/10 scale-[1.01]' // Top 3
                                    ];

                                    return (
                                        <div key={userStats.user_id} className={`group flex items-center justify-between p-5 rounded-3xl border-2 transition-all hover:scale-[1.02] ${isTop3 ? topStyles[index] : 'border-slate-200/50 dark:border-white/5 bg-white/80 dark:bg-[#1a0f12]/80 backdrop-blur-md shadow-sm'}`}>
                                            <div className="flex items-center gap-5 relative">
                                                {/* Rank Ribbon */}
                                                <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center font-black text-xl border-2 ${isTop3 ? 'bg-white/50 text-current border-current/20 shadow-inner' : 'bg-slate-50 dark:bg-black/20 text-slate-400 border-slate-200 dark:border-slate-800'}`}>
                                                    #{index + 1}
                                                </div>

                                                <div className="relative">
                                                    <img src={userStats.profile?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} alt="Avatar" className={`w-12 h-12 rounded-full object-cover shadow-sm ${isTop3 ? 'ring-4 ring-white/50 dark:ring-white/10' : ''}`} />
                                                    {isTop3 && (
                                                        <span className="absolute -top-2 -right-2 text-xl filter drop-shadow-md">
                                                            {index === 0 ? '👑' : index === 1 ? '💎' : '🔥'}
                                                        </span>
                                                    )}
                                                </div>

                                                <div>
                                                    <p className="font-bold text-base sm:text-lg flex items-center gap-1.5 flex-wrap">
                                                        {userStats.profile?.display_name || 'Chưa rõ danh tính'}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${rankInfo.bg} ${rankInfo.color} border ${rankInfo.border} uppercase`}>
                                                            <span className="material-symbols-outlined text-[10px]">{rankInfo.icon}</span>
                                                            {rankInfo.name}
                                                        </span>
                                                        {isTop3 && <p className="text-[10px] uppercase font-black tracking-widest opacity-60 ml-1">{index === 0 ? 'Quán Quân' : index === 1 ? 'Á Quân' : 'Quý Quân'}</p>}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-end shrink-0 pl-4 border-l border-current/10">
                                                <span className="text-3xl font-black">{userStats.count}</span>
                                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Chiến dịch</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
