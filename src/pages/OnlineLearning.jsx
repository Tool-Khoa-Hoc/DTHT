import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import ProgressBar from '../components/ui/ProgressBar';
import SessionBar from '../components/ui/SessionBar';
import SubjectCard from '../components/ui/SubjectCard';
import TeacherCard from '../components/ui/TeacherCard';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950';

const IFRAME_STALL_MS = 9000;

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

function isGoogleAccount(user) {
  if (!user) return false;
  if (user.app_metadata?.provider === 'google') return true;
  const identities = Array.isArray(user.identities) ? user.identities : [];
  return identities.some((identity) => identity?.provider === 'google');
}

function normalizeText(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function splitTeacherTitle(title) {
  const [mainTitle, ...detailParts] = String(title ?? '').split(' - ');
  return {
    mainTitle: mainTitle.trim(),
    detail: detailParts.join(' - ').trim(),
  };
}

/* ── Icon SVG inline (không dùng emoji / font icon cho phần redesign) ── */

function SchoolIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 4 2.5 8.5 12 13l9.5-4.5Z" />
      <path d="M6 10.8V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.2" />
      <path d="M21.5 8.5V14" />
    </svg>
  );
}

function RefreshIcon({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20.2 3.8v4.4h-4.4" />
    </svg>
  );
}

function ExternalIcon({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
    </svg>
  );
}

