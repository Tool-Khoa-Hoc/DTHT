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
      ? 'Đã tạm dừng sau 20 phút ở tab ngoài — bấm “Tiếp tục học” để tính giờ tiếp'
      : idleReason === 'checkin-expired'
        ? 'Tạm dừng do quá hạn điểm danh 25 phút — bấm “Tiếp tục học” để mở lại'
        : 'Tạm dừng do không thao tác — bấm “Tiếp tục học” để cộng tiếp phút học & EXP';

  const statusMeta = checkinPrompt
    ? {
        dot: 'bg-primary animate-ping',
        text: `Điểm danh Pomodoro (+10 EXP): Chọn đúng biểu tượng ${checkinPrompt.targetSymbol} (${checkinPrompt.targetLabel})`,
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
            text: 'Chờ bắt đầu — cuộn bảng bài giảng hoặc bấm “Bắt đầu tính giờ”',
            tone: 'border-border-strong bg-surface text-foreground',
          }
        : isFallback
          ? {
              dot: 'bg-sky-600',
              text: 'Chế độ dự phòng · đang ghi nhận số phút học thực tế',
              tone: 'border-sky-300 bg-sky-50 text-sky-900',
            }
          : {
              dot: 'bg-jade animate-pulse',
              text: 'Đang ghi nhận phút học & EXP (chống treo máy)',
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
                ? `· Thăng cấp Lv.${flashExp.level}!`
                : flashExp.type === 'checkin'
                  ? '· Thưởng Điểm Danh Tập Trung!'
                  : ''}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 no-shrink">
        {checkinPrompt && Array.isArray(checkinPrompt.options) && (
          <div className="flex items-center gap-1.5 bg-paper px-2.5 py-1 rounded-xl border border-border-strong">
            <span className="text-[11px] font-bold text-primary tabular mr-1">
              {formatElapsed(checkinRemainingSec)}
            </span>
            {checkinPrompt.options.map((opt) => (
              <button
                key={opt.symbol}
                type="button"
                onClick={() => onSubmitCheckin?.(opt.symbol)}
                title={`Chọn ${opt.label}`}
                aria-label={`Chọn biểu tượng ${opt.label}`}
                className="px-2.5 py-1 rounded-lg bg-surface hover:bg-primary-soft border border-border hover:border-primary text-sm font-bold transition-all cursor-pointer"
              >
                {opt.symbol}
              </button>
            ))}
          </div>
        )}

        {todayMinutes > 0 && (
          <div
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-gold-soft text-gold-dark border border-gold tabular"
            title="Tổng số phút học của bạn trong ngày hôm nay"
          >
            <span className="material-symbols-outlined text-sm text-accent" aria-hidden="true">
              local_fire_department
            </span>
            <span>Hôm nay: {todayMinutes}p</span>
          </div>
        )}

        <div
          className="paper-chip tabular text-sm font-bold text-foreground bg-surface border-border-strong"
          aria-label="Thời gian phiên học"
        >
          <span className="material-symbols-outlined text-base text-jade" aria-hidden="true">
            schedule
          </span>
          {formatElapsed(seconds)}
        </div>

        {isReady && handleStart && (
          <Button variant="primary" size="sm" icon="play_arrow" onClick={handleStart}>
            Bắt đầu tính giờ
          </Button>
        )}

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
