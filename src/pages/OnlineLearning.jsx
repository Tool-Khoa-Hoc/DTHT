import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  ONLINE_SHEET_TITLE,
  ONLINE_SUBJECTS,
  ONLINE_TEACHER_COUNT,
  buildSheetEmbedUrl,
  buildSheetOpenUrl,
  getTeacherKey,
} from '../config/onlineLearning';

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
  const [mainTitle, ...detailParts] = title.split(' - ');
  return {
    mainTitle: mainTitle.trim(),
    detail: detailParts.join(' - ').trim(),
  };
}

function SubjectButton({ active, compact = false, onSelect, subject }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        'group flex items-center gap-3 rounded-lg border text-left shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition-all hover:-translate-y-0.5 active:scale-[0.98]',
        compact ? 'min-h-[70px] p-3' : 'min-h-[104px] p-4',
        active ? 'text-white' : 'border-white/10 bg-white/[0.04] text-white hover:border-jade-400/50 hover:bg-white/[0.06]',
        focusRing,
      )}
      style={
        active
          ? {
              backgroundColor: subject.color,
              borderColor: subject.color,
              boxShadow: `0 18px 40px ${subject.color}40`,
            }
          : undefined
      }
    >
      <span
        className={cn(
          'grid shrink-0 place-items-center rounded-md transition-colors',
          compact ? 'h-11 w-11' : 'h-12 w-12',
          active ? 'bg-white/18 text-white' : 'bg-white/5',
        )}
        style={!active ? { color: subject.color } : undefined}
      >
        <span className={cn('material-symbols-outlined', compact ? 'text-[23px]' : 'text-[26px]')}>{subject.icon}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('font-arena block font-extrabold leading-tight', compact ? 'text-base' : 'text-lg')}>{subject.label}</span>
        <span className={cn('mt-1 block text-xs font-bold', active ? 'text-white/80' : 'text-slate-400')}>
          {subject.teachers.length} sheet
        </span>
      </span>
    </button>
  );
}

function TeacherCard({ active, index, onSelect, subject, teacher }) {
  const { mainTitle, detail } = splitTeacherTitle(teacher.title);

  return (
    <article
      className={cn(
        'group grid gap-2 rounded-lg border bg-white/[0.04] p-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition-all sm:grid-cols-[1fr_auto]',
        active ? 'border-jade-400 shadow-[0_18px_44px_rgba(95,207,166,0.18)]' : 'border-white/10 hover:border-jade-400/45 hover:bg-white/[0.06]',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn('min-w-0 rounded-md text-left transition active:scale-[0.995]', focusRing)}
        aria-pressed={active}
      >
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md text-xs font-black text-white"
            style={{ backgroundColor: active ? '#5fcfa6' : subject.color }}
          >
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'rounded-md px-2 py-1 text-[11px] font-black uppercase leading-none',
                  active ? 'bg-jade-400/15 text-jade-300' : 'bg-white/8 text-slate-300',
                )}
              >
                {active ? 'Đang xem' : subject.shortLabel}
              </span>
              <span className="rounded-md bg-white/6 px-2 py-1 text-[11px] font-black uppercase leading-none text-jade-300">
                Sheet riêng
              </span>
            </span>
            <span className="mt-1.5 line-clamp-1 block text-[14px] font-black leading-snug text-white sm:text-[15px]">
              {mainTitle}
            </span>
            {detail && <span className="mt-1 line-clamp-1 block text-xs font-semibold leading-5 text-slate-400">{detail}</span>}
          </span>
        </div>
      </button>

      <a
        href={buildSheetOpenUrl(teacher)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs font-black text-slate-200 transition-all hover:-translate-y-0.5 hover:border-jade-400 hover:bg-jade-400/10 hover:text-jade-200 active:scale-[0.98] sm:self-start',
          active ? 'border-jade-400/60 bg-jade-400/10' : 'border-white/10 bg-white/5',
          focusRing,
        )}
      >
        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
        Mở ngoài
      </a>
    </article>
  );
}

