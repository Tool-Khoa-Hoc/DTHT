import React from 'react';

/**
 * SectionHeading — Tiêu đề khu vực phong cách Trung Hoa Sáng / Mặc Dạ Tối
 * Có eyebrow, tiêu đề Baloo 2, gạch chân nét cọ (brush-underline) và chữ Hán decor mờ (aria-hidden).
 */
export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  hanzi,
  icon,
  action,
  className = '',
}) {
  return (
    <div className={`relative flex flex-col sm:flex-row sm:items-end justify-between gap-3 ${className}`.trim()}>
      <div className="relative min-w-0">
        {hanzi ? (
          <span
            aria-hidden="true"
            className="hanzi-watermark absolute -top-3 -left-2 text-5xl font-bold text-accent/10 select-none pointer-events-none"
          >
            {hanzi}
          </span>
        ) : null}
        {eyebrow ? (
          <p className="relative z-10 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-primary mb-1">
            {icon ? (
              <span className="material-symbols-outlined text-sm leading-none shrink-0" aria-hidden="true">
                {icon}
              </span>
            ) : (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
            )}
            <span>{eyebrow}</span>
          </p>
        ) : null}
        <h2 className="relative z-10 font-display text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
          <span className="brush-underline">{title}</span>
        </h2>
        {subtitle ? (
          <p className="relative z-10 mt-2 text-xs sm:text-sm text-secondary-text leading-relaxed max-w-2xl">
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className="relative z-10 shrink-0">{action}</div> : null}
    </div>
  );
}
