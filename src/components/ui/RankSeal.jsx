import React from 'react';

/**
 * RankSeal — Ấn triện đỏ / vàng kim cho cấp bậc & quân hàm (Trung Hoa Sáng / Mặc Dạ Tối)
 */
export default function RankSeal({
  label,
  sublabel,
  icon = 'military_tech',
  variant = 'solid',
  size = 'md',
  className = '',
}) {
  const sizeClass =
    size === 'sm'
      ? 'px-2.5 py-1 text-xs gap-1.5'
      : size === 'lg'
        ? 'px-3.5 py-2 text-sm gap-2'
        : 'px-3 py-1.5 text-xs gap-1.5';

  const variantClass =
    variant === 'outline'
      ? 'seal-stamp-outline'
      : variant === 'gold'
        ? 'inline-flex items-center justify-center rounded-xl bg-gold-soft text-gold-dark border border-gold font-display font-extrabold shadow-xs'
        : 'seal-stamp';

  return (
    <span className={`max-w-full flex-wrap leading-tight ${variantClass} ${sizeClass} ${className}`.trim()}>
      {icon ? (
        <span className="material-symbols-outlined text-base leading-none icon-fill shrink-0" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="tracking-[0.04em] uppercase">{label}</span>
      {sublabel ? (
        <span className="opacity-85 font-semibold normal-case tabular">· {sublabel}</span>
      ) : null}
    </span>
  );
}