export default function OnlineLearning() {
  const { user, loading } = useAuth();

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
      <div className="flex min-h-[60vh] items-center justify-center bg-ink-950 text-white">
        <span className="material-symbols-outlined animate-spin text-3xl text-jade-400">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(70%_45%_at_82%_-8%,rgba(95,207,166,0.1),transparent_60%),radial-gradient(48%_38%_at_-2%_2%,rgba(227,100,136,0.07),transparent_55%)] bg-ink-950 pb-24 font-display text-slate-100 xl:flex xl:h-dvh xl:flex-col xl:overflow-hidden xl:pb-0">
      <header className="sticky top-[calc(3rem+env(safe-area-inset-top,0px))] z-30 shrink-0 border-b border-white/8 bg-ink-900/85 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.3)] backdrop-blur-xl md:top-0 xl:py-2 sm:px-6">
        <div className="mx-auto max-w-[1760px]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-jade-400/15 text-jade-300 ring-1 ring-jade-400/25 xl:h-10 xl:w-10">
                <span className="material-symbols-outlined text-[24px] leading-none">school</span>
              </span>
              <div className="min-w-0">
                <p className="font-arena text-[11px] font-bold uppercase tracking-[0.24em] text-jade-300">Học online</p>
                <h1 className="font-arena text-xl font-extrabold leading-tight text-white xl:text-[22px] sm:text-2xl">{ONLINE_SHEET_TITLE}</h1>
                <p className="mt-1 text-sm font-semibold text-slate-400">
                  {ONLINE_SUBJECTS.length} môn · {ONLINE_TEACHER_COUNT} sheet giáo viên
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:justify-end">
              <button
                type="button"
                onClick={refreshIframe}
                disabled={!activeTeacher}
                className={cn(
                  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-jade-400/40 bg-jade-400/12 px-4 text-sm font-black text-jade-200 transition-all hover:-translate-y-0.5 hover:bg-jade-400/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
                  focusRing,
                )}
              >
                <span className="material-symbols-outlined text-[18px]">sync</span>
                Làm mới
              </button>

              <a
                href={openSheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!activeTeacher}
                className={cn(
                  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-jade-500 px-4 text-sm font-black text-ink-950 shadow-lg shadow-jade-500/20 transition-all hover:-translate-y-0.5 hover:bg-jade-400 active:scale-[0.98]',
                  !activeTeacher && 'pointer-events-none opacity-50',
                  focusRing,
                )}
              >
                <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                Mở Google Sheets
              </a>
            </div>
          </div>

          {!googleLinked && (
            <div className="mt-3 grid gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-3 text-sm text-amber-100 shadow-[0_12px_28px_rgba(0,0,0,0.2)] md:grid-cols-[1fr_auto] md:items-center">
              <span className="font-semibold leading-6">
                Tài khoản hiện tại chưa liên kết Google. Sheet private cần đúng email đã được cấp quyền.
              </span>
              <button
                type="button"
                onClick={handleGoogleLogin}
                className={cn(
                  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md bg-amber-500 px-3 text-sm font-black text-ink-950 transition-all hover:-translate-y-0.5 hover:bg-amber-400 active:scale-[0.98]',
                  focusRing,
                )}
              >
                <span className="material-symbols-outlined text-[17px]">login</span>
                Đăng nhập Google
              </button>
            </div>
          )}
        </div>
      </header>

      <main
        className={cn(
          'mx-auto grid w-full max-w-[1760px] gap-5 px-3 py-5 sm:px-5 lg:px-6 xl:min-h-0 xl:flex-1 xl:overflow-hidden xl:py-3',
          activeTeacher ? 'xl:grid-cols-1' : activeSubject ? 'xl:grid-cols-[260px_minmax(0,1fr)]' : 'xl:grid-cols-1',
        )}
      >
        {!activeTeacher && activeSubject && (
          <aside className="xl:flex xl:min-h-0 xl:flex-col xl:self-stretch">
            <div className="mb-3 flex items-end justify-between gap-3 px-1">
              <div>
                <h2 className="font-arena text-lg font-extrabold leading-tight text-white">Chọn môn</h2>
                <p className="mt-1 text-xs font-bold text-slate-400">Môn đang chọn: {activeSubject.shortLabel}</p>
              </div>
              <span className="rounded-md bg-white/8 px-2.5 py-1 text-xs font-black text-slate-300">
                {ONLINE_SUBJECTS.length}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:min-h-0 xl:flex-1 xl:grid-cols-1 xl:overflow-y-auto xl:pr-1 custom-scrollbar">
              {ONLINE_SUBJECTS.map((subject) => (
                <SubjectButton
                  key={subject.id}
                  active={subject.id === activeSubject.id}
                  compact
                  onSelect={() => handleSelectSubject(subject)}
                  subject={subject}
                />
              ))}
            </div>
          </aside>
        )}

        <section className="min-w-0 xl:h-full xl:min-h-0">
          {!activeSubject ? (
            <section
              className="rounded-lg border border-white/10 bg-white/[0.03] p-4 shadow-[0_22px_60px_rgba(0,0,0,0.28)] xl:flex xl:h-full xl:min-h-0 xl:flex-col"
              aria-labelledby="subject-picker-title"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-arena text-xs font-bold uppercase tracking-[0.24em] text-jade-300">Bước 1</p>
                  <h2 id="subject-picker-title" className="font-arena mt-1 text-2xl font-extrabold leading-tight text-white">
                    Chọn môn học
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-400">
                    Chọn môn trước, sau đó chọn giáo viên để mở sheet học.
                  </p>
                </div>
                <span className="inline-flex h-9 items-center rounded-md bg-jade-400/12 px-3 text-sm font-black text-jade-300">
                  {ONLINE_SUBJECTS.length} môn
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:min-h-0 xl:flex-1 xl:grid-cols-5 xl:overflow-y-auto xl:pr-1 custom-scrollbar">
                {ONLINE_SUBJECTS.map((subject) => (
                  <SubjectButton
                    key={subject.id}
                    active={subject.id === activeSubjectId}
                    onSelect={() => handleSelectSubject(subject)}
                    subject={subject}
                  />
                ))}
              </div>
            </section>
          ) : activeTeacher ? (
            <section
              className="min-w-0 rounded-lg border border-white/10 bg-ink-900 shadow-[0_24px_60px_rgba(0,0,0,0.35)] xl:flex xl:h-full xl:min-h-0 xl:flex-col"
              aria-labelledby="sheet-preview-title"
            >
              <div className="grid shrink-0 gap-3 border-b border-white/10 p-2.5 text-white lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-jade-400/12 px-2 py-1 text-[11px] font-black uppercase text-jade-300">
                      {activeSubject.label}
                    </span>
                    <span className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-black uppercase text-white/70">
                      Đang xem sheet
                    </span>
                  </div>
                  <h2 id="sheet-preview-title" className="font-arena mt-1 truncate text-lg font-extrabold leading-tight xl:text-xl">
                    {splitTeacherTitle(activeTeacher.title).mainTitle}
                  </h2>
                  <p className="mt-0.5 line-clamp-1 text-sm font-semibold leading-5 text-white/68">
                    {splitTeacherTitle(activeTeacher.title).detail || 'Google Sheet giáo viên'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                  <button
                    type="button"
                    onClick={handleChangeTeacher}
                    className={cn(
                      'inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-white/12 bg-white/8 px-3 text-xs font-black text-white transition-all hover:bg-white/14 active:scale-[0.98]',
                      focusRing,
                    )}
                  >
                    <span className="material-symbols-outlined text-[16px]">group</span>
                    Đổi giáo viên
                  </button>
                  <button
                    type="button"
                    onClick={handleChangeSubject}
                    className={cn(
                      'inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-white/12 bg-white/8 px-3 text-xs font-black text-white transition-all hover:bg-white/14 active:scale-[0.98]',
                      focusRing,
                    )}
                  >
                    <span className="material-symbols-outlined text-[16px]">dashboard</span>
                    Đổi môn
                  </button>
                  <button
                    type="button"
                    onClick={refreshIframe}
                    className={cn(
                      'grid h-10 w-full place-items-center rounded-md border border-white/12 bg-white/8 text-white transition-all hover:bg-white/14 active:scale-[0.96] sm:w-10',
                      focusRing,
                    )}
                    aria-label="Làm mới sheet đang xem"
                  >
                    <span className="material-symbols-outlined text-[18px]">sync</span>
                  </button>
                  <a
                    href={openSheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-jade-500 px-3 text-xs font-black text-ink-950 transition-all hover:-translate-y-0.5 hover:bg-jade-400 active:scale-[0.98]',
                      focusRing,
                    )}
                  >
                    <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                    Mở sheet
                  </a>
                </div>
              </div>

              <div className="relative min-h-[620px] overflow-hidden rounded-b-lg bg-ink-900 xl:min-h-0 xl:flex-1">
                {iframeLoading && (
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-ink-950/85 px-4">
                    <div className="max-w-sm rounded-lg border border-white/10 bg-ink-900 px-4 py-4 text-center shadow-[0_20px_54px_rgba(0,0,0,0.4)]">
                      <span className="material-symbols-outlined animate-spin text-3xl text-jade-400">progress_activity</span>
                      <p className="mt-2 text-sm font-black text-white">Đang tải sheet giáo viên</p>
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
                  className="h-[78dvh] min-h-[620px] w-full border-0 bg-white xl:h-full xl:min-h-0"
                  loading="lazy"
                />
              </div>
            </section>
          ) : (
            <section className="xl:flex xl:h-full xl:min-h-0 xl:flex-col" aria-labelledby="teacher-list-title">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
                <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                  <div>
                    <p className="font-arena text-xs font-bold uppercase tracking-[0.2em] text-jade-300">Bước 2 · {activeSubject.label}</p>
                    <h2 id="teacher-list-title" className="font-arena mt-1 text-xl font-extrabold leading-tight text-white">
                      Chọn giáo viên
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-slate-400">
                      Chọn một giáo viên để mở sheet học ở chế độ rộng.
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[minmax(220px,320px)_auto]">
                    <label className="relative block w-full">
                      <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[19px] text-slate-500">
                        search
                      </span>
                      <input
                        value={teacherSearch}
                        onChange={(event) => setTeacherSearch(event.target.value)}
                        placeholder="Tìm giáo viên"
                        className={cn(
                          'h-10 w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-3 text-sm font-semibold text-white placeholder-slate-500 outline-none transition focus:border-jade-400 focus:bg-white/8',
                          focusRing,
                        )}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleChangeSubject}
                      className={cn(
                        'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-slate-200 transition-all hover:-translate-y-0.5 hover:border-jade-400 hover:bg-jade-400/10 hover:text-jade-200 active:scale-[0.98]',
                        focusRing,
                      )}
                    >
                      <span className="material-symbols-outlined text-[16px]">dashboard</span>
                      Đổi môn
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1 custom-scrollbar">
                {filteredTeacherEntries.length > 0 ? (
                  filteredTeacherEntries.map((entry) => (
                    <TeacherCard
                      key={entry.key}
                      active={entry.key === activeTeacherEntry?.key}
                      index={entry.index}
                      onSelect={() => handleSelectTeacher(activeSubject, entry.teacher, entry.index)}
                      subject={activeSubject}
                      teacher={entry.teacher}
                    />
                  ))
                ) : (
                  <div className="grid min-h-[260px] place-items-center rounded-lg border border-dashed border-white/15 bg-white/[0.03] px-5 py-8 text-center">
                    <div>
                      <span className="material-symbols-outlined text-3xl text-slate-500">manage_search</span>
                      <p className="mt-2 text-sm font-bold text-slate-400">Không tìm thấy sheet phù hợp.</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </section>
      </main>
    </div>
  );
}
