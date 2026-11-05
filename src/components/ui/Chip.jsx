import React from 'react';

const VARIANT_CLASSES = {
  default: 'bg-surface-alt text-secondary-text border-border',
  primary: 'bg-primary-soft text-primary border-primary/35',
  gold: 'bg-gold-soft text-gold-dark border-gold/50',
  jade: 'bg-jade-soft text-jade border-jade/35',
  completed: 'bg-completed-soft text-completed border-completed-border',
};

/**
 * Chip / Badge — luôn có icon hoặc chấm trạng thái kèm chữ để không phụ thuộc đơn thuần vào màu sắc.
 */
export default function Chip({
  variant = 'default',
  icon,
  dot = false,
  active = false,
  as = 'span',
  className = '',
  children,
  ...rest
}) {
  const Tag = as;
  const tone = active ? VARIANT_CLASSES.primary : VARIANT_CLASSES[variant] || VARIANT_CLASSES.default;

  return (
    <Tag
      className={`paper-chip border ${tone} ${className}`.trim()}
      data-active={active ? 'true' : undefined}
      {...rest}
    >
      {icon ? (
        <span className="material-symbols-outlined text-sm leading-none" aria-hidden="true">
          {icon}
        </span>
      ) : dot ? (
        <span className="w-1.5 h-1.5 rounded-full bg-current no-shrink" aria-hidden="true" />
      ) : null}
      <span>{children}</span>
    </Tag>
  );
}
