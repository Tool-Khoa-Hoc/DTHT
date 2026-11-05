import React from 'react';
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
  subjectLabel,
  teacherTitle,
  flashExp,
  onConfirmContinue,
  onEndSession,
  onResume,
  onEnd,
}) {
  const seconds = sessionSeconds ?? elapsedSec ?? 0;
  const handleResume = onConfirmContinue || onResume;
  const handleEnd = onEndSession || onEnd;

  if (status === 'idle' && !flashExp && !fallback) return null;

  const isRunning = status === 'running' || status === 'active';
  const needsConfirm = status === 'paused_idle' || status === 'needs-confirm';
  const isFallback = status === 'fallback' || Boolean(fallback);

  const statusMeta = needsConfirm
    ? {
        dot: 'bg-accent',
        text: 'Tạm dừng — bấm “Tiếp tục học” để cộng tiếp EXP',
        tone: 'border-gold bg-gold-soft/75 text-gold-dark',
      }
    : isFallback
      ? {
          dot: 'bg-sky-600',
          text: 'Chế độ dự phòng · vẫn ghi nhận thời gian học',
          tone: 'border-sky-300 bg-sky-50 text-sky-900',
        }
      : {
          dot: 'bg-jade animate-pulse',
          text: 'Đang tích EXP trực tiếp',
          tone: 'border-jade-border bg-jade-soft text-foreground',
        };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`paper-card sticky top-2 z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-3 border ${statusMeta.tone}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={`h-2.5 w-2.5 no-shrink rounded-full ${statusMeta.dot}`} aria-hidden="true" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-bold text-foreground">
            <span>{statusMeta.text}</span>
            {subjectLabel && (
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
                ? `· Thăng cấp Lv.${flashExp.level}!`
                : ''}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 no-shrink">
        <div
          className="paper-chip tabular text-sm font-bold text-foreground bg-surface border-border-strong"
          aria-label="Thời gian phiên học"
        >
          <span className="material-symbols-outlined text-base text-jade" aria-hidden="true">
            schedule
          </span>
          {formatElapsed(seconds)}
        </div>

        {needsConfirm && handleResume && (
          <Button variant="gold" size="sm" icon="play_circle" onClick={handleResume}>
            Tiếp tục học
          </Button>
        )}

        {(isRunning || needsConfirm || isFallback) && handleEnd && (
          <Button variant="ghost" size="sm" icon="check_circle" onClick={handleEnd}>
            Kết thúc phiên
          </Button>
        )}
      </div>
    </div>
  );
}
