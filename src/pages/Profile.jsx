import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getUserRank, RANK_TIERS } from '../utils/rankHelper';
import { getLevelFromExp, getLevelAccent } from '../utils/levelHelper';
import Avatar from '../components/Avatar';
import ProgressBar from '../components/ui/ProgressBar';
import RankSeal from '../components/ui/RankSeal';

export default function Profile() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRankModalOpen, setIsRankModalOpen] = useState(false);

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  const [fullName, setFullName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [grade, setGrade] = useState('Lớp 12');
  const [targetUni, setTargetUni] = useState('');
  const [targetThpt, setTargetThpt] = useState(27.0);
  const [targetGpa, setTargetGpa] = useState(8.5);
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setSchoolName(profile.school_name || '');
      setGrade(profile.grade || 'Lớp 12');
      setTargetUni(profile.target_university || '');
      setTargetThpt(profile.target_thpt || 27.0);
      setTargetGpa(profile.target_gpa || 8.5);
      setBio(profile.bio || '');
      setAvatarUrl(profile.avatar_url || '');
    }
  }, [profile]);

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chỉ chọn file hình ảnh (JPG, PNG, GIF...)!');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Ảnh đại diện không được vượt quá 2MB. Vui lòng chọn ảnh nhẹ hơn!');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date() })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      alert('Cập nhật ảnh đại diện thành công!');
      window.location.reload();
    } catch (error) {
      console.error('Lỗi tải ảnh:', error);
      alert('Lỗi khi tải ảnh lên: ' + error.message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          school_name: schoolName.trim(),
          grade,
          target_university: targetUni.trim(),
          target_thpt: parseFloat(targetThpt) || 27.0,
          target_gpa: parseFloat(targetGpa) || 8.5,
          bio: bio.trim(),
          updated_at: new Date(),
        })
        .eq('id', user.id);

      if (error) throw error;
      alert('Đã cập nhật hồ sơ thành công!');
      setIsEditing(false);
      window.location.reload();
    } catch (error) {
      alert('Lỗi khi cập nhật hồ sơ: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const formatTime = (minutes) => {
    if (!minutes || minutes <= 0) return '0 phút';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} phút`;
    if (m === 0) return `${h} giờ`;
    return `${h} giờ ${m} phút`;
  };

  const myMinutes = profile?.total_study_minutes || 0;
  const rankInfo = getUserRank(myMinutes, profile?.is_thong_soai);
  const levelInfo = getLevelFromExp(profile?.exp || 0);
  const levelAccent = getLevelAccent(levelInfo.level);

  return (
    <div className="bg-background font-sans text-foreground min-h-full pb-24">
      {/* Header Banner */}
      <div className="h-36 sm:h-44 bg-gradient-to-r from-primary-soft via-paper to-gold-soft/60 relative overflow-hidden border-b border-border">
        <span
          aria-hidden="true"
          className="hanzi-watermark absolute right-8 top-4 text-8xl font-bold text-primary/8"
        >
          名帖
        </span>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10">
        {/* Profile Card Header */}
        <div className="imperial-frame p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              {/* Avatar có nút Upload */}
              <div className="relative group">
                <Avatar
                  src={avatarUrl}
                  name={fullName || user?.email}
                  className="w-24 h-24 border-4 border-surface shadow-md"
                  textSize="text-3xl"
                />

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarUpload}
                  accept="image/*"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="absolute inset-0 rounded-full bg-foreground/55 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity cursor-pointer"
                  title="Đổi ảnh đại diện"
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
                  className="sm:hidden absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-md border-2 border-surface cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">
                    photo_camera
                  </span>
                </button>
              </div>

              <div className="mt-2 sm:mt-0">
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <h1 className="text-2xl font-display font-extrabold text-foreground">
                    {fullName || 'Chưa cập nhật tên'}
                  </h1>
                  <div className="flex items-center gap-1.5 flex-wrap justify-center">
                    <button
                      type="button"
                      onClick={() => setIsRankModalOpen(true)}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${rankInfo.bg} ${rankInfo.color} ${rankInfo.border} hover:opacity-85 transition-opacity cursor-pointer`}
                      title="Nhấn để xem bảng cấp bậc"
                    >
                      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                        {rankInfo.icon}
                      </span>
                      {rankInfo.name}
                    </button>
                    <span
                      className={`tabular inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${levelAccent.badge}`}
                      title={`${levelInfo.expInLevel}/${levelInfo.expForNext} EXP tới cấp tiếp theo`}
                    >
                      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                        bolt
                      </span>
                      Lv.{levelInfo.level}
                    </span>
                    {profile?.role === 'admin' && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary text-white">
                        Quản trị viên
                      </span>
                    )}
                    {profile?.role === 'collaborator' && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-jade text-white">
                        Cộng tác viên
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-secondary-text mt-1">{user?.email}</p>
                {bio && (
                  <p className="text-xs text-secondary-text italic mt-2 max-w-lg">
                    &ldquo;{bio}&rdquo;
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="flex-1 sm:flex-initial btn-arena btn-arena-secondary btn-arena-sm"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  {isEditing ? 'close' : 'edit'}
                </span>
                {isEditing ? 'Đóng' : 'Chỉnh sửa'}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="btn-arena btn-arena-sm bg-primary-soft text-primary border border-primary/30 hover:bg-primary hover:text-white"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  logout
                </span>
                Đăng xuất
              </button>
            </div>
          </div>
        </div>

        {isEditing ? (
          /* Form Chỉnh sửa Hồ sơ */
          <form onSubmit={handleSaveProfile} className="paper-card p-6 space-y-5">
            <h2 className="text-lg font-display font-bold text-foreground border-b border-border pb-3">
              Cập nhật thông tin cá nhân
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">Họ và tên</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">Khối lớp</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="Lớp 10">Lớp 10</option>
                  <option value="Lớp 11">Lớp 11</option>
                  <option value="Lớp 12">Lớp 12</option>
                  <option value="Thí sinh tự do">Thí sinh tự do</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Trường THPT đang học
                </label>
                <input
                  type="text"
                  placeholder="VD: THPT Chuyên Hà Nội - Amsterdam"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Trường Đại học mơ ước (Nguyện vọng 1)
                </label>
                <input
                  type="text"
                  placeholder="VD: Đại học Bách Khoa Hà Nội"
                  value={targetUni}
                  onChange={(e) => setTargetUni(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Mục tiêu điểm thi THPT Quốc Gia (Hệ 30)
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max="30"
                  value={targetThpt}
                  onChange={(e) => setTargetThpt(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-paper border border-border-strong rounded-xl text-sm text-foreground tabular focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Mục tiêu GPA Cấp 3 (Hệ 10)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={targetGpa}
                  onChange={(e) => setTargetGpa(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-paper border border-border-strong rounded-xl text-sm text-foreground tabular focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Châm ngôn học tập / Giới thiệu bản thân
              </label>
              <textarea
                rows={3}
                placeholder="VD: Quyết tâm đỗ Bách Khoa 2027!"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="btn-arena btn-arena-secondary btn-arena-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="btn-arena btn-arena-primary btn-arena-sm"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  save
                </span>
                {isSaving ? 'Đang lưu...' : 'Lưu hồ sơ'}
              </button>
            </div>
          </form>
        ) : (
          /* Chế độ Xem Hồ sơ & Cấp bậc */
          <div className="space-y-6">
            {/* Thẻ Cấp Bậc & Thời Gian Học Tập */}
            <div className="paper-card p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${rankInfo.bg} ${rankInfo.color} ${rankInfo.border}`}
                  >
                    <span className="material-symbols-outlined text-3xl" aria-hidden="true">
                      {rankInfo.icon}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-secondary-text uppercase tracking-wider">
                        Danh hiệu hiện tại
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsRankModalOpen(true)}
                        className="text-xs text-primary hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                          info
                        </span>
                        Chi tiết cấp bậc
                      </button>
                    </div>
                    <h3 className={`text-2xl font-display font-extrabold ${rankInfo.color}`}>
                      {rankInfo.name}
                    </h3>
                  </div>
                </div>

                <div className="bg-paper px-4 py-2.5 rounded-xl border border-border text-left sm:text-right w-full sm:w-auto">
                  <p className="text-xs text-secondary-text">Tổng thời gian tích lũy</p>
                  <p className="text-lg font-display font-bold text-primary tabular">
                    {formatTime(myMinutes)}
                  </p>
                </div>
              </div>

              {rankInfo.nextRank ? (
                <div className="bg-paper p-4 rounded-xl border border-border">
                  <ProgressBar
                    value={rankInfo.progress}
                    max={100}
                    tone="primary"
                    label={`Tiến trình thăng cấp lên ${rankInfo.nextRank.name}`}
                  />
                  <p className="text-xs text-secondary-text mt-2 tabular">
                    Cần học thêm{' '}
                    <strong className="text-foreground">
                      {formatTime(rankInfo.nextRank.min - myMinutes)}
                    </strong>{' '}
                    nữa để đạt danh hiệu tiếp theo. Hãy duy trì mở web học tập mỗi ngày nhé!
                  </p>
                </div>
              ) : (
                <div className="bg-gold-soft/70 border border-gold p-4 rounded-xl text-center">
                  <p className="text-sm font-display font-bold text-gold-dark flex items-center justify-center gap-1.5">
                    <span className="material-symbols-outlined text-lg icon-fill" aria-hidden="true">
                      workspace_premium
                    </span>
                    Bạn đã đạt cảnh giới cao nhất: Thống Soái!
                  </p>
                </div>
              )}

              {/* Thanh Level EXP */}
              <div className="mt-4 bg-paper p-4 rounded-xl border border-border">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-secondary-text font-medium flex items-center gap-1.5">
                    <span
                      className={`tabular inline-flex items-center gap-1 font-extrabold px-2 py-0.5 rounded-md border ${levelAccent.badge}`}
                    >
                      Lv.{levelInfo.level}
                    </span>
                    <span>Kinh nghiệm học tập (EXP)</span>
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
                <p className="text-xs text-secondary-text mt-2 tabular">
                  Tổng tích luỹ:{' '}
                  <strong className="text-foreground">{levelInfo.totalExp} EXP</strong> — mỗi phút học tập trung hoặc mở bảng bài giảng giúp bạn nhận thêm EXP.
                </p>
              </div>
            </div>

            {/* Thông tin Học vấn & Mục tiêu */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 paper-card p-6 space-y-4">
                <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary" aria-hidden="true">
                    badge
                  </span>
                  Thông tin học vấn
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-3.5 rounded-xl bg-paper border border-border">
                    <p className="text-xs text-secondary-text mb-1">Trường THPT</p>
                    <p className="text-sm font-semibold text-foreground">
                      {profile?.school_name || 'Chưa cập nhật'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-paper border border-border">
                    <p className="text-xs text-secondary-text mb-1">Khối lớp hiện tại</p>
                    <p className="text-sm font-semibold text-foreground">
                      {profile?.grade || 'Lớp 12'}
                    </p>
                  </div>

                  <div className="sm:col-span-2 p-3.5 rounded-xl bg-primary-soft/60 border border-primary/25 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center no-shrink">
                      <span className="material-symbols-outlined" aria-hidden="true">
                        account_balance
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-primary font-bold">
                        Mục tiêu Nguyện vọng 1 (Đại học mơ ước)
                      </p>
                      <p className="text-base font-display font-bold text-foreground">
                        {profile?.target_university ||
                          'Bấm "Chỉnh sửa" để đặt mục tiêu trường Đại học!'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Thẻ Mục tiêu Điểm số */}
              <div className="paper-card p-6 space-y-4">
                <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2">
                  <span className="material-symbols-outlined text-accent" aria-hidden="true">
                    flag
                  </span>
                  Mục tiêu điểm số
                </h2>

                <div className="space-y-3 pt-2">
                  <div className="p-4 rounded-xl bg-gold-soft/60 border border-gold flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gold-dark font-bold">Điểm THPT Quốc Gia</p>
                      <p className="text-[11px] text-secondary-text">Tổng 3 môn xét tuyển</p>
                    </div>
                    <span className="text-2xl font-display font-extrabold text-accent tabular">
                      {profile?.target_thpt || '27.0'}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-jade-soft border border-jade-border flex items-center justify-between">
                    <div>
                      <p className="text-xs text-jade font-bold">Điểm GPA Cấp 3</p>
                      <p className="text-[11px] text-secondary-text">Trung bình học bạ</p>
                    </div>
                    <span className="text-2xl font-display font-extrabold text-jade tabular">
                      {profile?.target_gpa || '8.5'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL BẢNG CẤP BẬC */}
      {isRankModalOpen && (
        <div
          className="fixed inset-0 z-[100] bg-foreground/45 backdrop-blur-xs flex items-center justify-center p-4"
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
                  Hệ Thống Cấp Bậc Chiến Binh
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
              {RANK_TIERS.map((tier, idx) => {
                const isCurrent = rankInfo.name === tier.name;
                return (
                  <div
                    key={idx}
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
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-white">
                              Hiện tại
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-secondary-text mt-0.5 tabular">
                          {tier.min === 0 ? 'Khi mới tham gia' : `Đạt ${formatTime(tier.min)}`}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-muted-foreground tabular">
                      {tier.max === Infinity ? '4500+ phút' : `${tier.min} - ${tier.max}p`}
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
