import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useStudyTracker } from '../hooks/useStudyTracker';
import { getLevelAccent, formatStudyTime } from '../utils/levelHelper';
import {
  ONLINE_SHEET_TITLE,
  ONLINE_SUBJECTS,
  ONLINE_TEACHER_COUNT,
  buildSheetEmbedUrl,
  buildSheetOpenUrl,
  getTeacherKey,
} from '../config/onlineLearning';
import ArenaButton from '../components/ui/ArenaButton';
import SubjectCard from '../components/ui/SubjectCard';
import TeacherCard from '../components/ui/TeacherCard';
import ProgressBar from '../components/ui/ProgressBar';
import SessionBar from '../components/ui/SessionBar';
import RankSeal from '../components/ui/RankSeal';
import { useToast } from '../components/ui/ToastProvider';

const IFRAME_STALL_MS = 9000;

function isGoogleAccount(user) {
  if (!user) return false;
  if (user.app_metadata?.provider === 'google') return true;
  if (Array.isArray(user.app_metadata?.providers) && user.app_metadata.providers.includes('google')) {
    return true;
  }
  const identities = Array.isArray(user.identities) ? user.identities : [];
  return identities.some((identity) => identity?.provider === 'google');
}

function normalizeViSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export default function OnlineLearning() {
  const {
    user,
    profile,
    refreshProfile,
    isGoogleLinked,
    signInWithGoogle,
  } = useAuth();
  const { showToast } = useToast();

  const [selectedSubjectId, setSelectedSubjectId] = useState(ONLINE_SUBJECTS[0]?.id || 'TOAN');
  const [selectedTeacherIndex, setSelectedTeacherIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [loadedEmbedUrl, setLoadedEmbedUrl] = useState('');
  const [stalledEmbedUrl, setStalledEmbedUrl] = useState('');
  const [isFullscreenSheet, setIsFullscreenSheet] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

  const viewerSectionRef = useRef(null);
  const googleLinked = Boolean(isGoogleLinked ?? isGoogleAccount(user));

  const selectedSubject = useMemo(
    () =>
      ONLINE_SUBJECTS.find((subject) => subject.id === selectedSubjectId) || ONLINE_SUBJECTS[0],
    [selectedSubjectId],
  );

  const filteredTeachers = useMemo(() => {
    const keyword = normalizeViSearch(searchTerm);
    const teachers = selectedSubject?.teachers || [];
    if (!keyword) return teachers;
    return teachers.filter((teacher) => normalizeViSearch(teacher.title).includes(keyword));
  }, [selectedSubject, searchTerm]);

  const activeTeacher =
    filteredTeachers[selectedTeacherIndex] ||
    filteredTeachers[0] ||
    selectedSubject?.teachers?.[0] ||
    null;

  const embedUrl = activeTeacher ? buildSheetEmbedUrl(activeTeacher, String(refreshSeed || '')) : '';
  const openUrl = activeTeacher ? buildSheetOpenUrl(activeTeacher) : '#';
  const isSheetLoading = Boolean(embedUrl) && loadedEmbedUrl !== embedUrl;
  const isSheetStalled = isSheetLoading && stalledEmbedUrl === embedUrl;

  const study = useStudyTracker({
    enabled: Boolean(user && activeTeacher),
    subjectId: selectedSubject?.id ?? null,
    sheetId: activeTeacher?.sheetId ?? null,
    initialExp: profile?.exp,
    initialStudySeconds: profile?.study_seconds,
    initialStreak: profile?.study_streak,
    onSync: refreshProfile,
  });

  const {
    levelInfo,
    streak,
    studySeconds,
    todayMinutes = 0,
    isAccruing,
    flash,
    clearFlash,
    idleReason = 'none',
    checkinPrompt = null,
    checkinRemainingSec = 0,
    submitCheckin,
  } = study;
  const levelAccent = getLevelAccent(levelInfo.level);
  const sessionStatus = study.sessionStatus ?? study.status ?? (isAccruing ? 'active' : 'idle');
  const sessionSeconds = study.sessionSeconds ?? 0;
  const sessionFallback = Boolean(study.isFallback ?? study.fallback ?? study.legacyMode);

  const callStudy = useCallback((fn, arg) => {
    if (typeof fn !== 'function') return;
    try {
      fn(arg);
    } catch {
      /* tracker lỗi không được làm hỏng luồng học */
    }
  }, []);

  const handleStartSession = useCallback(
    () => callStudy(study.startSession),
    [callStudy, study.startSession],
  );
  const handleEndSession =
    typeof study.endSession === 'function' ? () => callStudy(study.endSession) : undefined;
  const handleConfirmContinue =
    typeof study.confirmContinue === 'function'
      ? () => callStudy(study.confirmContinue)
      : undefined;
  const handleSubmitCheckin =
    typeof submitCheckin === 'function'
      ? (symbol) => callStudy(submitCheckin, symbol)
      : undefined;

  useEffect(() => {
    if (!flash) return undefined;
    const timeoutId = window.setTimeout(clearFlash, 3600);
    return () => window.clearTimeout(timeoutId);
  }, [flash, clearFlash]);

  // Detect slow/blocked iframe after 9s to surface direct open hint
  useEffect(() => {
    if (!isSheetLoading || !embedUrl) return undefined;
    const timer = window.setTimeout(() => {
      setStalledEmbedUrl(embedUrl);
    }, IFRAME_STALL_MS);
    return () => window.clearTimeout(timer);
  }, [embedUrl, isSheetLoading]);

  // Close in-app fullscreen sheet on Escape & lock background body scroll
  useEffect(() => {
    if (!isFullscreenSheet) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsFullscreenSheet(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreenSheet]);

  const handleGoogleLogin = async () => {
    setIsConnectingGoogle(true);
    try {
      if (typeof signInWithGoogle === 'function') {
        await signInWithGoogle('/hoc-online');
      } else {
        const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent('/hoc-online')}`;
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo },
        });
        if (error) throw error;
      }
    } catch (error) {
      console.error('Lỗi đăng nhập Google:', error);
      showToast('Không thể chuyển hướng đăng nhập Google: ' + error.message, 'error');
      setIsConnectingGoogle(false);
    }
  };

  const handleSelectSubject = (subjectId) => {
    setSelectedSubjectId(subjectId);
    setSelectedTeacherIndex(0);
    setSearchTerm('');
    handleStartSession();
  };

  const handleSelectTeacher = (idx) => {
    setSelectedTeacherIndex(idx);
    handleStartSession();
    if (viewerSectionRef.current) {
      viewerSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const expInCurrentLevel = levelInfo.expInLevel ?? levelInfo.expIntoLevel ?? 0;
  const expRequiredCurrentLevel = levelInfo.expForNext ?? levelInfo.expForThisLevel ?? 100;
  const shortTeacherTitle = activeTeacher?.title?.split(/\s+-\s+/)[0] || '';

  return (
    <div className="min-h-full bg-background text-foreground pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* ═══ BENTO HEADER — Dual-Theme Trung Hoa Cổ Phong ═══ */}
        <section
          aria-label="Tổng quan Học online"
          className="grid grid-cols-1 lg:grid-cols-12 gap-4"
        >
          {/* Main Hero Tile (8 cols) */}
          <div className="imperial-frame relative overflow-hidden p-5 sm:p-7 lg:col-span-8 flex flex-col justify-between gap-5">
            <span
              aria-hidden="true"
              className="hanzi-watermark absolute -top-2 right-4 text-8xl font-bold text-accent/8 select-none pointer-events-none"
            >
              講堂
            </span>

            <div className="relative space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <RankSeal size="sm" icon="cast_for_education" label="Học online · Khoa Bảng" />
                <span className="paper-chip tabular">
                  <span
                    className="material-symbols-outlined text-sm text-accent"
                    aria-hidden="true"
                  >
                    groups
                  </span>
                  {ONLINE_TEACHER_COUNT} giáo viên · {ONLINE_SUBJECTS.length} môn
                </span>
              </div>

              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight text-foreground">
                {ONLINE_SHEET_TITLE}
              </h1>
              <p className="text-sm sm:text-base text-secondary-text max-w-2xl leading-relaxed">
                Chọn môn học và giáo viên để mở bảng bài giảng Google Sheets ngay trên trang hoặc ở
                chế độ toàn khung. Trong suốt phiên học, hệ thống tự động tích luỹ{' '}
                <strong className="text-foreground">+10 EXP/phút</strong> kể cả khi bạn mở bài ở
                tab riêng!
              </p>
            </div>

            {activeTeacher && (
              <div className="relative flex flex-wrap items-center gap-2.5 pt-2 border-t border-border">
                <ArenaButton
                  variant="primary"
                  icon="fullscreen"
                  onClick={() => {
                    handleStartSession();
                    setIsFullscreenSheet(true);
                  }}
                >
                  Chế độ tập trung toàn khung
                </ArenaButton>
                <ArenaButton
                  as="a"
                  href={openUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="secondary"
                  size="sm"
                  icon="open_in_new"
                  onClick={handleStartSession}
                >
                  Mở Google Sheets tab mới
                </ArenaButton>
                <ArenaButton
                  variant="ghost"
                  size="sm"
                  icon="refresh"
                  onClick={() => setRefreshSeed((prev) => prev + 1)}
                >
                  Làm mới bảng nhúng
                </ArenaButton>
              </div>
            )}
          </div>

          {/* Right Column (4 cols): Live Level / EXP + Current Subject */}
          <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            <div className="paper-card p-5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-secondary-text">
                    Công lực tu luyện
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="font-display tabular text-2xl font-extrabold text-foreground">
                      Cấp {levelInfo.level}
                    </p>
                    <span
                      className={`tabular text-[11px] font-extrabold px-2 py-0.5 rounded-full border ${levelAccent.badge}`}
                    >
                      Lv.{levelInfo.level}
                    </span>
                  </div>
                </div>
                <span className="paper-chip tabular bg-gold-soft text-gold-dark border-gold">
                  <span
                    className="material-symbols-outlined text-base text-accent"
                    aria-hidden="true"
                  >
                    bolt
                  </span>
                  {levelInfo.totalExp.toLocaleString('vi-VN')} EXP
                </span>
              </div>

              <ProgressBar
                value={expInCurrentLevel}
                max={expRequiredCurrentLevel}
                tone="jade"
                label={`Tiến trình lên Cấp ${levelInfo.level + 1}`}
                sublabel={`${expInCurrentLevel.toLocaleString('vi-VN')}/${expRequiredCurrentLevel.toLocaleString('vi-VN')} EXP`}
              />

              {user ? (
                <div className="flex items-center justify-between text-xs text-secondary-text pt-1.5 border-t border-border">
                  <span>
                    Đã học:{' '}
                    <strong className="tabular text-foreground">
                      {formatStudyTime(studySeconds)}
                    </strong>
                  </span>
                  <span>
                    Chuỗi:{' '}
                    <strong className="tabular text-accent">
                      {streak > 0 ? `${streak} ngày` : '—'}
                    </strong>
                  </span>
                </div>
              ) : (
                <p className="text-xs text-secondary-text pt-1 border-t border-border">
                  Đăng nhập tài khoản để lưu giờ học và nhận EXP tự động.
                </p>
              )}
            </div>

            <div className="paper-card p-5 flex items-center gap-3.5 bg-paper">
              <div
                aria-hidden="true"
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border shadow-xs subject-solid-${selectedSubject?.id || 'DEFAULT'}`}
              >
                <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                  {selectedSubject?.icon || 'menu_book'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-secondary-text">
                  Môn đang chọn
                </p>
                <p className="font-display text-lg font-bold text-foreground truncate">
                  {selectedSubject?.label}
                </p>
                <p className="tabular text-xs text-secondary-text">
                  {selectedSubject?.teachers?.length || 0} khoá / giáo viên sẵn sàng
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ GOOGLE PERMISSION BANNER ═══ */}
        {!googleLinked && (
          <div className="paper-card border-gold bg-gold-soft/50 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-2.5">
              <span
                className="material-symbols-outlined text-accent text-xl shrink-0"
                aria-hidden="true"
              >
                key
              </span>
              <p className="text-xs sm:text-sm font-semibold text-foreground leading-relaxed">
                Phiên hiện tại chưa xác thực Google. Để mở các bảng bài giảng nội bộ được phân quyền
                theo email, hãy đăng nhập bằng Google!
              </p>
            </div>
            <ArenaButton
              variant="gold"
              size="sm"
              icon="login"
              disabled={isConnectingGoogle}
              onClick={handleGoogleLogin}
            >
              {isConnectingGoogle ? 'Đang kết nối...' : 'Đăng nhập Google'}
            </ArenaButton>
          </div>
        )}

        {/* ═══ STICKY LIVE STUDY SESSION BAR ═══ */}
        {user && !isFullscreenSheet && (
          <SessionBar
            status={sessionStatus}
            fallback={sessionFallback}
            sessionSeconds={sessionSeconds}
            todayMinutes={todayMinutes}
            idleReason={idleReason}
            checkinPrompt={checkinPrompt}
            checkinRemainingSec={checkinRemainingSec}
            subjectLabel={selectedSubject?.shortLabel}
            teacherTitle={shortTeacherTitle}
            flashExp={flash}
            onStartSession={handleStartSession}
            onConfirmContinue={handleConfirmContinue}
            onSubmitCheckin={handleSubmitCheckin}
            onEndSession={handleEndSession}
          />
        )}

        {/* ═══ STEP 1: SUBJECT PICKER GRID ═══ */}
        <section aria-labelledby="subjects-heading" className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2
              id="subjects-heading"
              className="font-display text-lg sm:text-xl font-bold text-foreground"
            >
              1. Chọn môn học
            </h2>
            <span className="tabular text-xs text-secondary-text">
              {ONLINE_SUBJECTS.length} môn thi
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {ONLINE_SUBJECTS.map((subject) => (
              <SubjectCard
                key={subject.id}
                subject={subject}
                count={subject.teachers.length}
                active={subject.id === selectedSubject.id}
                onSelect={() => handleSelectSubject(subject.id)}
              />
            ))}
          </div>
        </section>

        {/* ═══ STEP 2: TEACHER LIST IN SELECTED SUBJECT ═══ */}
        <section aria-labelledby="teachers-heading" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2
                id="teachers-heading"
                className="font-display text-lg sm:text-xl font-bold text-foreground"
              >
                2. Chọn giáo viên · {selectedSubject?.label}
              </h2>
              <p className="text-xs sm:text-sm text-secondary-text">
                Nhấn chọn thẻ thầy/cô để nạp bảng bài giảng xuống khung học bên dưới.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <span
                aria-hidden="true"
                className="material-symbols-outlined text-lg text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              >
                search
              </span>
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSelectedTeacherIndex(0);
                }}
                placeholder={`Tìm trong ${selectedSubject?.shortLabel || 'môn này'}...`}
                aria-label="Tìm giáo viên hoặc tên khoá học"
                className="w-full min-h-[44px] rounded-xl bg-surface border border-border-strong pl-10 pr-9 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedTeacherIndex(0);
                  }}
                  aria-label="Xoá từ khoá tìm kiếm"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    close
                  </span>
                </button>
              )}
            </div>
          </div>

          {filteredTeachers.length === 0 ? (
            <div className="paper-card p-8 text-center space-y-2">
              <span
                className="material-symbols-outlined text-3xl text-muted-foreground"
                aria-hidden="true"
              >
                search_off
              </span>
              <p className="text-sm font-semibold text-foreground">
                Không tìm thấy giáo viên phù hợp với từ khoá &ldquo;{searchTerm}&rdquo;.
              </p>
              <p className="text-xs text-secondary-text">
                Thử gõ tên không dấu ngắn gọn hoặc xoá bộ lọc để xem toàn bộ danh sách.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredTeachers.map((teacher, index) => {
                const isSelected = activeTeacher && teacher.title === activeTeacher.title;
                return (
                  <TeacherCard
                    key={getTeacherKey(selectedSubject.id, teacher, index)}
                    teacher={teacher}
                    index={index}
                    subject={selectedSubject}
                    active={Boolean(isSelected)}
                    onSelect={() => handleSelectTeacher(index)}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* ═══ STEP 3: EMBEDDED LESSON SHEET VIEWER ═══ */}
        <section
          ref={viewerSectionRef}
          aria-labelledby="sheet-viewer-heading"
          className="paper-card overflow-hidden"
        >
          <div className="p-4 sm:p-5 border-b border-border bg-paper flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div
                aria-hidden="true"
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border shadow-xs subject-solid-${selectedSubject?.id || 'DEFAULT'}`}
              >
                <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                  {selectedSubject?.icon || 'grid_view'}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span className="paper-chip bg-jade-soft text-jade border-jade-border">
                    <span className="h-1.5 w-1.5 rounded-full bg-jade" aria-hidden="true" />
                    3. Bảng bài giảng đang mở
                  </span>
                  <span className="paper-chip">{selectedSubject?.label}</span>
                </div>
                <h2
                  id="sheet-viewer-heading"
                  className="font-display text-base sm:text-lg font-bold text-foreground break-words"
                >
                  {activeTeacher?.title || 'Chưa chọn giáo viên'}
                </h2>
              </div>
            </div>

            {activeTeacher && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <ArenaButton
                  variant="ghost"
                  size="sm"
                  icon="refresh"
                  onClick={() => setRefreshSeed((prev) => prev + 1)}
                >
                  Tải lại sheet
                </ArenaButton>
                <ArenaButton
                  variant="secondary"
                  size="sm"
                  icon="fullscreen"
                  onClick={() => {
                    handleStartSession();
                    setIsFullscreenSheet(true);
                  }}
                >
                  Toàn khung
                </ArenaButton>
                <ArenaButton
                  as="a"
                  href={openUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="primary"
                  size="sm"
                  icon="open_in_new"
                  onClick={handleStartSession}
                >
                  Mở tab mới
                </ArenaButton>
              </div>
            )}
          </div>

          {activeTeacher && !isFullscreenSheet ? (
            <div className="relative bg-surface min-h-[560px] lg:min-h-[720px]">
              {isSheetLoading && (
                <div
                  role="status"
                  aria-live="polite"
                  className="absolute inset-0 z-10 bg-paper/95 backdrop-blur-xs flex flex-col items-center justify-center gap-3 p-6 text-center"
                >
                  <div className="w-12 h-12 rounded-2xl bg-primary-soft border border-primary/30 flex items-center justify-center">
                    <span
                      className="material-symbols-outlined text-2xl text-primary animate-spin"
                      aria-hidden="true"
                    >
                      progress_activity
                    </span>
                  </div>
                  <p className="font-display text-base font-bold text-foreground">
                    Đang tải bảng bài giảng của giáo viên...
                  </p>
                  <p className="text-xs text-secondary-text max-w-md">
                    {isSheetStalled
                      ? 'Trình duyệt có thể đang chặn cookie bên thứ ba của Google Sheets. Hãy bấm nút bên dưới để mở trực tiếp trên Google Sheets!'
                      : 'Nếu trình duyệt chặn nhúng Google Sheet hoặc mạng chậm, bấm “Mở tab mới” để học trực tiếp.'}
                  </p>
                  {isSheetStalled && (
                    <ArenaButton
                      as="a"
                      href={openUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="primary"
                      size="sm"
                      icon="open_in_new"
                      onClick={handleStartSession}
                    >
                      Mở trực tiếp trên Google Sheets
                    </ArenaButton>
                  )}
                </div>
              )}

              <iframe
                key={`${activeTeacher.sheetId}-${refreshSeed}`}
                src={embedUrl}
                title={activeTeacher.title}
                className="w-full h-[640px] lg:h-[760px] border-0 bg-surface"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={() => setLoadedEmbedUrl(embedUrl)}
              />
            </div>
          ) : !activeTeacher ? (
            <div className="p-10 text-center text-secondary-text">
              Chọn một môn học và giáo viên ở phía trên để bắt đầu.
            </div>
          ) : (
            <div className="p-8 text-center text-secondary-text text-sm bg-surface-alt">
              Đang mở bảng bài giảng ở chế độ tập trung toàn khung...
            </div>
          )}

          <div className="px-4 py-3 bg-paper border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-secondary-text">
            <span>
              Mẹo: Dùng nút &ldquo;Toàn khung&rdquo; để phóng rộng bảng tính ngay trên web, hoặc &ldquo;Mở tab mới&rdquo; để thao tác đa tab.
            </span>
            <span className="text-muted-foreground font-medium">
              Nguồn dữ liệu: Google Sheets chính thức của khoá học
            </span>
          </div>
        </section>
      </div>

      {/* ═══ IN-APP FULLSCREEN SHEET FOCUS OVERLAY (Dual-Theme Safe) ═══ */}
      {isFullscreenSheet && activeTeacher && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Chế độ toàn khung: ${activeTeacher.title}`}
          className="fixed inset-0 z-50 bg-background text-foreground flex flex-col"
        >
          {/* Compact Dual-Theme Top Bar */}
          <div className="shrink-0 px-3 sm:px-5 py-2.5 bg-paper border-b border-border flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="paper-chip bg-jade-soft text-jade border-jade-border shrink-0">
                {selectedSubject?.shortLabel || selectedSubject?.label}
              </span>
              <h2 className="font-display font-bold text-sm sm:text-base text-foreground truncate">
                {activeTeacher.title}
              </h2>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {user && (
                <span
                  className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold border tabular ${levelAccent.badge}`}
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">
                    bolt
                  </span>
                  Lv.{levelInfo.level} · {levelInfo.totalExp.toLocaleString('vi-VN')} EXP
                </span>
              )}

              <ArenaButton
                variant="ghost"
                size="sm"
                icon="refresh"
                onClick={() => setRefreshSeed((prev) => prev + 1)}
              >
                Tải lại
              </ArenaButton>

              <ArenaButton
                as="a"
                href={openUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="secondary"
                size="sm"
                icon="open_in_new"
                onClick={handleStartSession}
              >
                Tab mới
              </ArenaButton>

              <ArenaButton
                variant="primary"
                size="sm"
                icon="fullscreen_exit"
                onClick={() => setIsFullscreenSheet(false)}
              >
                Thu nhỏ
              </ArenaButton>
            </div>
          </div>

          {/* Live Study Session Bar inside Fullscreen */}
          {user && (
            <div className="shrink-0 px-3 sm:px-5 py-2 bg-surface border-b border-border">
              <SessionBar
                status={sessionStatus}
                fallback={sessionFallback}
                sessionSeconds={sessionSeconds}
                todayMinutes={todayMinutes}
                idleReason={idleReason}
                checkinPrompt={checkinPrompt}
                checkinRemainingSec={checkinRemainingSec}
                subjectLabel={selectedSubject?.shortLabel}
                teacherTitle={shortTeacherTitle}
                flashExp={flash}
                onStartSession={handleStartSession}
                onConfirmContinue={handleConfirmContinue}
                onSubmitCheckin={handleSubmitCheckin}
                onEndSession={handleEndSession}
              />
            </div>
          )}

          {/* Full-Height Sheet Frame */}
          <div className="relative flex-1 min-h-0 bg-surface">
            {isSheetLoading && (
              <div
                role="status"
                aria-live="polite"
                className="absolute inset-0 z-10 bg-paper/95 backdrop-blur-xs flex flex-col items-center justify-center gap-3 p-6 text-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary-soft border border-primary/30 flex items-center justify-center">
                  <span
                    className="material-symbols-outlined text-2xl text-primary animate-spin"
                    aria-hidden="true"
                  >
                    progress_activity
                  </span>
                </div>
                <p className="font-display text-base font-bold text-foreground">
                  Đang mở bảng bài giảng chế độ toàn khung...
                </p>
                {isSheetStalled && (
                  <ArenaButton
                    as="a"
                    href={openUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="primary"
                    size="sm"
                    icon="open_in_new"
                    onClick={handleStartSession}
                  >
                    Mở trực tiếp trên Google Sheets
                  </ArenaButton>
                )}
              </div>
            )}

            <iframe
              key={`fs-${activeTeacher.sheetId}-${refreshSeed}`}
              src={embedUrl}
              title={`Toàn khung: ${activeTeacher.title}`}
              className="w-full h-full border-0 bg-surface"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => setLoadedEmbedUrl(embedUrl)}
            />
          </div>
        </div>
      )}

      {/* ═══ FLOATING EXP / LEVEL-UP CELEBRATION PILL (Dual-Theme Semantic) ═══ */}
      {flash && (
        <div
          key={flash.id}
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-20 sm:bottom-6 right-4 z-50"
        >
          {flash.type === 'levelup' ? (
            <div className="imperial-frame bg-paper px-5 py-3.5 flex items-center gap-3 shadow-lg">
              <div className="w-10 h-10 rounded-xl bg-gold-soft border border-gold text-accent flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                  military_tech
                </span>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-gold-dark">
                  Đột phá Công lực!
                </p>
                <p className="font-display text-base font-extrabold text-foreground tabular">
                  Thăng Cấp {flash.level}
                </p>
              </div>
            </div>
          ) : (
            <div className="paper-card border-jade-border bg-jade-soft px-4 py-2.5 flex items-center gap-2 shadow-md">
              <span className="material-symbols-outlined text-lg text-jade" aria-hidden="true">
                bolt
              </span>
              <span className="font-display text-sm font-extrabold text-foreground tabular">
                +{flash.amount} EXP Công lực
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
