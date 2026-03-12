import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getUserRank } from '../utils/rankHelper';

export default function UserProfile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const [rankInfo, setRankInfo] = useState({ name: 'Tân Binh' });

    const [followersCount, setFollowersCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);

    const [campaigns, setCampaigns] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [activeTab, setActiveTab] = useState('campaigns'); // 'campaigns' | 'documents'

    useEffect(() => {
        if (id) {
            fetchUserProfile();
            fetchFollowStats();
            if (user && user.id !== id) {
                checkIfFollowing();
            }
            fetchUserContent();
        }
    }, [id, user]);

    const fetchUserProfile = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, display_name, avatar_url, role, university, user_mode, target_gpa, target_thpt, target_dgnl, current_gpa')
                .eq('id', id)
                .single();

            if (error) throw error;
            setProfile(data);

            // Get rank
            const { count } = await supabase
                .from('campaigns')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', id)
                .eq('is_completed', true);

            setRankInfo(getUserRank(count || 0, data.role, data.is_approved_bang_chu));
        } catch (err) {
            console.error('Error fetching profile:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchFollowStats = async () => {
        try {
            const { count: followers } = await supabase
                .from('follows')
                .select('*', { count: 'exact', head: true })
                .eq('following_id', id);

            const { count: following } = await supabase
                .from('follows')
                .select('*', { count: 'exact', head: true })
                .eq('follower_id', id);

            setFollowersCount(followers || 0);
            setFollowingCount(following || 0);
        } catch (err) {
            console.error('Error fetching follow stats:', err);
        }
    };

    const checkIfFollowing = async () => {
        try {
            const { data, error } = await supabase
                .from('follows')
                .select('id')
                .eq('follower_id', user.id)
                .eq('following_id', id)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') throw error;
            setIsFollowing(!!data);
        } catch (err) {
            console.error('Error checking follow status:', err);
        }
    };

    const handleToggleFollow = async () => {
        if (!user) {
            alert('Vui lòng đăng nhập để thực hiện');
            return;
        }

        setFollowLoading(true);
        try {
            if (isFollowing) {
                // Unfollow
                await supabase
                    .from('follows')
                    .delete()
                    .eq('follower_id', user.id)
                    .eq('following_id', id);

                setFollowersCount(prev => Math.max(0, prev - 1));
                setIsFollowing(false);
            } else {
                // Follow
                await supabase
                    .from('follows')
                    .insert({
                        follower_id: user.id,
                        following_id: id
                    });

                setFollowersCount(prev => prev + 1);
                setIsFollowing(true);
            }
        } catch (err) {
            console.error('Error toggling follow:', err);
            alert('Có lỗi xảy ra, thử lại sau');
        } finally {
            setFollowLoading(false);
        }
    };

    const fetchUserContent = async () => {
        try {
            // Fetch public campaigns
            const { data: camps } = await supabase
                .from('campaigns')
                .select('id, title, description, targets, is_completed, created_at')
                .eq('user_id', id)
                .eq('is_public', true)
                .order('created_at', { ascending: false });
            setCampaigns(camps || []);

            // Fetch documents (only those that are public)
            const { data: docs } = await supabase
                .from('documents')
                .select('id, title, description, category, file_url, created_at')
                .eq('uploaded_by', id)
                .eq('is_public', true)
                .order('created_at', { ascending: false });
            setDocuments(docs || []);

        } catch (err) {
            console.error('Error fetching user content:', err);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0c14] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen bg-[#0a0c14] text-white flex flex-col items-center justify-center">
                <span className="material-symbols-outlined text-6xl text-slate-500 mb-4">person_off</span>
                <h2 className="text-xl font-bold">Không tìm thấy người dùng</h2>
                <button onClick={() => navigate(-1)} className="mt-4 px-6 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
                    Quay lại
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-[#0a0c14] text-white font-display pb-24">
            {/* Dynamic Background */}
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/40 via-[#0a0c14] to-[#0a0c14] pointer-events-none"></div>

            <div className="w-full max-w-4xl mx-auto flex flex-col flex-1 relative z-10 px-4 pt-6">
                {/* Header (Back button) */}
                <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors backdrop-blur-md mb-6">
                    <span className="material-symbols-outlined">arrow_back_ios_new</span>
                </button>

                {/* Profile Card */}
                <div className="bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col items-center relative overflow-hidden mb-6">
                    {/* Decorative Glow */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-32 bg-indigo-500/20 blur-[100px] pointer-events-none"></div>

                    <div className="w-28 h-28 rounded-full border-4 border-[#0f172a] shadow-xl overflow-hidden mb-4 relative z-10 bg-slate-800">
                        {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-3xl font-bold">
                                {(profile.display_name || profile.full_name || '?')[0].toUpperCase()}
                            </div>
                        )}
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-bold text-center tracking-tight mb-1 relative z-10">
                        {profile.display_name || profile.full_name || 'Người dùng Ẩn danh'}
                    </h1>

                    {/* Rank Badges Row */}
                    <div className="flex items-center justify-center gap-2 mb-3 relative z-10">
                        {rankInfo?.name && (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border ${rankInfo.bg} ${rankInfo.border}`}>
                                <span className={`material-symbols-outlined text-[14px] ${rankInfo.color}`}>{rankInfo.icon || 'star'}</span>
                                <span className={rankInfo.color}>{rankInfo.name}</span>
                            </span>
                        )}
                        {profile.role === 'admin' && (
                            <span className="px-3 py-1 bg-rose-500/20 text-rose-400 rounded-full text-xs font-bold border border-rose-500/20">Admin</span>
                        )}
                        {profile.role === 'collaborator' && (
                            <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-bold border border-amber-500/20">Truyền Đạo Sư</span>
                        )}
                    </div>

                    {/* School Info Row */}
                    <p className="text-slate-400 text-sm font-light flex items-center justify-center gap-1 mb-6 relative z-10">
                        <span className="material-symbols-outlined text-sm">{profile?.user_mode === 'student' ? 'local_library' : 'school'}</span>
                        {profile?.university || (profile?.user_mode === 'student' ? 'Chưa cập nhật trường THPT' : 'Chưa cập nhật trường ĐH')}
                    </p>

                    <div className="flex gap-8 mb-8 relative z-10 text-center">
                        <div className="flex flex-col">
                            <span className="text-2xl font-bold">{followersCount}</span>
                            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Người theo dõi</span>
                        </div>
                        <div className="w-px bg-white/10"></div>
                        <div className="flex flex-col">
                            <span className="text-2xl font-bold">{followingCount}</span>
                            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Đang theo dõi</span>
                        </div>
                    </div>

                    {user && user.id !== id && (
                        <button
                            onClick={handleToggleFollow}
                            disabled={followLoading}
                            className={`w-full max-w-xs py-3 rounded-2xl font-bold text-sm transition-all relative z-10 flex items-center justify-center gap-2
                ${isFollowing
                                    ? 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/30'
                                }
              `}
                        >
                            {followLoading ? (
                                <span className="material-symbols-outlined animate-spin">sync</span>
                            ) : isFollowing ? (
                                <>
                                    <span className="material-symbols-outlined">how_to_reg</span>
                                    Đang Theo Tõi
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined">person_add</span>
                                    Theo dõi
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* Content Tabs */}
                <div className="flex bg-white/5 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 mb-6">
                    <button
                        onClick={() => setActiveTab('campaigns')}
                        className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'campaigns' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">swords</span> Chiến Dịch ({campaigns.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('documents')}
                        className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'documents' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">folder</span> Tài Liệu ({documents.length})
                    </button>
                </div>

                {/* Tab Content */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeTab === 'campaigns' && (
                        campaigns.length === 0 ? (
                            <div className="col-span-full py-12 text-center text-slate-400 bg-white/5 border border-white/5 rounded-3xl">
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">event_busy</span>
                                <p>Chưa có chiến dịch công khai nào.</p>
                            </div>
                        ) : (
                            campaigns.map(camp => (
                                <div key={camp.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col hover:bg-white/10 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-lg line-clamp-1">{camp.title}</h3>
                                        {camp.is_completed ? (
                                            <span className="material-symbols-outlined text-green-400 bg-green-400/10 rounded-full p-1" title="Đã hoàn thành">check_circle</span>
                                        ) : (
                                            <span className="material-symbols-outlined text-amber-400 bg-amber-400/10 rounded-full p-1" title="Đang thực hiện">pending_actions</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-400 font-medium mb-3 line-clamp-2 leading-relaxed">{camp.description}</p>

                                    {/* Progress minimal representation */}
                                    {camp.targets && camp.targets.length > 0 && (
                                        <div className="mt-auto">
                                            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                                <span>Tiến độ</span>
                                                <span>{camp.targets.filter(t => t.is_completed).length} / {camp.targets.length}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${camp.is_completed ? 'bg-green-500' : 'bg-indigo-500'}`}
                                                    style={{ width: `${(camp.targets.filter(t => t.is_completed).length / camp.targets.length) * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )
                    )}

                    {activeTab === 'documents' && (
                        documents.length === 0 ? (
                            <div className="col-span-full py-12 text-center text-slate-400 bg-white/5 border border-white/5 rounded-3xl">
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">folder_off</span>
                                <p>Chưa đóng góp tài liệu nào.</p>
                            </div>
                        ) : (
                            documents.map(doc => (
                                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" key={doc.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex gap-4 items-center hover:bg-white/10 transition-colors group">
                                    <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                        <span className="material-symbols-outlined text-indigo-400">picture_as_pdf</span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-bold text-sm text-white truncate">{doc.title}</h3>
                                        <p className="text-xs text-slate-400 truncate mt-0.5">{doc.category || 'Khác'}</p>
                                    </div>
                                </a>
                            ))
                        )
                    )}
                </div>

            </div>
        </div>
    );
}
