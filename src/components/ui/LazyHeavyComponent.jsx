import React, { useEffect, useRef, useState } from 'react';

/**
 * LazyHeavyComponent — Defer rendering heavy components until visible
 *
 * TASK 3 — Giảm TBT (Total Blocking Time):
 * KaTeX, react-pdf, các bảng dữ liệu lớn đều tốn Main Thread khi
 * parse + layout. Nếu user chưa scroll đến → KHÔNG CẦN render ngay.
 *
 * Cách dùng:
 * ```jsx
 * // Thay vì render thẳng:
 * <KaTeXRenderer content={latexString} />
 *
 * // Bọc vào LazyHeavyComponent:
 * <LazyHeavyComponent
 *   placeholder={<div className="h-24 animate-pulse bg-slate-800 rounded-xl" />}
 *   rootMargin="400px"  // bắt đầu render khi cách viewport 400px
 * >
 *   <KaTeXRenderer content={latexString} />
 * </LazyHeavyComponent>
 * ```
 *
 * @param {React.ReactNode} children    — Component nặng cần defer
 * @param {React.ReactNode} placeholder — UI hiển thị khi chưa visible (default: skeleton)
 * @param {string} rootMargin           — IntersectionObserver root margin (default: "400px")
 * @param {string} className            — className cho wrapper div
 * @param {boolean} keepMounted         — Nếu true: sau khi visible, KHÔNG bao giờ unmount (mặc định true)
 */
export default function LazyHeavyComponent({
  children,
  placeholder,
  rootMargin = '400px',
  className = '',
  keepMounted = true,
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    // Fallback: nếu browser không hỗ trợ IntersectionObserver → render ngay
    if (typeof IntersectionObserver !== 'function') {
      setIsVisible(true);
      setHasBeenVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true);
            setHasBeenVisible(true);
            // Sau khi thấy lần đầu: disconnect để không track nữa
            // (keepMounted=true → component sẽ không re-unmount)
            observer.disconnect();
          }
        }
      },
      {
        rootMargin,
        threshold: 0, // Bắt đầu ngay khi 1 pixel vào viewport
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [rootMargin]);

  // Decide whether to render the heavy content
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
      className="w-full h-32 rounded-xl bg-slate-800/60 animate-pulse"
      aria-hidden="true"
    />
  );
}

/**
 * LazyMath — Preset cho KaTeX / MathJax rendering
 * rootMargin lớn hơn (600px) vì KaTeX render tốn CPU nhiều
 */
export function LazyMath({ children, className = '' }) {
  return (
    <LazyHeavyComponent
      rootMargin="600px"
      className={className}
      placeholder={
        <span className="inline-block w-32 h-5 rounded bg-slate-800/60 animate-pulse align-middle" />
      }
    >
      {children}
    </LazyHeavyComponent>
  );
}

/**
 * LazyPdfSection — Preset cho các section hiển thị PDF
 * rootMargin nhỏ hơn (200px) vì PDF đã có IntersectionObserver trong
 * SecurePdfViewer — đây chỉ dùng khi cần defer mount toàn bộ Document
 */
export function LazyPdfSection({ children, className = '' }) {
  return (
    <LazyHeavyComponent
      rootMargin="200px"
      className={className}
      placeholder={
        <div className="w-full rounded-2xl bg-slate-900/80 animate-pulse flex items-center justify-center gap-3 text-slate-500 py-16">
          <span className="material-symbols-outlined text-3xl">picture_as_pdf</span>
          <span className="text-sm font-medium">Đang chuẩn bị đề thi...</span>
        </div>
      }
    >
      {children}
    </LazyHeavyComponent>
  );
}
