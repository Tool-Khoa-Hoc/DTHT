import React from 'react';

export default function Card({
  as = 'div',
  variant = 'default',
  interactive = false,
  className = '',
  children,
  ...rest
}) {
  const Tag = as;
  const baseClass = variant === 'imperial' ? 'imperial-frame' : 'paper-card';
  const hoverClass = interactive ? 'paper-card-interactive' : '';

  return (
    <Tag className={`${baseClass} ${hoverClass} ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}
