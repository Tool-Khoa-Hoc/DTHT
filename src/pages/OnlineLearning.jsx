import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useStudyTracker } from '../hooks/useStudyTracker';
import { formatStudyTime } from '../utils/levelHelper';
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

function isGoogleAccount(user) {
  if (!user) return false;
  if (user.app_metadata?.provider === 'google') return true;
  const identities = Array.isArray(user.identities) ? user.identities : [];
  return identities.some((identity) => identity?.provider === 'google');
}

export default function OnlineLearning() {
  const { user, profile, refreshProfile } = useAuth();
  const [selectedSubjectId, setSelectedSubjectId] = useState(ONLINE_SUBJECTS[0]?.id || 'TOAN');
  const [selectedTeacherIndex, setSelectedTeacherIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [loadedEmbedUrl, setLoadedEmbedUrl] = useState('');

  const viewerSectionRef = useRef(null);
  const googleLinked = useMemo(() => isGoogleAccount(user), [user]);

  const selectedSubject = useMemo(
    () => ONLINE_SUBJECTS.find((subject) => subject.id === selectedSubjectId) || ONLINE_SUBJECTS[0],
    [selectedSubjectId],
  );

  const filteredTeachers = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    const teachers = selectedSubject?.teachers || [];
    if (!keyword) return teachers;
    return teachers.filter((teacher) => teacher.title.toLowerCase().includes(keyword));
  }, [selectedSubject, searchTerm]);

  const activeTeacher =
    filteredTeachers[selectedTeacherIndex] ||
    filteredTeachers[0] ||
    selectedSubject?.teachers?.[0] ||
    null;

  const embedUrl = activeTeacher ? buildSheetEmbedUrl(activeTeacher, String(refreshSeed || '')) : '';
  const openUrl = activeTeacher ? buildSheetOpenUrl(activeTeacher) : '#';
  const isSheetLoading = Boolean(embedUrl) && loadedEmbedUrl !== embedUrl;

  const study = useStudyTracker({
    enabled: Boolean(user && activeTeacher),
    subjectId: selectedSubject?.id ?? null,
    sheetId: activeTeacher?.sheetId ?? null,
    initialExp: profile?.exp,
    initialStudySeconds: profile?.study_seconds,
    initialStreak: profile?.study_streak,
    onSync: refreshProfile,
  });

  const { levelInfo, streak, studySeconds, isAccruing, flash, clearFlash } = study;
  const sessionStatus = study.sessionStatus ?? study.status ?? (isAccruing ? 'active' : 'idle');
  const sessionSeconds = study.sessionSeconds ?? 0;
  const sessionFallback = Boolean(study.isFallback ?? study.fallback ?? study.legacyMode);

  const callStudy = useCallback((fn) => {
    if (typeof fn !== 'function') return;
    try {
      fn();
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

  useEffect(() => {
    if (!flash) return undefined;
    const timeoutId = window.setTimeout(clearFlash, 3600);
    return () => window.clearTimeout(timeoutId);
  }, [flash, clearFlash]);

  const handleGoogleLogin = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/hoc-online` },
      });
    } catch (error) {
      console.error('Lỗi đăng nhập Google:', error);
    }
  };

  const handleSelectSubject = (subjectId) => {
    setSelectedSubjectId(subjectId);
    setSelectedTeacherIndex(0);
    setSearchTerm('');
  };

  const handleSelectTeacher = (idx) => {
    setSelectedTeacherIndex(idx);
    if (viewerSectionRef.current) {
      viewerSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* ═══ BENTO HEADER — Trung Hoa Sáng ═══ */}
        <section
          aria-label="Tổng quan Học online"
          className="grid grid-cols-1 lg:grid-cols-12 gap-4"
        >
          {/* Tile chính (8 cột) */}
          <div className="imperial-frame relative overflow-hidden p-5 sm:p-7 lg:col-span-8 flex flex-col justify-between gap-5">
            <span
              aria-hidden="true"
              className="hanzi-watermark absolute -top-2 right-4 text-8xl font-bold text-accent/8"
            >
              講堂
            </span>

            <div className="relative space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <RankSeal size="sm" icon="cast_for_education" label="Học online · Mùa thi 2027" />
                <span className="paper-chip tabular">
                  <span className="material-symbols-outlined text-sm text-accent" aria-hidden="true">
                    groups
                  </span>
                  {ONLINE_TEACHER_COUNT} giáo viên · {ONLINE_SUBJECTS.length} môn
                </span>
              </div>

              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight text-foreground">
                {ONLINE_SHEET_TITLE}
              </h1>
              <p className="text-sm sm:text-base text-secondary-text max-w-2xl leading-relaxed">
                Chọn môn học, chọn thầy cô để mở ngay bảng bài giảng Google Sheet bên dưới.
                Khi đang xem bài, hệ thống tự động cộng EXP để bạn thăng cấp mỗi ngày.
              </p>
            </div>

            {activeTeacher && (
              <div className="relative flex flex-wrap items-center gap-2.5 pt-2 border-t border-border">
                <ArenaButton
                  as="a"
                  href={openUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="primary"
                  icon="open_in_new"
                  onClick={handleStartSession}
                >
                  Mở sheet gốc ở tab mới
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

          {/* Tile bên phải (4 cột): Cấp độ EXP + Đang xem */}
          <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            <div className="paper-card p-5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-secondary-text">
                    Tiến độ học viên
                  </p>
                  <p className="font-display tabular text-2xl font-extrabold text-foreground mt-0.5">
                    Cấp {levelInfo.level}
                  </p>
                </div>
                <span className="paper-chip tabular bg-gold-soft text-gold-dark border-gold">
                  <span
                    className="material-symbols-outlined text-base text-accent icon-fill"
                    aria-hidden="true"
                  >
                    bolt
                  </span>
                  {levelInfo.totalExp} EXP
                </span>
              </div>

              <ProgressBar
                value={levelInfo.expInLevel ?? levelInfo.expIntoLevel ?? 0}
                max={levelInfo.expForNext ?? levelInfo.expForThisLevel ?? 100}
                tone="jade"
                label="Tới cấp tiếp theo"
                sublabel={`${levelInfo.expInLevel ?? levelInfo.expIntoLevel ?? 0}/${levelInfo.expForNext ?? levelInfo.expForThisLevel ?? 100} EXP`}
              />

              {user && (
                <div className="flex items-center justify-between text-xs text-secondary-text pt-1 border-t border-border">
                  <span>
                    Đã học: <strong className="tabular text-foreground">{formatStudyTime(studySeconds)}</strong>
                  </span>
                  <span>
                    Chuỗi: <strong className="tabular text-accent">{streak > 0 ? `${streak} ngày` : '—'}</strong>
                  </span>
                </div>
              )}
            </div>

            <div className="paper-card p-5 flex items-center gap-3.5 bg-paper">
              <div
                aria-hidden="true"
                className={`flex h-12 w-12 no-shrink items-center justify-center rounded-xl border shadow-xs subject-solid-${selectedSubject?.id || 'DEFAULT'}`}
              >
                <span className="material-symbols-outlined text-2xl">
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

        {!googleLinked && (
          <div className="paper-card border-gold bg-gold-soft/50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs sm:text-sm font-semibold text-foreground">
              Tài khoản hiện tại chưa liên kết Google. Sheet nội bộ cần đúng email Google đã được cấp quyền.
            </p>
            <ArenaButton variant="gold" size="sm" icon="login" onClick={handleGoogleLogin}>
              Đăng nhập Google
            </ArenaButton>
          </div>
        )}

        {/* ═══ THANH PHIÊN HỌC DÍNH (SessionBar) ═══ */}
        {user && (
          <SessionBar
            status={sessionStatus}
            fallback={sessionFallback}
            sessionSeconds={sessionSeconds}
            subjectLabel={selectedSubject?.shortLabel}
            teacherTitle={activeTeacher?.title?.split(/\s+-\s+/)[0]}
            flashExp={flash}
            onConfirmContinue={handleConfirmContinue}
            onEndSession={handleEndSession}
          />
        )}

        {/* ═══ LƯỚI CHỌN MÔN HỌC (SubjectCard) ═══ */}
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

        {/* ═══ DANH SÁCH GIÁO VIÊN TRONG MÔN (TeacherCard) ═══ */}
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
                Bấm “Vào học” trên thẻ thầy cô để nạp bảng bài giảng xuống khung học bên dưới.
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
                Không tìm thấy giáo viên phù hợp với từ khoá “{searchTerm}”.
              </p>
              <p className="text-xs text-secondary-text">
                Thử gõ tên thầy/cô ngắn hơn hoặc xoá bộ lọc để xem toàn bộ danh sách.
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

        {/* ═══ KHUNG XEM SHEET BÀI GIẢNG (Flat阅读區) ═══ */}
        <section
          ref={viewerSectionRef}
          aria-labelledby="sheet-viewer-heading"
          className="paper-card overflow-hidden"
        >
          <div className="p-4 sm:p-5 border-b border-border bg-paper flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div
                aria-hidden="true"
                className={`w-11 h-11 rounded-xl flex items-center justify-center no-shrink border shadow-xs subject-solid-${selectedSubject?.id || 'DEFAULT'}`}
              >
                <span className="material-symbols-outlined text-2xl">
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
              <div className="flex flex-wrap items-center gap-2 no-shrink">
                <ArenaButton
                  variant="ghost"
                  size="sm"
                  icon="refresh"
                  onClick={() => setRefreshSeed((prev) => prev + 1)}
                >
                  Tải lại sheet
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
                  Mở toàn màn hình
                </ArenaButton>
              </div>
            )}
          </div>

          {activeTeacher ? (
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
                    Nếu trình duyệt chặn nhúng Google Sheet hoặc mạng chậm, bấm “Mở toàn màn hình”
                    ở góc trên để học trực tiếp trên Google Sheets.
                  </p>
                </div>
              )}

              <iframe
                key={`${activeTeacher.sheetId}-${refreshSeed}`}
                src={embedUrl}
                title={activeTeacher.title}
                className="w-full h-[640px] lg:h-[760px] border-0 bg-white"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={() => setLoadedEmbedUrl(embedUrl)}
              />
            </div>
          ) : (
            <div className="p-10 text-center text-secondary-text">
              Chọn một môn học và giáo viên ở phía trên để bắt đầu.
            </div>
          )}

          <div className="px-4 py-3 bg-paper border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-secondary-text">
            <span>
              Mẹo: Khi bảng có nhiều cột hoặc nhiều sheet con, bấm “Mở toàn màn hình” để thao tác
              rõ nhất.
            </span>
            <span className="text-muted-foreground font-medium">
              Nguồn dữ liệu: Google Sheets chính thức của khoá học
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
