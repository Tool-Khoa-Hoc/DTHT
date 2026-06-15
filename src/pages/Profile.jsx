import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getUserRank } from '../utils/rankHelper';
import Avatar from '../components/Avatar';

export default function Profile() {
    const { user, profile } = useAuth();
    const [subjects, setSubjects] = useState([]);
    const [loadingSubjects, setLoadingSubjects] = useState(true);

    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        display_name: '',
        university: '',
        user_mode: 'university',
        target_gpa: '4.0',
        target_thpt: '24',
        target_dgnl: '850'
    });
    const [isSaving, setIsSaving] = useState(false);

    const [completedCampaignsCount, setCompletedCampaignsCount] = useState(0);
    const [uploadCount, setUploadCount] = useState(0);

    const fetchUploadCount = useCallback(async () => {
        try {
            if (!user) return;
            const { count, error } = await supabase
                .from('documents')
                .select('*', { count: 'exact', head: true })
                .eq('uploaded_by', user.id);
            if (!error) {
                setUploadCount(count || 0);
            }
        } catch (error) {
            console.error('Lỗi lấy số tài liệu:', error);
        }
    }, [user]);

    const fetchSubjects = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('subjects')
                .select('id, name, credits, grade_number, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setSubjects(data || []);
        } catch (error) {
            console.error('Lỗi tải môn học:', error);
        } finally {
            setLoadingSubjects(false);
        }
    }, [user]);

    const fetchCampaignsCount = useCallback(async () => {
        try {
            const { count, error } = await supabase
                .from('campaigns')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('is_completed', true);
            if (!error) {
                setCompletedCampaignsCount(count || 0);
            }
        } catch (error) {
            console.error('Lỗi lấy số chiến dịch:', error);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            fetchSubjects();
            fetchCampaignsCount();
        }
        if (profile) {
            setEditData({
                display_name: profile.display_name || '',
                university: profile.university || '',
                user_mode: profile.user_mode || 'university',
                target_gpa: profile.target_gpa || '4.0',
                target_thpt: profile.target_thpt || '24',
                target_dgnl: profile.target_dgnl || '850'
            });
            if (profile.role === 'collaborator' || profile.role === 'admin') {
                fetchUploadCount();
            }
        }
    }, [user, profile, fetchSubjects, fetchCampaignsCount, fetchUploadCount]);

    const handleDeleteSubject = async (subjectId) => {
        if (!window.confirm("Bạn có chắc chắn muốn xoá môn học này? Điểm GPA trung bình ở trang Tính GPA sẽ cần được lưu lại để cập nhật chính xác.")) return;

        try {
            const { error } = await supabase
                .from('subjects')
                .delete()
                .eq('id', subjectId)
                .eq('user_id', user.id);

            if (error) throw error;
            setSubjects(subjects.filter(s => s.id !== subjectId));
        } catch (error) {
            console.error('Lỗi khi xoá môn học:', error);
            alert('Có lỗi xảy ra khi xoá môn học.');
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    display_name: editData.display_name.trim() || null,
                    university: editData.university,
                    user_mode: editData.user_mode,
                    target_gpa: parseFloat(editData.target_gpa) || 4.0,
                    target_thpt: parseFloat(editData.target_thpt) || null,
                    target_dgnl: parseFloat(editData.target_dgnl) || null
                })
                .eq('id', user.id);

            if (error) throw error;
            setIsEditing(false);
            window.location.reload();
        } catch (error) {
            console.error('Lỗi cập nhật hồ sơ:', error);
            alert('Cập nhật thất bại: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-gradient-to-br from-[#0f0716] via-[#1a0b2e] to-[#2d0a3d] min-h-screen pb-24 text-white font-display flex flex-col items-center">
            <div className="w-full max-w-4xl">
                <header className="flex items-center justify-between px-6 pt-8 pb-4">
                    <h1 className="text-xl font-bold tracking-tight">Trang Cá nhân</h1>
                    <button className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7f13ec]/20 text-white hover:bg-[#7f13ec]/30 transition-colors">
                        <span className="material-symbols-outlined">settings</span>
                    </button>
                </header>

                <section className="flex flex-col items-center px-6 py-6">
                    <div className="relative group">
                        <Avatar 
                            src={profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture}
                            name={profile?.display_name || user?.user_metadata?.full_name || 'Học sinh'}
                            id={user?.id}
                            size="h-32 w-32"
                            rounded="rounded-full"
                            className="relative border-4 border-[#0f0716]"
                        />
                    </div>
                    <div className="mt-4 text-center">
                        {isEditing ? (
                            <input
                                autoFocus
                                className="text-2xl font-bold bg-transparent border-b-2 border-[#7f13ec] text-center outline-none text-white w-56 pb-1 mt-1 placeholder-slate-500"
                                placeholder="Tên hiển thị..."
                                value={editData.display_name}
                                onChange={(e) => setEditData({ ...editData, display_name: e.target.value })}
                                maxLength={30}
                            />
                        ) : (
                            <h2 className="text-2xl font-bold">{profile?.display_name || user?.user_metadata?.full_name || 'Học sinh'}</h2>
                        )}

                        {isEditing ? (
                            <div className="mt-4 flex flex-col gap-3 items-center">
                                {/* Mode Toggle */}
                                <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl w-64">
                                    <button
                                        onClick={() => setEditData({ ...editData, user_mode: 'student' })}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${editData.user_mode === 'student' ? 'bg-[#7f13ec] text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        Học Sinh
                                    </button>
                                    <button
                                        onClick={() => setEditData({ ...editData, user_mode: 'university' })}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${editData.user_mode === 'university' ? 'bg-[#7f13ec] text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        Sinh Viên
                                    </button>
                                </div>
                                <input
                                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[#7f13ec] text-center w-64 text-white placeholder-slate-500"
                                    placeholder={editData.user_mode === 'student' ? "Trường THPT đang theo học..." : "Trường Đại học đang theo học..."}
                                    value={editData.university}
                                    onChange={(e) => setEditData({ ...editData, university: e.target.value })}
                                />
                            </div>
                        ) : (
                            <p className="text-slate-400 text-sm font-light mt-1 flex items-center justify-center gap-1">
                                <span className="material-symbols-outlined text-sm">{profile?.user_mode === 'student' ? 'local_library' : 'school'}</span>
                                {profile?.university || (profile?.user_mode === 'student' ? 'Chưa cập nhật trường THPT' : 'Chưa cập nhật trường ĐH')}
                            </p>
                        )}

                        {/* Upload Stat for Collaborator/Admin */}
                        {(profile?.role === 'collaborator' || profile?.role === 'admin') && !isEditing && (
                            <div className="mt-5 border border-[#10b981]/30 bg-[#10b981]/10 rounded-2xl p-4 flex flex-col justify-center shadow-lg md:min-w-[320px] max-w-sm mx-auto relative overflow-hidden">
                                <span className="absolute -right-4 -top-4 material-symbols-outlined text-8xl text-[#10b981]/10 -rotate-12 pointer-events-none">auto_stories</span>
                                <div className="flex items-center gap-4 relative z-10 w-fit mx-auto">
                                    <div className="w-12 h-12 rounded-xl bg-[#10b981]/20 flex items-center justify-center text-[#10b981] border border-[#10b981]/30">
                                        <span className="material-symbols-outlined text-[24px]">upload_file</span>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[10px] text-[#10b981] uppercase tracking-widest font-black mb-0.5">Tài liệu đã chia sẻ</p>
                                        <p className="text-2xl font-black text-white leading-none">{uploadCount} <span className="text-sm text-slate-400 font-medium tracking-normal lowercase">tài liệu</span></p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Rank Card */}
                        {(() => {
                            const rankInfo = getUserRank(completedCampaignsCount, profile?.role);
                            return (
                                <div className={`mt-6 p-4 rounded-2xl border ${rankInfo.bg} ${rankInfo.border} md:min-w-[320px] max-w-sm mx-auto shadow-lg`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 border-white/20 bg-white/10 ${rankInfo.color}`}>
                                            <span className="material-symbols-outlined text-2xl filter drop-shadow-md">{rankInfo.icon}</span>
                                        </div>
                                        <div className="text-left flex-1">
                                            <p className="text-xs uppercase tracking-widest font-black opacity-60 text-slate-500 mb-0.5">Danh hiệu hiện tại</p>
                                            <h3 className={`text-xl font-black ${rankInfo.color} uppercase tracking-wide flex items-center gap-2 drop-shadow-sm`}>
                                                {rankInfo.name}
                                            </h3>
                                        </div>
                                    </div>

                                    {rankInfo.progress && !rankInfo.isMax && (
                                        <div className="mt-4 pt-4 border-t border-current/10">
                                            <div className="flex justify-between items-end mb-1.5">
                                                <span className="text-xs font-bold opacity-70">Tiến trình lên {rankInfo.nextRank.name}</span>
                                                <span className="text-sm font-black">{completedCampaignsCount} / {rankInfo.progress.target}</span>
                                            </div>
                                            <div className="w-full h-2 rounded-full overflow-hidden bg-black/20 border border-white/10">
                                                <div
                                                    className="h-full bg-current transition-all duration-1000 ease-out rounded-full relative"
                                                    style={{ width: `${rankInfo.progress.percentage}%` }}
                                                >
                                                    <div className="absolute top-0 right-0 bottom-0 w-3 bg-white/40 blur-[2px] rounded-full" />
                                                </div>
                                            </div>
                                            <p className="text-xs text-center mt-2.5 opacity-60 font-medium">Hoàn thành thêm {rankInfo.progress.remaining} chiến dịch để thăng cấp</p>
                                        </div>
                                    )}

                                    {rankInfo.isMax && (
                                        <div className="mt-4 pt-3 border-t border-current/10">
                                            <p className="text-sm text-center font-bold opacity-80">Bạn đã đạt cảnh giới tối cao! 👑</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </section>

                <section className="px-6 py-4">
                    {/* Conditional Target UI Rendering */}
                    {(isEditing ? editData.user_mode : profile?.user_mode) === 'student' ? (
                        <>
                            <div className="bg-[#7f13ec]/10 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex flex-col gap-4 shadow-lg">
                                {/* THPT Target */}
                                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-slate-400 text-xs uppercase tracking-widest font-semibold flex items-center gap-1"><span className="material-symbols-outlined text-sm">menu_book</span> Điểm thi THPT</span>
                                        {isEditing ? (
                                            <div className="mt-1 flex items-center gap-2">
                                                <input
                                                    className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 w-20 text-xl font-bold outline-none focus:ring-1 focus:ring-[#7f13ec] text-white"
                                                    type="number" step="0.25" max="30"
                                                    value={editData.target_thpt}
                                                    onChange={(e) => setEditData({ ...editData, target_thpt: e.target.value })}
                                                />
                                                <span className="text-sm text-slate-500"> /30</span>
                                            </div>
                                        ) : (
                                            <div className="text-3xl font-bold text-white mt-1">{profile?.target_thpt || '24'}<span className="text-lg text-slate-500">/30</span></div>
                                        )}
                                    </div>
                                    <div className="relative flex items-center justify-center">
                                        <svg className="h-16 w-16 transform -rotate-90" viewBox="0 0 64 64">
                                            <circle className="text-white/10" cx="32" cy="32" fill="transparent" r="27" stroke="currentColor" strokeWidth="4"></circle>
                                            <circle className="text-[#7f13ec]" cx="32" cy="32" fill="transparent" r="27" stroke="currentColor" strokeDasharray="169.65" strokeDashoffset={`${169.65 - (169.65 * Math.min(Number(profile?.target_thpt || 24) / 30, 1))}`} strokeLinecap="round" strokeWidth="4"></circle>
                                        </svg>
                                    </div>
                                </div>
                                {/* DGNL Target */}
                                {(isEditing || profile?.target_dgnl) && (
                                    <div className="flex items-center justify-between pt-2">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-slate-400 text-xs uppercase tracking-widest font-semibold flex items-center gap-1"><span className="material-symbols-outlined text-sm">psychology</span> Điểm ĐGNL</span>
                                            {isEditing ? (
                                                <div className="mt-1 flex items-center gap-2">
                                                    <input
                                                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 w-20 text-xl font-bold outline-none focus:ring-1 focus:ring-blue-500 text-white placeholder-slate-600"
                                                        type="number" step="1" max="1200"
                                                        placeholder="Không thi"
                                                        value={editData.target_dgnl || ''}
                                                        onChange={(e) => setEditData({ ...editData, target_dgnl: e.target.value })}
                                                    />
                                                    <span className="text-sm text-slate-500"> /1200</span>
                                                </div>
                                            ) : (
                                                <div className="text-xl font-bold text-white mt-1">
                                                    {profile?.target_dgnl} <span className="text-sm text-slate-500">/1200</span>
                                                </div>
                                            )}
                                        </div>
                                        {profile?.target_dgnl && !isEditing && (
                                            <div className="relative flex items-center justify-center">
                                                <svg className="h-12 w-12 transform -rotate-90" viewBox="0 0 48 48">
                                                    <circle className="text-white/10" cx="24" cy="24" fill="transparent" r="19" stroke="currentColor" strokeWidth="3"></circle>
                                                    <circle className="text-blue-500" cx="24" cy="24" fill="transparent" r="19" stroke="currentColor" strokeDasharray="119.38" strokeDashoffset={`${119.38 - (119.38 * Math.min(Number(profile?.target_dgnl || 850) / 1200, 1))}`} strokeLinecap="round" strokeWidth="3"></circle>
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="bg-[#7f13ec]/10 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex items-center justify-between shadow-lg">
                            <div className="flex flex-col gap-1">
                                <span className="text-slate-400 text-xs uppercase tracking-widest font-semibold flex items-center gap-1"><span className="material-symbols-outlined text-sm">grade</span> Mục tiêu GPA</span>
                                {isEditing ? (
                                    <div className="mt-1 flex items-center gap-2">
                                        <input
                                            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 w-16 text-xl font-bold outline-none focus:ring-1 focus:ring-[#7f13ec] text-white"
                                            type="number"
                                            step="0.1"
                                            max="4.0"
                                            value={editData.target_gpa}
                                            onChange={(e) => setEditData({ ...editData, target_gpa: e.target.value })}
                                        />
                                        <span className="text-lg text-slate-500">/4.0</span>
                                    </div>
                                ) : (
                                    <div className="text-3xl font-bold text-white mt-1">{profile?.target_gpa || '4.0'}<span className="text-lg text-slate-500">/4.0</span></div>
                                )}
                                <div className="mt-3 py-1 px-3 rounded-full bg-[#7f13ec]/20 w-fit">
                                    <p className="text-[#7f13ec] text-xs font-medium">Hiện tại: {profile?.current_gpa || '0.0'}</p>
                                </div>
                            </div>
                            <div className="relative flex items-center justify-center">
                                <svg className="h-20 w-20 transform -rotate-90" viewBox="0 0 80 80">
                                    <circle className="text-white/10" cx="40" cy="40" fill="transparent" r="33" stroke="currentColor" strokeWidth="6"></circle>
                                    <circle className="text-[#7f13ec]" cx="40" cy="40" fill="transparent" r="33" stroke="currentColor" strokeDasharray="207.35" strokeDashoffset={`${207.35 - (207.35 * Math.min(Number(profile?.current_gpa || 0) / Number(profile?.target_gpa || 4), 1))}`} strokeLinecap="round" strokeWidth="6"></circle>
                                </svg>
                                <span className="absolute text-sm font-bold">{Math.round(Math.min(Number(profile?.current_gpa || 0) / Number(profile?.target_gpa || 4), 1) * 100)}%</span>
                            </div>
                        </div>
                    )}
                </section>

                <section className="px-6 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold">Đang học kỳ này</h3>
                        <span className="text-[#7f13ec] text-sm font-medium">HK241</span>
                    </div>
                    <div className="flex flex-col gap-3">
                        {loadingSubjects ? (
                            <div className="py-8 flex justify-center">
                                <span className="material-symbols-outlined animate-spin text-slate-400">sync</span>
                            </div>
                        ) : subjects.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 text-sm">
                                Bạn chưa có môn học nào. Hãy vào trang Tính điểm để Thêm môn và Lưu lại.
                            </div>
                        ) : (
                            subjects.map(sub => (
                                <div key={sub.id} className="bg-[#7f13ec]/10 backdrop-blur-md border border-white/10 rounded-xl p-4 flex flex-col gap-3 relative group">
                                    <div className="flex justify-between items-start pr-8">
                                        <div>
                                            <h4 className="font-semibold text-white">{sub.name}</h4>
                                            <p className="text-xs text-slate-400">{sub.credits} Tín chỉ / Hệ số</p>
                                        </div>
                                        <span className="text-xs font-bold bg-[#7f13ec]/20 text-[#c88df3] px-2 py-1 rounded">
                                            Điểm: {sub.grade_number}
                                        </span>
                                    </div>
                                    {/* Calculate progress visually based on base 10 */}
                                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-[#7f13ec] h-full rounded-full" style={{ width: `${Math.min((sub.grade_number / 10) * 100, 100)}%` }}></div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteSubject(sub.id)}
                                        className="absolute top-4 right-4 text-slate-500 hover:text-red-400 transition-colors opacity-100 md:opacity-0 group-hover:opacity-100 bg-[#1a0b2e] rounded-full p-1"
                                        title="Xoá môn học"
                                    >
                                        <span className="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                <section className="px-6 py-8 flex flex-col items-center gap-6">
                    {isEditing ? (
                        <div className="flex gap-3 w-full">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="flex-1 py-4 rounded-xl bg-slate-800 border border-slate-700 font-semibold text-white hover:bg-slate-700 transition-colors shadow-lg"
                            >
                                Há»§y
                            </button>
                            <button
                                onClick={handleSaveProfile}
                                disabled={isSaving}
                                className="flex-[2] py-4 rounded-xl bg-[#7f13ec] font-semibold text-white hover:bg-[#9125fc] transition-colors shadow-lg shadow-[#7f13ec]/30 flex items-center justify-center disabled:opacity-70"
                            >
                                {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="w-full py-4 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 font-semibold text-white hover:bg-white/10 transition-colors shadow-lg flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-sm">edit</span>
                            Chỉnh sửa hồ sơ
                        </button>
                    )}

                    <button
                        onClick={handleLogout}
                        className="text-slate-500 text-sm font-medium hover:text-red-400 transition-colors"
                    >
                        Đăng xuất
                    </button>
                </section>
            </div>
        </div>
    );
}