function ClockIcon({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

function FlameIcon({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 3c.9 2.9-.6 4.6-2 6.1C8.9 10.5 8 12 8 13.8a4.8 4.8 0 0 0 4.8 4.7c2.9-.2 5-2.4 5-5.2 0-1.9-1-3.4-2-4.9-.4 1-1.1 1.8-2.1 2.2C14.4 9.4 13.4 5.9 12 3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function BoltIcon({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M13 2.5 4.9 13.4h5.6L9.4 21.5l8.2-10.9h-5.8L13 2.5Z" fill="currentColor" />
    </svg>
  );
}

function GridIcon({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1.6" />
      <rect x="13" y="4" width="7" height="7" rx="1.6" />
      <rect x="4" y="13" width="7" height="7" rx="1.6" />
      <rect x="13" y="13" width="7" height="7" rx="1.6" />
    </svg>
  );
}

function UsersIcon({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" />
      <path d="M16 5.6a3.2 3.2 0 0 1 0 5.9" />
      <path d="M17.8 15.3c1.5.7 2.4 2 2.7 4.2" />
    </svg>
  );
}

function SearchIcon({ className = 'h-[19px] w-[19px]' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

function SpinnerIcon({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`animate-spin ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function OnlineLearning() {
  const { user, loading, profile, refreshProfile } = useAuth();

  const [activeSubjectId, setActiveSubjectId] = useState('');
  const [activeTeacherKey, setActiveTeacherKey] = useState('');
  const [iframeLoading, setIframeLoading] = useState(false);
  const [iframeTimedOut, setIframeTimedOut] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [teacherSearch, setTeacherSearch] = useState('');

  const googleLinked = useMemo(() => isGoogleAccount(user), [user]);
  const activeSubject = useMemo(
    () => ONLINE_SUBJECTS.find((subject) => subject.id === activeSubjectId) ?? null,
    [activeSubjectId],
  );

  const activeTeacherEntry = useMemo(() => {
    if (!activeSubject) return null;

    const teachers = activeSubject?.teachers ?? [];
    const entries = teachers.map((teacher, index) => ({
      index,
      key: getTeacherKey(activeSubject.id, teacher, index),
      teacher,
    }));

    return entries.find((entry) => entry.key === activeTeacherKey) ?? null;
  }, [activeSubject, activeTeacherKey]);

  const activeTeacher = activeTeacherEntry?.teacher ?? null;
  const openSheetUrl = activeTeacher ? buildSheetOpenUrl(activeTeacher) : '#';
  const embedSheetUrl = activeTeacher ? buildSheetEmbedUrl(activeTeacher, refreshToken) : '';

  // EXP accrues only while an actual lesson sheet is open.
  // EXP v2: hook tự mở phiên học theo sheetId/subjectId (heartbeat server-side,
  // không còn phụ thuộc tab đang hiện). Mọi trường v2 đều đọc phòng thủ —
  // hook bản cũ thiếu trường nào thì trang vẫn chạy như trước.
  const study = useStudyTracker({
    enabled: Boolean(user && activeTeacher),
    subjectId: activeSubject?.id ?? null,
    sheetId: activeTeacher?.sheetId ?? null,
    initialExp: profile?.exp,
    initialStudySeconds: profile?.study_seconds,
    initialStreak: profile?.study_streak,
    onSync: refreshProfile,
  });
  const { levelInfo, streak, studySeconds, isAccruing, flash, clearFlash } = study;
  const levelAccent = getLevelAccent(levelInfo.level);

  const sessionStatus = study.sessionStatus ?? study.status ?? (isAccruing ? 'active' : 'idle');
  const sessionSeconds = study.sessionSeconds ?? 0;
  const sessionFallback = Boolean(study.isFallback ?? study.fallback ?? study.legacyMode);
  const sessionStatusLabel =
    sessionStatus === 'needs-confirm'
      ? 'Chờ xác nhận'
      : sessionStatus === 'active'
        ? 'Đang tích EXP'
        : sessionStatus === 'ending'
          ? 'Đang kết thúc'
          : isAccruing
            ? 'Đang tích EXP'
            : 'Tạm dừng';

  // Gọi hàm của tracker mà không bao giờ chặn việc học nếu tracker lỗi/thiếu.
  const callStudy = useCallback((fn) => {
    if (typeof fn !== 'function') return;
    try {
      fn();
    } catch {
      /* tracker lỗi không được làm hỏng luồng học */
    }
  }, []);
  const handleStartSession = useCallback(() => callStudy(study.startSession), [callStudy, study.startSession]);
  const handleEndSession =
    typeof study.endSession === 'function' ? () => callStudy(study.endSession) : undefined;
  const handleConfirmContinue =
    typeof study.confirmContinue === 'function' ? () => callStudy(study.confirmContinue) : undefined;

  // Auto-dismiss the reward toast a few seconds after it appears.
  useEffect(() => {
    if (!flash) return undefined;
    const timeoutId = window.setTimeout(clearFlash, 3600);
    return () => window.clearTimeout(timeoutId);
  }, [flash, clearFlash]);

  const filteredTeacherEntries = useMemo(() => {
    if (!activeSubject) return [];

    const query = normalizeText(teacherSearch.trim());
    const teachers = activeSubject?.teachers ?? [];

    return teachers
      .map((teacher, index) => ({
        index,
        key: getTeacherKey(activeSubject.id, teacher, index),
        teacher,
      }))
      .filter((entry) => !query || normalizeText(entry.teacher.title).includes(query));
  }, [activeSubject, teacherSearch]);

  const refreshIframe = useCallback(() => {
    if (!activeTeacher) return;
    setIframeLoading(true);
    setIframeTimedOut(false);
    setRefreshToken((currentToken) => currentToken + 1);
  }, [activeTeacher]);

  useEffect(() => {
    if (!iframeLoading || !activeTeacher) return undefined;

    const timeoutId = window.setTimeout(() => {
      setIframeTimedOut(true);
    }, IFRAME_STALL_MS);

    return () => window.clearTimeout(timeoutId);
  }, [activeTeacher, iframeLoading, refreshToken]);

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

  const handleSelectSubject = (subject) => {
    setActiveSubjectId(subject.id);
    setTeacherSearch('');
    setIframeTimedOut(false);
    setIframeLoading(false);
    setActiveTeacherKey('');
  };

  const handleChangeSubject = () => {
    setActiveSubjectId('');
    setTeacherSearch('');
    setIframeTimedOut(false);
    setIframeLoading(false);
    setActiveTeacherKey('');
  };

  const handleChangeTeacher = () => {
    setTeacherSearch('');
    setIframeTimedOut(false);
    setIframeLoading(false);
    setActiveTeacherKey('');
  };

  const handleSelectTeacher = (subject, teacher, index) => {
    const nextKey = getTeacherKey(subject.id, teacher, index);
    if (nextKey === activeTeacherKey) return;

    setActiveTeacherKey(nextKey);
    setIframeTimedOut(false);
    setIframeLoading(true);
    setRefreshToken((currentToken) => currentToken + 1);
  };

  if (loading && !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-ink-950 text-jade-400">
        <SpinnerIcon />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-[radial-gradient(70%_45%_at_82%_-8%,rgba(95,207,166,0.1),transparent_60%),radial-gradient(48%_38%_at_-2%_2%,rgba(227,100,136,0.07),transparent_55%)] bg-ink-950 font-display text-slate-100',
        // Chế độ tập trung khi đang xem sheet: trang khoá đúng 1 màn hình
        // (mobile trừ header 3rem + bottom-nav 4rem của RootLayout), không
        // cuộn, để vùng sheet ở dưới giãn hết phần còn lại.
        activeTeacher
          ? 'flex h-[calc(100dvh-7rem)] flex-col overflow-hidden pb-0 md:h-dvh'
          : 'min-h-screen pb-24 xl:flex xl:h-dvh xl:flex-col xl:overflow-hidden xl:pb-0',
      )}
    >
      {/* ── Đầu trang dạng bento (Arena Bento) — ẩn hẳn khi đang xem sheet,
          dải bento này chiếm ~40% chiều cao khiến sheet bị thu nhỏ ── */}
      {!activeTeacher && (
      <header className="shrink-0 px-3 pt-4 sm:px-5 lg:px-6 xl:pt-3">
        <div className="mx-auto max-w-[1760px]">
          <div className={cn('grid gap-3', user ? 'xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)_minmax(0,0.95fr)]' : 'xl:grid-cols-1')}>
            {/* Tile chính: tiêu đề + tổng quan + CTA */}
            <div className="arena-card arena-sweep p-5">
              <div className="flex items-center gap-2.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-jade-400/15 text-jade-300 ring-1 ring-jade-400/25">
                  <SchoolIcon className="h-[22px] w-[22px]" />
                </span>
                <p className="font-arena text-[11px] font-bold uppercase tracking-[0.24em] text-jade-300">
                  Học online · Đấu trường học tập
                </p>
              </div>
              <h1 className="font-arena-display mt-3 text-[26px] font-extrabold leading-tight text-white sm:text-[32px]">
                {ONLINE_SHEET_TITLE}
              </h1>
              <p className="mt-1.5 text-sm font-semibold text-slate-400">
                <span className="tabular">{ONLINE_SUBJECTS.length}</span> môn ·{' '}
                <span className="tabular">{ONLINE_TEACHER_COUNT}</span> sheet giáo viên · Chọn môn,
                chọn giáo viên rồi vào học — EXP tự tích theo phiên học, kể cả khi bạn học ở tab Sheet khác.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <ArenaButton
                  variant="primary"
                  href={openSheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleStartSession}
                  disabled={!activeTeacher}
                >
                  <ExternalIcon />
                  Mở Google Sheets
                </ArenaButton>
                <ArenaButton variant="ghost" onClick={refreshIframe} disabled={!activeTeacher}>
                  <RefreshIcon />
                  Làm mới
                </ArenaButton>
              </div>
            </div>

            {user && (
              <>
                {/* Tile cấp độ + thanh EXP */}
                <div
                  className="arena-card flex items-center gap-4 p-5"
                  title="Học online để tích Công Lực và thăng Cấp độ. 10 công lực mỗi phút học."
                >
                  <div className={cn('rank-seal grid h-14 w-14 shrink-0 place-items-center bg-white/8 ring-1', levelAccent.ring)}>
                    <span className={cn('font-arena-display text-xl font-extrabold leading-none', levelAccent.text)}>
                      {levelInfo.level}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <ProgressBar
                      label={`Cấp ${levelInfo.level} · Công lực`}
                      valueLabel={`${levelInfo.expIntoLevel.toLocaleString('vi-VN')} / ${levelInfo.expForThisLevel.toLocaleString('vi-VN')}`}
                      value={levelInfo.progressPct}
                      gradientClassName={levelAccent.bar}
                      barHeight="h-2.5"
                    />
                    <p className="mt-2 text-xs font-semibold text-slate-400">
                      Còn <span className="tabular font-black text-slate-200">{levelInfo.expToNext.toLocaleString('vi-VN')}</span>{' '}
                      EXP nữa lên Cấp <span className="tabular font-black text-slate-200">{levelInfo.level + 1}</span>
                    </p>
                  </div>
                </div>

                {/* Tile thống kê phiên/tổng thời gian/streak */}
                <div className="arena-card grid grid-cols-3 gap-3 p-5 xl:grid-cols-1 xl:gap-2.5">
                  <div className="flex items-center gap-2.5" title="Tổng thời gian đã học">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-slate-300 ring-1 ring-white/10">
                      <ClockIcon />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">Đã học</span>
                      <span className="tabular block truncate text-sm font-black text-slate-100">{formatStudyTime(studySeconds)}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5" title={streak > 0 ? `Chuỗi ${streak} ngày học liên tiếp` : 'Chưa có chuỗi ngày học'}>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-400/12 text-gold-300 ring-1 ring-gold-400/25">
                      <FlameIcon />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">Chuỗi ngày</span>
                      <span className="tabular block truncate text-sm font-black text-slate-100">
                        {streak > 0 ? `${streak} ngày` : '—'}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        'grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1',
                        sessionStatus === 'active' || isAccruing
                          ? 'bg-jade-400/12 text-jade-300 ring-jade-400/25'
                          : 'bg-white/5 text-slate-400 ring-white/10',
                      )}
                    >
                      <BoltIcon className={cn('h-[18px] w-[18px]', (sessionStatus === 'active' || isAccruing) && 'animate-pulse')} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">Tích EXP</span>
                      <span className="block truncate text-sm font-black text-slate-100">{sessionStatusLabel}</span>
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {!googleLinked && (
            <div className="mt-3 grid gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100 shadow-[0_12px_28px_rgba(0,0,0,0.2)] md:grid-cols-[1fr_auto] md:items-center">
              <span className="font-semibold leading-6">
                Tài khoản hiện tại chưa liên kết Google. Sheet private cần đúng email đã được cấp quyền.
              </span>
              <ArenaButton variant="gold" size="sm" onClick={handleGoogleLogin}>
                Đăng nhập Google
              </ArenaButton>
            </div>
          )}
        </div>
      </header>
      )}

      <main
        className={
          activeTeacher
            ? 'grid min-h-0 w-full flex-1 grid-cols-1 overflow-hidden'
            : cn(
                'mx-auto grid w-full max-w-[1760px] gap-5 px-3 py-5 sm:px-5 lg:px-6 xl:min-h-0 xl:flex-1 xl:overflow-hidden xl:py-3',
                activeSubject ? 'xl:grid-cols-[260px_minmax(0,1fr)]' : 'xl:grid-cols-1',
              )
        }
      >
        {!activeTeacher && activeSubject && (
          <aside className="xl:flex xl:min-h-0 xl:flex-col xl:self-stretch">
            <div className="mb-3 flex items-end justify-between gap-3 px-1">
              <div>
                <h2 className="font-arena-display text-xl font-bold leading-tight text-white">Chọn môn</h2>
                <p className="mt-1 text-xs font-bold text-slate-400">Môn đang chọn: {activeSubject.shortLabel}</p>
              </div>
              <span className="arena-chip tabular">{ONLINE_SUBJECTS.length} môn</span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:min-h-0 xl:flex-1 xl:grid-cols-1 xl:overflow-y-auto xl:pr-1 custom-scrollbar">
              {ONLINE_SUBJECTS.map((subject) => (
                <SubjectCard
                  key={subject.id}
                  subject={subject}
                  active={subject.id === activeSubject.id}
                  compact
                  onSelect={() => handleSelectSubject(subject)}
                />
              ))}
            </div>
          </aside>
        )}

        <section className={activeTeacher ? 'flex min-h-0 min-w-0 flex-1 flex-col' : 'min-w-0 xl:h-full xl:min-h-0'}>
          {!activeSubject ? (
            <section
              className="arena-card p-4 sm:p-5 xl:flex xl:h-full xl:min-h-0 xl:flex-col"
              aria-labelledby="subject-picker-title"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-arena text-xs font-bold uppercase tracking-[0.24em] text-jade-300">Bước 1</p>
                  <h2 id="subject-picker-title" className="font-arena-display mt-1 text-[26px] font-extrabold leading-tight text-white">
                    Chọn môn học
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-400">
                    Chọn môn trước, sau đó chọn giáo viên để mở sheet học.
                  </p>
                </div>
                <span className="arena-chip tabular">{ONLINE_SUBJECTS.length} môn</span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:min-h-0 xl:flex-1 xl:grid-cols-5 xl:overflow-y-auto xl:pr-1 custom-scrollbar">
                {ONLINE_SUBJECTS.map((subject) => (
                  <SubjectCard
                    key={subject.id}
                    subject={subject}
                    active={subject.id === activeSubjectId}
                    onSelect={() => handleSelectSubject(subject)}
                  />
                ))}
              </div>
            </section>
          ) : activeTeacher ? (
            <section
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-ink-900"
              aria-labelledby="sheet-preview-title"
            >
              <div className="grid shrink-0 gap-2 border-b border-white/10 px-3 py-2 text-white lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="arena-chip">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: activeSubject.color }} aria-hidden="true" />
                      {activeSubject.label}
                    </span>
                    <span className="arena-chip">Đang xem sheet</span>
                  </div>
                  <h2 id="sheet-preview-title" className="font-arena-display mt-1 truncate text-base font-extrabold leading-tight sm:text-lg">
                    {splitTeacherTitle(activeTeacher.title).mainTitle}
                  </h2>
                  <p className="mt-0.5 hidden line-clamp-1 text-xs font-semibold leading-5 text-white/60 sm:block">
                    {splitTeacherTitle(activeTeacher.title).detail || 'Google Sheet giáo viên'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                  <ArenaButton variant="ghost" size="sm" onClick={handleChangeTeacher}>
                    <UsersIcon className="h-4 w-4" />
                    Đổi giáo viên
                  </ArenaButton>
                  <ArenaButton variant="ghost" size="sm" onClick={handleChangeSubject}>
                    <GridIcon className="h-4 w-4" />
                    Đổi môn
                  </ArenaButton>
                  <button
                    type="button"
                    onClick={refreshIframe}
                    className={cn(
                      'grid min-h-11 w-full place-items-center rounded-xl border border-white/12 bg-white/5 text-white transition-all hover:bg-white/10 active:scale-[0.96] sm:w-11',
                      focusRing,
                    )}
                    aria-label="Làm mới sheet đang xem"
                  >
                    <RefreshIcon />
                  </button>
                  <ArenaButton
                    variant="primary"
                    size="sm"
                    href={openSheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleStartSession}
                  >
                    <ExternalIcon className="h-4 w-4" />
                    Mở sheet
                  </ArenaButton>
                </div>
              </div>

              {/* Thanh phiên học — dính ngay phía trên khu vực học, sát mép để
                  không ăn thêm chiều cao của sheet */}
              <div className="shrink-0">
                <SessionBar
                  status={sessionStatus}
                  fallback={sessionFallback}
                  sessionSeconds={sessionSeconds}
                  teacherTitle={splitTeacherTitle(activeTeacher.title).mainTitle}
                  subjectLabel={activeSubject.shortLabel}
                  onEndSession={handleEndSession}
                  onConfirmContinue={handleConfirmContinue}
                />
              </div>

              <div className="relative min-h-0 flex-1 overflow-hidden bg-ink-900">
                {iframeLoading && (
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-ink-950/85 px-4">
                    <div className="arena-card max-w-sm px-5 py-5 text-center">
                      <span className="flex justify-center text-jade-400">
                        <SpinnerIcon />
                      </span>
                      <p className="font-arena-display mt-2 text-base font-bold text-white">Đang tải sheet giáo viên</p>
                      {iframeTimedOut && (
                        <p className="mt-2 text-xs font-semibold leading-5 text-slate-400">
                          Nếu Google chặn xem trước, dùng nút mở sheet để vào trực tiếp.
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <iframe
                  id="online-sheet-frame"
                  key={`${activeTeacherEntry?.key}-${refreshToken}`}
                  title={`Sheet ${activeTeacher.title}`}
                  src={embedSheetUrl}
                  onLoad={() => {
                    setIframeLoading(false);
                    setIframeTimedOut(false);
                  }}
                  className="absolute inset-0 h-full w-full border-0 bg-white"
                  loading="lazy"
                />
              </div>
            </section>
          ) : (
            <section className="xl:flex xl:h-full xl:min-h-0 xl:flex-col" aria-labelledby="teacher-list-title">
              <div className="arena-card p-4 sm:p-5">
                <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                  <div>
                    <p className="font-arena text-xs font-bold uppercase tracking-[0.2em] text-jade-300">Bước 2 · {activeSubject.label}</p>
                    <h2 id="teacher-list-title" className="font-arena-display mt-1 text-[24px] font-extrabold leading-tight text-white">
                      Chọn giáo viên
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-slate-400">
                      Chọn một giáo viên để mở sheet học ở chế độ rộng.
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[minmax(220px,320px)_auto]">
                    <label className="relative block w-full">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                        <SearchIcon />
                      </span>
                      <input
                        value={teacherSearch}
                        onChange={(event) => setTeacherSearch(event.target.value)}
                        placeholder="Tìm giáo viên"
                        className={cn(
                          'min-h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-3 text-sm font-semibold text-white placeholder-slate-500 outline-none transition focus:border-jade-400 focus:bg-white/8',
                          focusRing,
                        )}
                      />
                    </label>
                    <ArenaButton variant="ghost" size="sm" onClick={handleChangeSubject}>
                      <GridIcon className="h-4 w-4" />
                      Đổi môn
                    </ArenaButton>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1 custom-scrollbar">
                {filteredTeacherEntries.length > 0 ? (
                  filteredTeacherEntries.map((entry) => (
                    <TeacherCard
                      key={entry.key}
                      teacher={entry.teacher}
                      subject={activeSubject}
                      index={entry.index}
                      active={entry.key === activeTeacherEntry?.key}
                      onSelect={() => handleSelectTeacher(activeSubject, entry.teacher, entry.index)}
                    />
                  ))
                ) : (
                  <div className="arena-card grid min-h-[260px] place-items-center px-5 py-8 text-center sm:col-span-2 2xl:col-span-3" style={{ borderStyle: 'dashed' }}>
                    <div>
                      <span className="flex justify-center text-slate-500">
                        <SearchIcon className="h-8 w-8" />
                      </span>
                      <p className="mt-2 text-sm font-bold text-slate-400">Không tìm thấy sheet phù hợp.</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">Thử từ khoá khác hoặc đổi môn học.</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </section>
      </main>

      {flash && (
        <div
          key={flash.id}
          className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 px-4 xl:bottom-8"
          role="status"
          aria-live="polite"
        >
          {flash.type === 'levelup' ? (
            <div className="flex items-center gap-3 rounded-2xl border border-gold-400/50 bg-ink-900/95 px-5 py-3.5 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur ember-pulse">
              <span className="rank-seal grid h-11 w-11 place-items-center bg-gold-400/15 ring-1 ring-gold-400/50 text-gold-300">
                <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  military_tech
                </span>
              </span>
              <div className="text-left">
                <p className="font-arena text-[11px] font-bold uppercase tracking-[0.2em] text-gold-300/85">Thăng cấp!</p>
                <p className="font-arena-display text-lg font-extrabold leading-tight text-white">Đạt Cấp {flash.level}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-jade-400/40 bg-ink-900/95 px-4 py-2.5 shadow-[0_18px_44px_rgba(0,0,0,0.5)] backdrop-blur">
              <BoltIcon className="h-[19px] w-[19px] text-jade-300" />
              <span className="font-arena text-sm font-black text-white">+{flash.amount} công lực</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
