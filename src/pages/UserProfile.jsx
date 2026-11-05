import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUserRank } from '../utils/rankHelper';
import { getLevelFromExp, getLevelAccent } from '../utils/levelHelper';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/Avatar';
import ProgressBar from '../components/ui/ProgressBar';

export default function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completedTasksCount, setCompletedTasksCount] = useState(0);

  const fetchPublicProfile = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      setUserProfile(data);

      const { count } = await supabase
        .from('user_completed_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', id);

      if (count !== null) setCompletedTasksCount(count);
    } catch (err) {
      console.error('Lỗi tải hồ sơ chiến binh:', err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (currentUser && currentUser.id === id) {
      navigate('/profile', { replace: true });
      return;
    }
    fetchPublicProfile();
  }, [currentUser, fetchPublicProfile, id, navigate]);

  const formatTime = (minutes) => {
    if (!minutes || minutes <= 0) return '0 phút';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} phút`;
    if (m === 0) return `${h} giờ`;
    return `${h} giờ ${m} phút`;
  };

  if (loading) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center py-24 gap-3 bg-background">
        <span
          className="material-symbols-outlined animate-spin text-4xl text-primary"
          aria-hidden="true"
        >
          sync
        </span>
        <p className="text-xs text-secondary-text">Đang tải thông tin chiến binh...</p>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center py-24 px-4 text-center bg-background">
        <span
          className="material-symbols-outlined text-5xl text-muted-foreground mb-3"
          aria-hidden="true"
        >
          person_off
        </span>
        <h2 className="text-xl font-display font-bold text-foreground mb-1">
          Không tìm thấy chiến binh này
        </h2>
        <p className="text-xs text-secondary-text mb-6">
          Hồ sơ này không tồn tại hoặc đã bị ẩn.
        </p>
        <Link to="/arena" className="btn-arena btn-arena-primary btn-arena-sm">
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            arrow_back
          </span>
          Quay lại Đấu Trường
        </Link>
      </div>
    );
  }

  const rankInfo = getUserRank(
    userProfile.total_study_minutes || 0,
    userProfile.is_thong_soai,
  );
  const levelInfo = getLevelFromExp(userProfile.exp || 0);
  const levelAccent = getLevelAccent(levelInfo.level);

  return (
    <div className="bg-background font-sans text-foreground min-h-full pb-24">
      {/* Banner Header */}
      <div className="h-36 sm:h-44 bg-gradient-to-r from-primary-soft via-paper to-gold-soft/60 relative overflow-hidden border-b border-border">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface/90 hover:bg-surface text-foreground text-xs font-bold border border-border shadow-xs transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            arrow_back
          </span>
          Quay lại
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10 space-y-6">
        {/* Thẻ Định Danh Chiến Binh */}
        <div className="imperial-frame p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
              <div className="relative">
                <Avatar
                  src={userProfile.avatar_url}
                  name={userProfile.full_name}
                  className="w-24 h-24 border-4 border-surface shadow-md"
                  textSize="text-3xl"
                />
                <div
                  className={`absolute -bottom-2 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:-right-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${rankInfo.bg} ${rankInfo.color} ${rankInfo.border} shadow-xs flex items-center gap-1`}
                >
                  <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                    {rankInfo.icon}
                  </span>
                  {rankInfo.name}
                </div>
              </div>

              <div className="mt-3 sm:mt-0">
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <h1 className="text-2xl font-display font-extrabold text-foreground">
                    {userProfile.full_name || 'Chiến binh ẩn danh'}
                  </h1>
                  <span
                    className={`tabular inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${levelAccent.badge}`}
                  >
                    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                      bolt
                    </span>
                    Lv.{levelInfo.level} · {levelInfo.totalExp} EXP
                  </span>
                  {userProfile.role === 'admin' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary text-white">
                      Quản trị viên
                    </span>
                  )}
                  {userProfile.role === 'collaborator' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-jade text-white">
                      Cộng tác viên
                    </span>
                  )}
                </div>
                <p className="text-xs text-secondary-text mt-1 flex items-center justify-center sm:justify-start gap-1">
                  <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                    calendar_month
                  </span>
                  Gia nhập đấu trường:{' '}
                  {new Date(userProfile.created_at).toLocaleDateString('vi-VN')}
                </p>
                {userProfile.bio && (
                  <p className="text-xs text-secondary-text italic mt-2.5 bg-paper px-3.5 py-2 rounded-xl border border-border max-w-lg">
                    &ldquo;{userProfile.bio}&rdquo;
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Thống kê Chiến tích */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="paper-card p-5 flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center border no-shrink ${rankInfo.bg} ${rankInfo.color} ${rankInfo.border}`}
            >
              <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                {rankInfo.icon}
              </span>
            </div>
            <div>
              <p className="text-xs text-secondary-text">Cấp bậc hiện tại</p>
              <p className={`text-lg font-display font-extrabold ${rankInfo.color}`}>
                {rankInfo.name}
              </p>
            </div>
          </div>

          <div className="paper-card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary-soft border border-primary/30 text-primary flex items-center justify-center no-shrink">
              <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                local_fire_department
              </span>
            </div>
            <div>
              <p className="text-xs text-secondary-text">Tổng thời gian luyện tập</p>
              <p className="text-lg font-display font-extrabold text-foreground tabular">
                {formatTime(userProfile.total_study_minutes)}
              </p>
            </div>
          </div>

          <div className="paper-card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-completed-soft border border-completed-border text-completed flex items-center justify-center no-shrink">
              <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                task_alt
              </span>
            </div>
            <div>
              <p className="text-xs text-secondary-text">Mục tiêu lộ trình đã xong</p>
              <p className="text-lg font-display font-extrabold text-foreground tabular">
                {completedTasksCount} nhiệm vụ
              </p>
            </div>
          </div>
        </div>

        {/* Thanh Level EXP công khai */}
        <div className="paper-card p-5">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-secondary-text font-medium flex items-center gap-2">
              <span
                className={`tabular inline-flex items-center gap-1 font-extrabold px-2 py-0.5 rounded-md border ${levelAccent.badge}`}
              >
                Lv.{levelInfo.level}
              </span>
              <span>Tiến độ kinh nghiệm (EXP)</span>
            </span>
            <span className="tabular font-bold text-foreground">
              {levelInfo.expInLevel} / {levelInfo.expForNext} EXP ({levelInfo.progressPct}%)
            </span>
          </div>
          <ProgressBar
            value={levelInfo.expInLevel}
            max={levelInfo.expForNext}
            tone="jade"
            showPercent={false}
          />
        </div>

        {/* Thông tin Trường lớp & Mục tiêu */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 paper-card p-6 space-y-4">
            <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2">
              <span className="material-symbols-outlined text-primary" aria-hidden="true">
                school
              </span>
              Thông tin trường lớp &amp; Nguyện vọng
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="p-4 rounded-xl bg-paper border border-border">
                <p className="text-xs text-secondary-text mb-1">Trường THPT đang theo học</p>
                <p className="text-sm font-bold text-foreground">
                  {userProfile.school_name || 'Chưa tiết lộ'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-paper border border-border">
                <p className="text-xs text-secondary-text mb-1">Khối lớp</p>
                <p className="text-sm font-bold text-foreground">
                  {userProfile.grade || 'Lớp 12'}
                </p>
              </div>

              <div className="sm:col-span-2 p-4 rounded-xl bg-primary-soft/60 border border-primary/25 flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center no-shrink">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    account_balance
                  </span>
                </div>
                <div>
                  <p className="text-xs text-primary font-bold">
                    Mục tiêu Nguyện vọng 1 (Đại học mơ ước)
                  </p>
                  <p className="text-base font-display font-bold text-foreground">
                    {userProfile.target_university || 'Đang ấp ủ mục tiêu bí mật'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="paper-card p-6 space-y-4">
            <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2">
              <span className="material-symbols-outlined text-accent" aria-hidden="true">
                flag
              </span>
              Mục tiêu chinh phục
            </h2>

            <div className="space-y-3 pt-1">
              <div className="p-4 rounded-xl bg-gold-soft/60 border border-gold flex items-center justify-between">
                <div>
                  <p className="text-xs text-gold-dark font-bold">Điểm THPT Quốc Gia</p>
                  <p className="text-[11px] text-secondary-text">Thang điểm 30</p>
                </div>
                <span className="text-2xl font-display font-extrabold text-accent tabular">
                  {userProfile.target_thpt || '27.0'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-jade-soft border border-jade-border flex items-center justify-between">
                <div>
                  <p className="text-xs text-jade font-bold">Điểm GPA Cấp 3</p>
                  <p className="text-[11px] text-secondary-text">Thang điểm 10</p>
                </div>
                <span className="text-2xl font-display font-extrabold text-jade tabular">
                  {userProfile.target_gpa || '8.5'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
