import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import Button from './Button';

function formatElapsed(sec = 0) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export default function SessionBar({
  status = 'idle',
  fallback = false,
  sessionSeconds,
  elapsedSec = 0,
  todayMinutes = 0,
  idleReason = 'none',
  checkinPrompt = null,
  checkinRemainingSec = 0,
  subjectLabel,
  teacherTitle,
  flashExp,
  onStartSession,
  onConfirmContinue,
  onSubmitCheckin,
  onEndSession,
  onResume,
  onEnd,
}) {
  const { t, isEn } = useLanguage();
  const seconds = sessionSeconds ?? elapsedSec ?? 0;
  const handleResume = onConfirmContinue || onResume || onStartSession;
  const handleStart = onStartSession || onConfirmContinue || onResume;
  const handleEnd = onEndSession || onEnd;

  if (status === 'idle' && !flashExp && !fallback && !checkinPrompt) return null;

  const isReady = status === 'ready';
  const isRunning = status === 'running' || status === 'active';
  const needsConfirm = status === 'paused_idle' || status === 'needs-confirm';
  const isFallback = status === 'fallback' || Boolean(fallback);

  const pauseMessage =
    idleReason === 'hidden-timeout'
      ? t('session.pausedHidden')
      : idleReason === 'checkin-expired'
        ? t('session.pausedCheckin')
        : t('session.pausedIdle');

  const checkinTargetLabel = checkinPrompt
    ? isEn
      ? checkinPrompt.targetLabelEn || checkinPrompt.targetLabel
      : checkinPrompt.targetLabel
    : '';

  const statusMeta = checkinPrompt
    ? {
        dot: 'bg-primary animate-ping',
        text: t('session.checkinPrompt', { label: checkinTargetLabel }),
        tone: 'border-primary bg-primary-soft/85 text-foreground',
      }
    : needsConfirm
      ? {
          dot: 'bg-accent',
          text: pauseMessage,
          tone: 'border-gold bg-gold-soft/75 text-gold-dark',
        }
      : isReady
        ? {
            dot: 'bg-secondary-text',
            text: t('session.ready'),
            tone: 'border-border-strong bg-surface text-foreground',
          }
        : isFallback
          ? {
              dot: 'bg-jade',
              text: t('session.fallback'),
              tone: 'border-jade-border bg-surface-alt text-foreground',
            }
          : {
              dot: 'bg-jade animate-pulse',
              text: t('session.active'),
              tone: 'border-jade-border bg-jade-soft text-foreground',
            };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`paper-card sticky top-2 z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-3 border ${statusMeta.tone}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusMeta.dot}`} aria-hidden="true" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-bold text-foreground">
            <span>{statusMeta.text}</span>
            {checkinPrompt?.targetIcon && (
              <span className="inline-flex items-center gap-1 rounded-md border border-primary/35 bg-surface px-1.5 py-0.5 text-primary">
                <span className="material-symbols-outlined text-sm leading-none" aria-hidden="true">
                  {checkinPrompt.targetIcon}
                </span>
              </span>
            )}
            {subjectLabel && !checkinPrompt && (
              <span className="text-secondary-text font-medium truncate">
                · {subjectLabel}
                {teacherTitle ? ` — ${teacherTitle}` : ''}
              </span>
            )}
          </div>
          {flashExp ? (
            <p className="text-xs font-extrabold text-jade tabular mt-0.5">
              +{flashExp.amount ?? flashExp.gained} EXP{' '}
              {flashExp.type === 'levelup' || flashExp.leveledUp
                ? t('session.levelUp', { level: flashExp.level })
                : flashExp.type === 'checkin'
                  ? t('session.checkinBonus')
                  : ''}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {checkinPrompt && Array.isArray(checkinPrompt.options) && (
          <div className="flex items-center gap-1.5 bg-paper px-2.5 py-1 rounded-xl border border-border-strong">
            <span className="text-[11px] font-bold text-primary tabular mr-1">
              {formatElapsed(checkinRemainingSec)}
            </span>
            {checkinPrompt.options.map((opt) => {
              const optLabel = isEn ? opt.labelEn || opt.label : opt.label;
              const optAria = t('session.chooseSymbol', { label: optLabel });
              return (
                <button
                  key={opt.symbol}
                  type="button"
                  onClick={() => onSubmitCheckin?.(opt.symbol)}
                  title={optAria}
                  aria-label={optAria}
                  className="inline-flex h-8 w-9 items-center justify-center rounded-lg bg-surface hover:bg-primary-soft border border-border hover:border-primary text-foreground hover:text-primary transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base leading-none" aria-hidden="true">
                    {opt.icon || opt.symbol}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {todayMinutes > 0 && (
          <div
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-gold-soft text-gold-dark border border-gold tabular"
            title={t('session.todayTitle')}
          >
            <span className="material-symbols-outlined text-sm text-accent shrink-0" aria-hidden="true">
              local_fire_department
            </span>
            <span>{t('session.todayBadge', { minutes: todayMinutes })}</span>
          </div>
        )}

        <div
          className="paper-chip tabular text-sm font-bold text-foreground bg-surface border-border-strong"
          aria-label={t('session.timerAria')}
        >
          <span className="material-symbols-outlined text-base text-jade shrink-0" aria-hidden="true">
            schedule
          </span>
          {formatElapsed(seconds)}
        </div>

        {isReady && handleStart && (
          <Button variant="primary" size="sm" icon="play_arrow" onClick={handleStart}>
            {t('session.startBtn')}
          </Button>
        )}

        {needsConfirm && handleResume && (
          <Button variant="gold" size="sm" icon="play_circle" onClick={handleResume}>
            {t('session.resumeBtn')}
          </Button>
        )}

        {(isRunning || needsConfirm || isFallback) && handleEnd && (
          <Button variant="ghost" size="sm" icon="check_circle" onClick={handleEnd}>
            {t('session.endBtn')}
          </Button>
        )}
      </div>
    </div>
  );
}
