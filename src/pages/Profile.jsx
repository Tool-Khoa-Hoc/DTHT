import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getUserRank, RANK_TIERS } from '../utils/rankHelper';
import {
  getLevelFromExp,
  getLevelAccent,
  formatStudyTime,
  DAILY_STUDY_SECONDS_CAP,
} from '../utils/levelHelper';
import { sanitizeExternalUrl } from '../utils/urlSecurity';
import Avatar from '../components/Avatar';
import ProgressBar from '../components/ui/ProgressBar';
import { useToast } from '../components/ui/ToastProvider';

function normalizeUserMode(raw) {
  if (raw === 'student' || raw === 'thpt') return 'student';
  if (raw === 'university' || raw === 'uni' || raw === 'sv') return 'university';
  return 'university';
}

function clampNumeric32(value, fallback = 3.2) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return Math.round(Math.min(9.99, num) * 100) / 100;
}

function detectGoogleIdentity(user) {
  if (!user) return false;
  if (user.app_metadata?.provider === 'google') return true;
  if (Array.isArray(user.app_metadata?.providers) && user.app_metadata.providers.includes('google')) {
    return true;
  }
  if (Array.isArray(user.identities)) {
    return user.identities.some((item) => item?.provider === 'google');
  }
  return false;
}

export default function Profile() {
  const navigate = useNavigate();
  const {
    user,
    profile,
    refreshProfile,
    isGoogleLinked,
    signInWithGoogle,
    signOut,
  } = useAuth();
  const { showToast } = useToast();

  const fileInputRef = useRef(null);

  // Live extra data from tram_sv
  const [extraProfile, setExtraProfile] = useState({
    major: '',
    starting_year: '',
    full_name: '',
    is_vip: false,
    vip_expired_at: null,
    created_at: null,
  });
  const [completedCampaignsCount, setCompletedCampaignsCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [uploadCount, setUploadCount] = useState(0);
  const [studyDailyRows, setStudyDailyRows] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // Edit mode & form fields
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const [isRankModalOpen, setIsRankModalOpen] = useState(false);

  const [formState, setFormState] = useState({
    display_name: '',
    full_name: '',
    university: '',
    major: '',
    starting_year: '',
    user_mode: 'university',
    target_gpa: '3.20',
    target_thpt: '26.0',
    target_dgnl: '900',
    avatar_url: '',
  });

  const fetchProfileDashboard = useCallback(async () => {
    if (!user) {
      setLoadingStats(false);
      return;
    }
    setLoadingStats(true);
    try {
      const [
        ownRowRes,
        campCountRes,
        followersRes,
        followingRes,
        docsCountRes,
        dailyRes,
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('major, starting_year, full_name, is_vip, vip_expired_at, created_at')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('campaigns')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_completed', true),
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', user.id),
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', user.id),
        supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('uploaded_by', user.id),
        supabase
          .from('study_daily')
          .select('study_date, seconds, exp, updated_at')
          .eq('user_id', user.id)
          .order('study_date', { ascending: false })
          .limit(7),
      ]);

      if (!ownRowRes.error && ownRowRes.data) {
        setExtraProfile({
          major: ownRowRes.data.major || '',
          starting_year:
            ownRowRes.data.starting_year == null ? '' : String(ownRowRes.data.starting_year),
          full_name: ownRowRes.data.full_name || '',
          is_vip: Boolean(ownRowRes.data.is_vip),
          vip_expired_at: ownRowRes.data.vip_expired_at || null,
          created_at: ownRowRes.data.created_at || null,
        });
      }

      if (!campCountRes.error) {
        setCompletedCampaignsCount(campCountRes.count || 0);
      }
      if (!followersRes.error) {
        setFollowersCount(followersRes.count || 0);
      }
      if (!followingRes.error) {
        setFollowingCount(followingRes.count || 0);
      }
      if (!docsCountRes.error) {
        setUploadCount(docsCountRes.count || 0);
      }
      if (!dailyRes.error && dailyRes.data) {
        setStudyDailyRows(dailyRes.data);
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu hồ sơ:', err);
    } finally {
      setLoadingStats(false);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (!cancelled) {
        await fetchProfileDashboard();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchProfileDashboard]);

  // Populate edit form whenever user opens Edit mode
  const handleOpenEdit = () => {
    setFormState({
      display_name:
        profile?.display_name ||
        extraProfile.full_name ||
        user?.user_metadata?.full_name ||
        '',
      full_name: extraProfile.full_name || profile?.full_name || '',
      university: profile?.university || '',
      major: extraProfile.major || profile?.major || '',
      starting_year:
        extraProfile.starting_year ||
        (profile?.starting_year != null ? String(profile.starting_year) : ''),
      user_mode: normalizeUserMode(profile?.user_mode),
      target_gpa:
        profile?.target_gpa != null && Number(profile.target_gpa) <= 4
          ? String(profile.target_gpa)
          : '3.20',
      target_thpt: profile?.target_thpt != null ? String(profile.target_thpt) : '26.0',
      target_dgnl: profile?.target_dgnl != null ? String(profile.target_dgnl) : '900',
      avatar_url: profile?.avatar_url || '',
    });
    setIsEditing(true);
  };

  const handleAvatarFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      showToast('Vui lòng chỉ chọn tệp hình ảnh (JPG, PNG, WEBP, GIF).', 'warning');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast('Ảnh đại diện không vượt quá 2MB. Hãy chọn ảnh nhẹ hơn.', 'warning');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const rawExt = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
      const filePath = `${user.id}/avatar_${Date.now()}.${rawExt || 'png'}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        // Graceful fallback if `avatars` storage bucket is not configured on project
        console.warn('Storage upload fallback:', uploadError.message);
        if (!isEditing) handleOpenEdit();
        showToast(
          'Kho lưu trữ ảnh trực tiếp chưa bật. Bạn có thể dán liên kết ảnh (URL) vào ô Ảnh đại diện bên dưới!',
          'info',
          5000,
        );
        return;
      }

      const { data: pubData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = pubData?.publicUrl;

      if (!publicUrl) {
        throw new Error('Không lấy được đường dẫn ảnh công khai.');
      }

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateErr) throw updateErr;

      setFormState((prev) => ({ ...prev, avatar_url: publicUrl }));
      await refreshProfile?.();
      showToast('Đã cập nhật ảnh đại diện mới!', 'success');
    } catch (err) {
      console.error('Lỗi cập nhật ảnh đại diện:', err);
      showToast('Không thể tải ảnh đại diện: ' + err.message, 'error');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!user) return;

    const cleanDisplayName = formState.display_name.trim();
    if (!cleanDisplayName) {
      showToast('Vui lòng nhập Tên hiển thị trên Bảng Vàng.', 'warning');
      return;
    }

    let safeAvatarUrl = null;
    if (formState.avatar_url.trim()) {
      safeAvatarUrl = sanitizeExternalUrl(formState.avatar_url.trim());
      if (!safeAvatarUrl) {
        showToast('Đường dẫn ảnh đại diện (URL) không hợp lệ (cần bắt đầu bằng https://).', 'error');
        return;
      }
    }

    let parsedYear = null;
    if (String(formState.starting_year).trim() !== '') {
      const y = parseInt(formState.starting_year, 10);
      if (!Number.isFinite(y) || y < 1990 || y > 2040) {
        showToast('Năm nhập học / khoá thi phải nằm trong khoảng 1990 – 2040.', 'warning');
        return;
      }
      parsedYear = y;
    }

    // Clamp target_gpa strictly <= 4.00 (and <= 9.99 for numeric(3,2))
    const parsedTargetGpa = clampNumeric32(
      Math.min(4.0, Math.max(0, Number(formState.target_gpa) || 3.2)),
      3.2,
    );
    const parsedTargetThpt = Math.max(0, Math.min(30, Number(formState.target_thpt) || 26.0));
    const parsedTargetDgnl = Math.max(
      0,
      Math.min(1500, Math.round(Number(formState.target_dgnl) || 900)),
    );

    setIsSaving(true);
    try {
      // IMPORTANT: Never write exp / study_seconds / study_streak (trg_protect_exp)
      const payload = {
        display_name: cleanDisplayName,
        full_name: formState.full_name.trim() || cleanDisplayName,
        university: formState.university.trim() || null,
        major: formState.major.trim() || null,
        starting_year: parsedYear,
        user_mode: formState.user_mode,
        target_gpa: parsedTargetGpa,
        target_thpt: parsedTargetThpt,
        target_dgnl: parsedTargetDgnl,
        avatar_url: safeAvatarUrl,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
      if (error) throw error;

      setIsEditing(false);
      await Promise.all([refreshProfile?.(), fetchProfileDashboard()]);
      showToast('Đã lưu thông tin hồ sơ thành công!', 'success');
    } catch (err) {
      console.error('Lỗi cập nhật hồ sơ:', err);
      showToast('Không thể cập nhật hồ sơ: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectGoogle = async () => {
    setIsLinkingGoogle(true);
    try {
      if (typeof signInWithGoogle === 'function') {
        await signInWithGoogle('/profile');
      } else {
        const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent('/profile')}`;
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo },
        });
        if (error) throw error;
      }
    } catch (err) {
      console.error('Lỗi kết nối Google:', err);
      showToast('Không thể chuyển hướng đăng nhập Google: ' + err.message, 'error');
      setIsLinkingGoogle(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (typeof signOut === 'function') {
        await signOut();
      } else {
        await supabase.auth.signOut();
      }
      navigate('/auth');
    } catch (err) {
      showToast('Không thể đăng xuất: ' + err.message, 'error');
    }
  };

  const googleConnected = Boolean(isGoogleLinked ?? detectGoogleIdentity(user));
  const activeMode = normalizeUserMode(profile?.user_mode);
  const displayName =
    profile?.display_name ||
    extraProfile.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'Sĩ tử';
  const currentAvatar =
    profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '';

  const expTotal = Number(profile?.exp) || 0;
  const studySeconds = Number(profile?.study_seconds) || 0;
  const studyStreak = Number(profile?.study_streak) || 0;

  const rankInfo = getUserRank(
    completedCampaignsCount,
    profile?.role,
    profile?.is_approved_bang_chu,
  );
  const levelInfo = getLevelFromExp(expTotal);
  const levelAccent = getLevelAccent(levelInfo.level);

  return (
    <div className="bg-background font-sans text-foreground min-h-full pb-24">
      {/* Imperial Top Banner */}
      <div className="h-36 sm:h-44 bg-gradient-to-r from-primary-soft via-paper to-gold-soft/60 relative overflow-hidden border-b border-border">
        <span
          aria-hidden="true"
          className="hanzi-watermark absolute right-8 top-4 text-8xl font-bold text-primary/8 select-none pointer-events-none"
        >
          名帖
        </span>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10 space-y-6">
        {/* SCHOLAR IDENTITY HEADER CARD */}
        <section className="imperial-frame p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-5">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              {/* Avatar with Optional Upload */}
              <div className="relative group shrink-0">
                <Avatar
                  src={currentAvatar}
                  name={displayName}
                  className="w-24 h-24 border-4 border-surface shadow-md"
                  textSize="text-3xl"
                />

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarFileChange}
                  accept="image/*"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  title="Tải ảnh đại diện mới"
                  className="absolute inset-0 rounded-full bg-foreground/55 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity cursor-pointer"
                >
                  {isUploadingAvatar ? (
                    <span className="material-symbols-outlined animate-spin" aria-hidden="true">
                      sync
                    </span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-xl" aria-hidden="true">
                        photo_camera
                      </span>
                      <span className="text-[10px] font-bold mt-0.5">Đổi ảnh</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Đổi ảnh đại diện"
                  className="sm:hidden absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md border-2 border-surface cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">
                    photo_camera
                  </span>
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-col sm:flex-row items-center gap-2 flex-wrap justify-center sm:justify-start">
                  <h1 className="text-2xl font-display font-extrabold text-foreground">
                    {displayName}
                  </h1>

                  <div className="flex items-center gap-1.5 flex-wrap justify-center">
                    <button
                      type="button"
                      onClick={() => setIsRankModalOpen(true)}
                      title="Nhấn để xem Hệ thống Quân hàm"
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${rankInfo.bg} ${rankInfo.color} ${rankInfo.border} hover:opacity-85 transition-opacity cursor-pointer`}
                    >
                      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                        {rankInfo.icon}
                      </span>
                      <span>{rankInfo.name}</span>
                    </button>

                    <span
                      className={`tabular inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${levelAccent.badge}`}
                    >
                      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                        bolt
                      </span>
                      Lv.{levelInfo.level}
                    </span>

                    {profile?.role === 'admin' && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary text-primary-foreground">
                        Quản trị viên
                      </span>
                    )}
                    {profile?.role === 'collaborator' && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-jade text-white">
                        Cộng tác viên
                      </span>
                    )}
                    {extraProfile.is_vip && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gold-soft text-gold-dark border border-gold">
                        VIP
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-secondary-text">
                  {user?.email || 'Chưa có email'}
                  {profile?.university ? ` · ${profile.university}` : ''}
                </p>

                {/* Social & Achievement Counters */}
                <div className="flex items-center justify-center sm:justify-start gap-4 pt-1 flex-wrap text-xs">
                  <span className="text-secondary-text">
                    <strong className="text-foreground font-display tabular">
                      {followersCount}
                    </strong>{' '}
                    người theo dõi
                  </span>
                  <span className="text-border-strong">•</span>
                  <span className="text-secondary-text">
                    <strong className="text-foreground font-display tabular">
                      {followingCount}
                    </strong>{' '}
                    đang theo dõi
                  </span>
                  <span className="text-border-strong">•</span>
                  <span className="text-secondary-text">
                    <strong className="text-foreground font-display tabular">
                      {completedCampaignsCount}
                    </strong>{' '}
                    chiến dịch hoàn thành
                  </span>
                  <span className="text-border-strong">•</span>
                  <span className="text-secondary-text">
                    <strong className="text-foreground font-display tabular">{uploadCount}</strong>{' '}
                    tài liệu đóng góp
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 w-full sm:w-auto shrink-0">
              <button
                type="button"
                onClick={() => (isEditing ? setIsEditing(false) : handleOpenEdit())}
                className="flex-1 sm:flex-initial btn-arena btn-arena-secondary btn-arena-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  {isEditing ? 'close' : 'edit'}
                </span>
                <span>{isEditing ? 'Đóng' : 'Chỉnh sửa'}</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="btn-arena btn-arena-sm bg-primary-soft text-primary border border-primary/30 hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  logout
                </span>
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>
        </section>

        {/* GOOGLE ACCOUNT LINK STATUS CARD */}
        <section
          className={`paper-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            googleConnected ? 'border-jade-border bg-jade-soft/35' : 'border-gold bg-gold-soft/45'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                googleConnected
                  ? 'bg-jade-soft text-jade border-jade-border'
                  : 'bg-gold-soft text-gold-dark border-gold'
              }`}
            >
              <span className="material-symbols-outlined text-xl" aria-hidden="true">
                {googleConnected ? 'verified_user' : 'link'}
              </span>
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-display font-bold text-foreground">
                {googleConnected
                  ? 'Tài khoản đã xác thực với Google'
                  : 'Chưa kết nối phiên đăng nhập Google'}
              </h2>
              <p className="text-xs text-secondary-text mt-0.5">
                {googleConnected
                  ? 'Bạn có thể truy cập mượt mà các khoá học Google Sheets và thư mục Google Drive trong mục Học Online.'
                  : 'Đăng nhập bằng Google cùng địa chỉ email để mở thẳng bảng tính khoá học và tài liệu Google Drive không bị chặn quyền.'}
              </p>
            </div>
          </div>

          {!googleConnected && (
            <button
              type="button"
              onClick={handleConnectGoogle}
              disabled={isLinkingGoogle}
              className="btn-arena btn-arena-gold btn-arena-sm shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                login
              </span>
              <span>{isLinkingGoogle ? 'Đang chuyển hướng...' : 'Đăng nhập với Google'}</span>
            </button>
          )}
        </section>

        {isEditing ? (
          /* =============================================================== */
          /* EDIT PROFILE FORM (REAL tram_sv COLUMNS ONLY)                   */
          /* =============================================================== */
          <form onSubmit={handleSaveProfile} className="paper-card p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-lg font-display font-extrabold text-foreground">
                  Cập Nhật Danh Thiếp Học Giả
                </h2>
                <p className="text-xs text-secondary-text">
                  Lưu trực tiếp vào hệ thống Trạm Sinh Viên
                </p>
              </div>
              <div className="inline-flex p-1 rounded-xl bg-surface-alt border border-border gap-1">
                <button
                  type="button"
                  onClick={() => setFormState((s) => ({ ...s, user_mode: 'university' }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    formState.user_mode === 'university'
                      ? 'bg-paper text-primary border border-border-strong'
                      : 'text-secondary-text hover:text-foreground'
                  }`}
                >
                  Sinh viên ĐH
                </button>
                <button
                  type="button"
                  onClick={() => setFormState((s) => ({ ...s, user_mode: 'student' }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    formState.user_mode === 'student'
                      ? 'bg-paper text-primary border border-border-strong'
                      : 'text-secondary-text hover:text-foreground'
                  }`}
                >
                  Học sinh THPT
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="prof-display-name"
                  className="block text-xs font-bold text-foreground mb-1.5"
                >
                  Tên hiển thị (Bảng Vàng &amp; Cộng đồng) <span className="text-primary">*</span>
                </label>
                <input
                  id="prof-display-name"
                  type="text"
                  required
                  maxLength={50}
                  value={formState.display_name}
                  onChange={(e) => setFormState((s) => ({ ...s, display_name: e.target.value }))}
                  placeholder="VD: Minh Quân · Bách Khoa"
                  className="w-full px-3.5 py-2.5 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="prof-full-name"
                  className="block text-xs font-bold text-foreground mb-1.5"
                >
                  Họ và tên đầy đủ
                </label>
                <input
                  id="prof-full-name"
                  type="text"
                  maxLength={80}
                  value={formState.full_name}
                  onChange={(e) => setFormState((s) => ({ ...s, full_name: e.target.value }))}
                  placeholder="VD: Nguyễn Minh Quân"
                  className="w-full px-3.5 py-2.5 bg-paper border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="prof-university"
                  className="block text-xs font-bold text-foreground mb-1.5"
                >
                  {formState.user_mode === 'student'
                    ? 'Trường THPT đang học / Trường ĐH mục tiêu'
                    : 'Trường Đại học / Học viện'}
                </label>
                <input
                  id="prof-university"
                  type="text"
                  value={formState.university}
                  onChange={(e) => setFormState((s) => ({ ...s, university: e.target.value }))}
                  placeholder={
                    formState.user_mode === 'student'
                      ? 'VD: THPT Chuyên Phan Bội Châu'
                      : 'VD: Đại học Bách Khoa Hà Nội'
                  }
                  className="w-full px-3.5 py-2.5 bg-paper border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="prof-major"
                  className="block text-xs font-bold text-foreground mb-1.5"
                >
                  {formState.user_mode === 'student'
                    ? 'Khối xét tuyển / Ngành mơ ước'
                    : 'Chuyên ngành đào tạo'}
                </label>
                <input
                  id="prof-major"
                  type="text"
                  value={formState.major}
                  onChange={(e) => setFormState((s) => ({ ...s, major: e.target.value }))}
                  placeholder={
                    formState.user_mode === 'student'
                      ? 'VD: Khoa học Máy tính (Khối A00 / A01)'
                      : 'VD: Kỹ thuật Phần mềm'
                  }
                  className="w-full px-3.5 py-2.5 bg-paper border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="prof-year"
                  className="block text-xs font-bold text-foreground mb-1.5"
                >
                  {formState.user_mode === 'student' ? 'Năm dự thi Đại học' : 'Năm nhập học'}
                </label>
                <input
                  id="prof-year"
                  type="number"
                  min="1990"
                  max="2040"
                  value={formState.starting_year}
                  onChange={(e) => setFormState((s) => ({ ...s, starting_year: e.target.value }))}
                  placeholder="VD: 2026"
                  className="w-full px-3.5 py-2.5 bg-paper border border-border rounded-xl text-sm text-foreground tabular focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="prof-avatar-url"
                  className="block text-xs font-bold text-foreground mb-1.5"
                >
                  Liên kết ảnh đại diện (URL tuỳ chọn)
                </label>
                <div className="flex gap-2">
                  <input
                    id="prof-avatar-url"
                    type="url"
                    value={formState.avatar_url}
                    onChange={(e) => setFormState((s) => ({ ...s, avatar_url: e.target.value }))}
                    placeholder="https://..."
                    className="flex-1 px-3.5 py-2.5 bg-paper border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="px-3 py-2 rounded-xl bg-surface-alt border border-border hover:border-primary text-xs font-bold text-foreground cursor-pointer shrink-0"
                  >
                    Tải tệp
                  </button>
                </div>
              </div>
            </div>

            {/* Academic Score Targets */}
            <div className="pt-2 border-t border-border">
              <h3 className="text-xs font-display font-bold text-secondary-text uppercase tracking-wider mb-3">
                Chỉ tiêu học thuật cá nhân
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="prof-target-gpa"
                    className="block text-xs font-bold text-foreground mb-1"
                  >
                    Mục tiêu GPA Đại học (Hệ 4.0)
                  </label>
                  <input
                    id="prof-target-gpa"
                    type="number"
                    step="0.05"
                    min="0"
                    max="4"
                    value={formState.target_gpa}
                    onChange={(e) => setFormState((s) => ({ ...s, target_gpa: e.target.value }))}
                    className="w-full px-3 py-2 bg-paper border border-border rounded-xl text-sm font-bold text-primary tabular focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label
                    htmlFor="prof-target-thpt"
                    className="block text-xs font-bold text-foreground mb-1"
                  >
                    Mục tiêu THPTQG (/30)
                  </label>
                  <input
                    id="prof-target-thpt"
                    type="number"
                    step="0.25"
                    min="0"
                    max="30"
                    value={formState.target_thpt}
                    onChange={(e) => setFormState((s) => ({ ...s, target_thpt: e.target.value }))}
                    className="w-full px-3 py-2 bg-paper border border-border rounded-xl text-sm font-bold text-accent tabular focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label
                    htmlFor="prof-target-dgnl"
                    className="block text-xs font-bold text-foreground mb-1"
                  >
                    Mục tiêu ĐGNL (HSA / V-ACT)
                  </label>
                  <input
                    id="prof-target-dgnl"
                    type="number"
                    step="5"
                    min="0"
                    max="1500"
                    value={formState.target_dgnl}
                    onChange={(e) => setFormState((s) => ({ ...s, target_dgnl: e.target.value }))}
                    className="w-full px-3 py-2 bg-paper border border-border rounded-xl text-sm font-bold text-jade tabular focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="btn-arena btn-arena-secondary btn-arena-sm cursor-pointer"
              >
                Huỷ bỏ
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="btn-arena btn-arena-primary btn-arena-sm cursor-pointer disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  {isSaving ? 'hourglass_empty' : 'save'}
                </span>
                <span>{isSaving ? 'Đang lưu...' : 'Lưu hồ sơ'}</span>
              </button>
            </div>
          </form>
        ) : (
          /* =============================================================== */
          /* VIEW MODE: GAMIFICATION, DAILY LOGS, ACADEMICS & TARGETS        */
          /* =============================================================== */
          <div className="space-y-6">
            {/* RANK & CÔNG LỰC PROGRESSION CARD */}
            <section className="paper-card p-6 space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center border shrink-0 ${rankInfo.bg} ${rankInfo.color} ${rankInfo.border}`}
                  >
                    <span className="material-symbols-outlined text-3xl" aria-hidden="true">
                      {rankInfo.icon}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-secondary-text uppercase tracking-wider">
                        Quân hàm Chiến dịch
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsRankModalOpen(true)}
                        className="text-xs text-primary hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                          info
                        </span>
                        <span>Bảng quân hàm</span>
                      </button>
                    </div>
                    <h2 className={`text-2xl font-display font-extrabold ${rankInfo.color}`}>
                      {rankInfo.name}
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 w-full sm:w-auto">
                  <div className="bg-paper px-3.5 py-2.5 rounded-xl border border-border">
                    <p className="text-[11px] text-secondary-text">Giờ học xác thực</p>
                    <p className="text-base font-display font-extrabold text-primary tabular">
                      {formatStudyTime(studySeconds)}
                    </p>
                  </div>
                  <div className="bg-paper px-3.5 py-2.5 rounded-xl border border-border">
                    <p className="text-[11px] text-secondary-text">Chuỗi chuyên cần</p>
                    <p className="text-base font-display font-extrabold text-accent tabular flex items-center gap-1">
                      <span
                        className="material-symbols-outlined text-base text-primary"
                        aria-hidden="true"
                      >
                        local_fire_department
                      </span>
                      {studyStreak} ngày
                    </p>
                  </div>
                </div>
              </div>

              {/* Campaign Rank Progress */}
              {rankInfo.nextRank && rankInfo.progress ? (
                <div className="bg-paper p-4 rounded-xl border border-border">
                  <ProgressBar
                    value={rankInfo.progress.percentage}
                    max={100}
                    tone="primary"
                    label={`Tiến trình thăng Quân hàm → ${rankInfo.nextRank.name}`}
                    sublabel={`${completedCampaignsCount}/${rankInfo.progress.target} chiến dịch`}
                  />
                  <p className="text-xs text-secondary-text mt-2 tabular">
                    {rankInfo.progress.pendingApproval ? (
                      <span className="text-accent font-semibold">
                        Bạn đã vượt mốc 50 chiến dịch — đang chờ sắc phong danh hiệu Bang Chủ!
                      </span>
                    ) : (
                      <>
                        Hoàn thành thêm{' '}
                        <strong className="text-foreground">{rankInfo.progress.remaining}</strong>{' '}
                        chiến dịch tại Đấu Trường Học Tập để thăng cấp.
                      </>
                    )}
                  </p>
                </div>
              ) : (
                <div className="bg-gold-soft/70 border border-gold p-4 rounded-xl text-center">
                  <p className="text-sm font-display font-bold text-gold-dark flex items-center justify-center gap-1.5">
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">
                      workspace_premium
                    </span>
                    Cảnh giới Quân hàm tối cao: {rankInfo.name}
                  </p>
                </div>
              )}

              {/* EXP / Level Progress */}
              <div className="bg-paper p-4 rounded-xl border border-border">
                <div className="flex items-center justify-between text-xs mb-2 gap-2 flex-wrap">
                  <span className="text-secondary-text font-medium flex items-center gap-1.5">
                    <span
                      className={`tabular inline-flex items-center gap-1 font-extrabold px-2 py-0.5 rounded-md border ${levelAccent.badge}`}
                    >
                      Lv.{levelInfo.level}
                    </span>
                    <span>Công lực tu luyện (EXP)</span>
                  </span>
                  <span className="tabular font-bold text-foreground">
                    {levelInfo.expIntoLevel.toLocaleString('vi-VN')} /{' '}
                    {levelInfo.expForThisLevel.toLocaleString('vi-VN')} EXP ({levelInfo.progressPct}%)
                  </span>
                </div>
                <ProgressBar
                  value={levelInfo.expIntoLevel}
                  max={levelInfo.expForThisLevel}
                  tone="jade"
                  showPercent={false}
                />
                <div className="flex items-center justify-between mt-2 text-xs text-secondary-text flex-wrap gap-2">
                  <span className="tabular">
                    Tổng Công Lực:{' '}
                    <strong className="text-foreground">
                      {levelInfo.totalExp.toLocaleString('vi-VN')} EXP
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('/hoc-online')}
                    className="font-bold text-jade hover:underline cursor-pointer"
                  >
                    Vào Học Online nhận +EXP →
                  </button>
                </div>
              </div>
            </section>

            {/* ACADEMIC DETAILS & TARGETS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <section className="md:col-span-2 paper-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary" aria-hidden="true">
                      school
                    </span>
                    <span>Hồ sơ Học vấn</span>
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-surface-alt border border-border text-foreground">
                    {activeMode === 'student' ? 'Chế độ Học sinh THPT' : 'Chế độ Sinh viên ĐH'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  <div className="p-3.5 rounded-xl bg-paper border border-border">
                    <p className="text-xs text-secondary-text mb-1">
                      {activeMode === 'student' ? 'Trường THPT / Nguyện vọng 1' : 'Trường Đại học'}
                    </p>
                    <p className="text-sm font-bold text-foreground">
                      {profile?.university || 'Chưa cập nhật'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-paper border border-border">
                    <p className="text-xs text-secondary-text mb-1">
                      {activeMode === 'student' ? 'Khối / Ngành định hướng' : 'Chuyên ngành'}
                    </p>
                    <p className="text-sm font-bold text-foreground">
                      {extraProfile.major || 'Chưa cập nhật'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-paper border border-border">
                    <p className="text-xs text-secondary-text mb-1">
                      {activeMode === 'student' ? 'Khoá thi Đại học' : 'Năm nhập học'}
                    </p>
                    <p className="text-sm font-bold text-foreground tabular">
                      {extraProfile.starting_year || 'Chưa cập nhật'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-paper border border-border">
                    <p className="text-xs text-secondary-text mb-1">GPA Đại học hiện tại (Hệ 4.0)</p>
                    <p className="text-sm font-bold text-jade tabular">
                      {profile?.current_gpa != null
                        ? `${Number(profile.current_gpa).toFixed(2)} / 4.00`
                        : 'Chưa lưu GPA'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => navigate('/gpa')}
                    className="btn-arena btn-arena-secondary btn-arena-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      calculate
                    </span>
                    <span>Mở Bàn Tính GPA</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/roadmap')}
                    className="btn-arena btn-arena-secondary btn-arena-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      conversion_path
                    </span>
                    <span>Lộ Trình Học Tập</span>
                  </button>
                </div>
              </section>

              {/* TARGET METRICS CARD */}
              <section className="paper-card p-6 space-y-3.5">
                <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2">
                  <span className="material-symbols-outlined text-accent" aria-hidden="true">
                    flag
                  </span>
                  <span>Mục tiêu Điểm số</span>
                </h2>

                <div className="p-3.5 rounded-xl bg-jade-soft border border-jade-border flex items-center justify-between">
                  <div>
                    <p className="text-xs text-jade font-bold">GPA Đại học</p>
                    <p className="text-[11px] text-secondary-text">Thang chuẩn 4.0</p>
                  </div>
                  <span className="text-xl font-display font-extrabold text-jade tabular">
                    {profile?.target_gpa != null ? Number(profile.target_gpa).toFixed(2) : '3.20'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-gold-soft/65 border border-gold flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gold-dark font-bold">Tổ hợp THPTQG</p>
                    <p className="text-[11px] text-secondary-text">Thang điểm 30</p>
                  </div>
                  <span className="text-xl font-display font-extrabold text-accent tabular">
                    {profile?.target_thpt != null ? Number(profile.target_thpt).toFixed(2) : '26.00'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-primary-soft/60 border border-primary/30 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-primary font-bold">Đánh giá năng lực</p>
                    <p className="text-[11px] text-secondary-text">HSA / V-ACT</p>
                  </div>
                  <span className="text-xl font-display font-extrabold text-primary tabular">
                    {profile?.target_dgnl ?? 900}
                  </span>
                </div>
              </section>
            </div>

            {/* RECENT 7-DAY STUDY LOG (`public.study_daily`) */}
            <section className="paper-card p-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2">
                  <span className="material-symbols-outlined text-jade" aria-hidden="true">
                    history_edu
                  </span>
                  <span>Nhật Ký Tu Luyện Gần Đây</span>
                </h2>
                <span className="text-xs text-secondary-text">
                  Tối đa 5 giờ được cộng EXP mỗi ngày
                </span>
              </div>

              {loadingStats ? (
                <p className="text-xs text-secondary-text py-4 text-center">
                  Đang tải nhật ký học tập...
                </p>
              ) : studyDailyRows.length === 0 ? (
                <div className="p-6 rounded-xl bg-surface-alt border border-dashed border-border text-center space-y-2">
                  <p className="text-sm font-display font-bold text-foreground">
                    Chưa có phiên học online nào được ghi nhận
                  </p>
                  <p className="text-xs text-secondary-text">
                    Mỗi phút tự học tại khu vực Học Online sẽ tự động lưu vào nhật ký và cộng thêm +10 EXP!
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/hoc-online')}
                    className="btn-arena btn-arena-primary btn-arena-sm mt-1 cursor-pointer"
                  >
                    Bắt đầu học ngay
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {studyDailyRows.map((row) => {
                    const sec = Number(row.seconds) || 0;
                    const earnedExp = Number(row.exp) || 0;
                    const pct = Math.min(
                      100,
                      Math.round((sec / DAILY_STUDY_SECONDS_CAP) * 100),
                    );
                    return (
                      <div
                        key={row.study_date}
                        className="p-3 rounded-xl bg-paper border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div className="flex items-center gap-3">
                          <span className="px-2.5 py-1 rounded-lg bg-surface-alt border border-border text-xs font-bold text-foreground tabular">
                            {new Date(row.study_date).toLocaleDateString('vi-VN')}
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-foreground tabular">
                            {formatStudyTime(sec)}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 sm:w-64">
                          <div className="flex-1">
                            <ProgressBar value={pct} max={100} tone="jade" showPercent={false} />
                          </div>
                          <span className="text-xs font-display font-extrabold text-jade tabular shrink-0">
                            +{earnedExp.toLocaleString('vi-VN')} EXP
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* RANK GUIDE MODAL */}
      {isRankModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-foreground/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsRankModalOpen(false)}
        >
          <div
            className="imperial-frame w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-paper">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary" aria-hidden="true">
                  military_tech
                </span>
                <h3 className="font-display font-bold text-base text-foreground">
                  Hệ Thống Quân Hàm Chiến Dịch
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRankModalOpen(false)}
                aria-label="Đóng"
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg cursor-pointer"
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  close
                </span>
              </button>
            </div>

            <div className="p-6 space-y-3 max-h-[75vh] overflow-y-auto bg-surface">
              {RANK_TIERS.map((tier) => {
                const isCurrent = rankInfo.name === tier.name;
                return (
                  <div
                    key={tier.name}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                      isCurrent
                        ? `${tier.bg} ${tier.border} ring-1 ring-primary/30`
                        : 'bg-paper border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center border ${tier.bg} ${tier.color} ${tier.border}`}
                      >
                        <span className="material-symbols-outlined text-xl" aria-hidden="true">
                          {tier.icon}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className={`font-display font-bold text-sm ${tier.color}`}>
                            {tier.name}
                          </h4>
                          {isCurrent && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                              Hiện tại
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-secondary-text mt-0.5 tabular">
                          {tier.min === 0
                            ? 'Khởi điểm khi gia nhập'
                            : tier.requiresApproval
                              ? `≥ ${tier.min} chiến dịch hoàn thành + Sắc phong`
                              : `Hoàn thành từ ${tier.min} chiến dịch`}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-display font-extrabold text-secondary-text tabular">
                      {tier.min} CD
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
