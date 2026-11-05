import React from 'react';

const VARIANT_CLASS = {
  primary: 'btn-arena-primary',
  secondary: 'btn-arena-secondary',
  ghost: 'btn-arena-ghost',
  gold: 'btn-arena-gold',
  jade: 'btn-arena-jade',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  as = 'button',
  icon,
  trailingIcon,
  className = '',
  children,
  ...rest
}) {
  const Tag = as;
  const v = VARIANT_CLASS[variant] || VARIANT_CLASS.primary;
  const s = size === 'sm' ? 'btn-arena-sm' : '';
  const extraProps = as === 'button' && !rest.type ? { type: 'button' } : {};

  return (
    <Tag className={`btn-arena ${v} ${s} ${className}`.trim()} {...extraProps} {...rest}>
      {icon ? (
        <span className="material-symbols-outlined text-lg leading-none" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
      {trailingIcon ? (
        <span className="material-symbols-outlined text-lg leading-none" aria-hidden="true">
          {trailingIcon}
        </span>
      ) : null}
    </Tag>
  );
}
