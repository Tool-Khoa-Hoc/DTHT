import React from 'react';

/**
 * OptimizedImage — Image component chống CLS theo chuẩn Web.dev
 *
 * TASK 5 — Tránh CLS (Cumulative Layout Shift):
 * Vấn đề: Khi browser load ảnh, nếu không biết aspect-ratio trước,
 * nó sẽ allocate 0x0 → khi ảnh tải xong expand → shift toàn bộ layout.
 *
 * Giải pháp:
 * 1. Bắt buộc truyền `width` + `height` (hoặc `aspectRatio`) → browser
 *    tính layout space trước khi ảnh load xong (CSS intrinsic sizing).
 * 2. `loading="lazy"` → browser chỉ fetch ảnh khi gần viewport
 * 3. `decoding="async"` → decode ảnh trong background thread, không block Main Thread
 * 4. `fetchpriority` → điều chỉnh ưu tiên fetch (LCP image = "high")
 *
 * Cách dùng:
 * ```jsx
 * // Ảnh thông thường (lazy load)
 * <OptimizedImage src="/avatar.png" alt="Avatar" width={64} height={64} />
 *
 * // Ảnh LCP (above-the-fold, load ngay)
 * <OptimizedImage src="/hero.jpg" alt="Hero" width={1200} height={630} priority />
 *
 * // Ảnh với aspect-ratio (khi không biết chiều cao chính xác)
 * <OptimizedImage src="/card.jpg" alt="Card" width={400} aspectRatio="16/9" className="w-full rounded-xl" />
 * ```
 *
 * @param {string}  src         — Đường dẫn ảnh (bắt buộc)
 * @param {string}  alt         — Alt text (bắt buộc cho accessibility)
 * @param {number}  width       — Chiều rộng native của ảnh (bắt buộc để tránh CLS)
 * @param {number}  height      — Chiều cao native (bắt buộc nếu không dùng aspectRatio)
 * @param {string}  aspectRatio — CSS aspect-ratio thay thế height, vd: "16/9", "4/3", "1/1"
 * @param {boolean} priority    — LCP image: tắt lazy load, bật fetchpriority="high"
 * @param {string}  className   — CSS classes
 * @param {object}  rest        — Props truyền thêm cho <img>
 */
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
  // Validate: bắt buộc có width, và ít nhất một trong height hoặc aspectRatio
  if (process.env.NODE_ENV === 'development') {
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

  return (
    <img
      src={src}
      alt={alt ?? ''}
      width={width}
      height={height}
      // TASK 5: Tránh CLS — browser biết kích thước trước khi ảnh load
      style={aspectRatio && !height ? { aspectRatio } : undefined}
      // TASK 5: lazy load mặc định — chỉ tắt khi ảnh là LCP (priority=true)
      loading={priority ? 'eager' : 'lazy'}
      // TASK 5: decode async → không block Main Thread
      decoding={priority ? 'sync' : 'async'}
      // TASK 5: fetchpriority — LCP image cần fetch trước
      fetchPriority={priority ? 'high' : 'auto'}
      className={className}
      {...rest}
    />
  );
}
