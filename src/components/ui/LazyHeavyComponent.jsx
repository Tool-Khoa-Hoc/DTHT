import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

export default function LazyHeavyComponent({
  children,
  placeholder,
  rootMargin = '400px',
  className = '',
  keepMounted = true,
}) {
  const shouldRenderImmediately = typeof IntersectionObserver !== 'function';
  const [isVisible, setIsVisible] = useState(shouldRenderImmediately);
  const [hasBeenVisible, setHasBeenVisible] = useState(shouldRenderImmediately);
  const containerRef = useRef(null);

  useEffect(() => {
    if (shouldRenderImmediately) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true);
            setHasBeenVisible(true);
            observer.disconnect();
          }
        }
      },
      {
        rootMargin,
        threshold: 0,
      },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [rootMargin, shouldRenderImmediately]);

  const shouldRender = keepMounted ? hasBeenVisible : isVisible;

  return (
    <div ref={containerRef} className={className}>
      {shouldRender ? children : (placeholder ?? <DefaultPlaceholder />)}
    </div>
  );
}

function DefaultPlaceholder() {
  return (
    <div
      className="w-full h-32 rounded-xl bg-surface-alt border border-border animate-pulse"
      aria-hidden="true"
    />
  );
}

export function LazyMath({ children, className = '' }) {
  return (
    <LazyHeavyComponent
      rootMargin="600px"
      className={className}
      placeholder={
        <span className="inline-block w-32 h-5 rounded bg-surface-alt animate-pulse align-middle" />
      }
    >
      {children}
    </LazyHeavyComponent>
  );
}

export function LazyPdfSection({ children, className = '' }) {
  const { pick } = useLanguage();
  return (
    <LazyHeavyComponent
      rootMargin="200px"
      className={className}
      placeholder={
        <div className="w-full aspect-3/4 max-h-96 rounded-xl bg-surface-alt border border-border animate-pulse flex items-center justify-center text-secondary-text text-sm">
          {pick('Đang tải tài liệu...', 'Loading document...')}
        </div>
      }
    >
      {children}
    </LazyHeavyComponent>
  );
}
