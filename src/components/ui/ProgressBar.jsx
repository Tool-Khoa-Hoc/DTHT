import React from 'react';

const TONE_FILL = {
  jade: 'bg-gradient-to-r from-jade to-completed',
  ember: 'bg-gradient-to-r from-primary to-gold',
  primary: 'bg-gradient-to-r from-primary to-gold',
  gold: 'bg-gradient-to-r from-accent to-gold',
  completed: 'bg-completed',
};

/**
 * ProgressBar — Thành phần duy nhất trong toàn bộ ứng dụng cập nhật độ rộng thanh tiến độ động
 * cho EXP, GPA, điểm xét tuyển và hoàn thành lộ trình.
 */
export default function ProgressBar({
  value = 0,
  max = 100,
  label,
  sublabel,
  tone = 'jade',
  showPercent = true,
  size = 'md',
  className = '',
}) {
  const safeMax = max > 0 ? max : 100;
  const pct = Math.max(0, Math.min(100, Math.round((Number(value) / safeMax) * 100)));
  const fillClass = TONE_FILL[tone] || TONE_FILL.jade;
  const trackHeight = size === 'sm' ? 'h-2' : size === 'lg' ? 'h-3.5' : 'h-2.5';

  return (
    <div className={className}>
      {(label || sublabel || showPercent) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
          {label ? (
            <span className="font-semibold text-foreground truncate">{label}</span>
          ) : (
            <span />
          )}
          <span className="tabular font-bold text-secondary-text no-shrink">
            {sublabel ? <span className="mr-1.5 text-muted-foreground font-medium">{sublabel}</span> : null}
            {showPercent ? `${pct}%` : null}
          </span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Tiến độ'}
        className={`${trackHeight} w-full overflow-hidden rounded-full bg-surface-alt border border-border`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ease-out ${fillClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
