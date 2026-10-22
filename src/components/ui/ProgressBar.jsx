import React from 'react';

/**
 * ProgressBar — thanh tiến độ Arena Bento.
 * Luôn kèm nhãn + số % dạng chữ (không truyền thông tin bằng màu đơn độc),
 * số dùng class `.tabular` để không nhảy layout. Fill animate width 300ms
 * (class `.arena-progress-fill`, tự tắt theo prefers-reduced-motion).
 *
 * Props:
 * - value: 0..100 (tự clamp)
 * - label: nhãn phía trên (vd "Công lực")
 * - valueLabel: text số bên phải (mặc định suy ra `${value}%`)
 * - gradientClassName: class gradient Tailwind cho fill (vd levelAccent.bar)
 * - barHeight: class chiều cao track (mặc định 'h-2.5')
 */
export default function ProgressBar({
  value = 0,
  label,
  valueLabel,
  gradientClassName = 'from-jade-400 to-jade-500',
  barHeight = 'h-2.5',
  className = '',
}) {
  const pct = Math.min(100, Math.max(0, Math.round(Number(value) || 0)));

  return (
    <div className={className}>
      {(label || valueLabel) && (
        <div className="flex items-center justify-between gap-2">
          {label ? (
            <span className="font-arena text-[11px] font-bold uppercase tracking-[0.16em] text-gold-300/85">
              {label}
            </span>
          ) : (
            <span />
          )}
          <span className="tabular text-[11px] font-black text-slate-300">
            {valueLabel ?? `${pct.toLocaleString('vi-VN')}%`}
          </span>
        </div>
      )}
      <div
        className={`arena-progress ${barHeight} ${label || valueLabel ? 'mt-1.5' : ''}`}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Tiến độ'}
      >
        <div
          className={`arena-progress-fill bg-gradient-to-r ${gradientClassName}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
