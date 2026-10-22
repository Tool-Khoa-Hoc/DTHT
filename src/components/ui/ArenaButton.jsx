import React from 'react';

/**
 * ArenaButton — nút chuẩn của design system "Arena Bento" (xem design-system/MASTER.md).
 * Kiểu dáng nằm ở class `.btn-arena` + biến thể trong src/index.css.
 * - variant: 'primary' (ember, CTA chính) | 'jade' | 'gold' | 'ghost'
 * - size: 'sm' (vẫn ≥44px) | 'md' (48px) | 'lg' (52px)
 * - Có `href` thì render <a>, không thì <button>. Soft-press + focus ring sẵn trong CSS.
 */
const VARIANTS = {
  primary: 'btn-arena-primary',
  jade: 'btn-arena-jade',
  gold: 'btn-arena-gold',
  ghost: 'btn-arena-ghost',
};

const SIZES = {
  sm: 'btn-arena-sm',
  md: '',
  lg: 'btn-arena-lg',
};

export default function ArenaButton({
  variant = 'primary',
  size = 'md',
  href,
  className = '',
  children,
  disabled = false,
  type,
  ...props
}) {
  const classes = ['btn-arena', VARIANTS[variant] ?? VARIANTS.primary, SIZES[size] ?? '', className]
    .filter(Boolean)
    .join(' ');

  if (href) {
    return (
      <a
        href={href}
        className={classes}
        aria-disabled={disabled || undefined}
        {...props}
      >
        {children}
      </a>
    );
  }

  return (
    <button type={type ?? 'button'} className={classes} disabled={disabled} {...props}>
      {children}
    </button>
  );
}
