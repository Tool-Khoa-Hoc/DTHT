import React from 'react';

const ASPECT_CLASS_MAP = {
  '16/9': 'aspect-video',
  '4/3': 'aspect-4/3',
  '1/1': 'aspect-square',
};

export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  aspectRatio,
  priority = false,
  className = '',
  ...rest
}) {
  if (import.meta.env.DEV) {
    if (!width) {
      console.warn('[OptimizedImage] Missing `width` prop. This WILL cause CLS!\n  src:', src);
    }
    if (!height && !aspectRatio) {
      console.warn('[OptimizedImage] Missing `height` or `aspectRatio` prop. CLS may occur.\n  src:', src);
    }
    if (!alt) {
      console.warn('[OptimizedImage] Missing `alt` prop. Accessibility issue.\n  src:', src);
    }
  }

  const aspectClass = aspectRatio && !height ? ASPECT_CLASS_MAP[aspectRatio] || 'aspect-video' : '';

  return (
    <img
      src={src}
      alt={alt ?? ''}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : 'auto'}
      className={`${aspectClass} ${className}`.trim()}
      {...rest}
    />
  );
}
