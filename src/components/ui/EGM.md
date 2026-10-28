# UI Primitives (`src/components/ui`)

## Overview

The presentational layer of the "Arena Bento" design system. These components
carry no business logic and no direct Supabase access: they take data and
callbacks from pages, render accessible markup, and lean on the `btn-arena` /
`arena-card` utility classes defined in `src/index.css`. They are also the
project's web-vitals toolkit — skeletons and fixed aspect ratios prevent CLS,
`LazyHeavyComponent` and `OptimizedImage` cut Total Blocking Time and LCP
payload.

## Interface

- `ArenaButton({ variant = 'primary' | 'jade' | 'gold' | 'ghost', size = 'sm' | 'md' | 'lg', href, className, children, disabled, type, ...props })` —
  default export. Renders `<a>` when `href` is set, otherwise `<button>`.
- `ProgressBar({ value, label, valueLabel, gradientClassName, barHeight, className })` —
  default export. Clamps `value` to 0–100, renders a text percentage beside the
  fill so meaning never depends on colour alone.
- `OptimizedImage({ src, alt, width, height, aspectRatio, priority, className, ...rest })` —
  default export. Requires `width` plus either `height` or `aspectRatio`
  (dev-mode warning otherwise); `priority` disables lazy loading and sets
  `fetchpriority="high"`.
- `Skeleton({ className, aspectRatio })` — default export, plus named exports
  `PageSkeleton()` and `CardSkeleton({ className })`.
- `LazyHeavyComponent({ children, placeholder, rootMargin = '400px', className, keepMounted = true })` —
  default export. Defers children until an `IntersectionObserver` reports
  visibility. Named exports `LazyMath({ children, className })` and
  `LazyPdfSection({ children, className })`.
- `SubjectCard({ subject, active, onSelect, compact })` — default export.
  Inline-SVG icon lookup keyed by the icon names used in
  `src/config/onlineLearning.js`; the whole card is one ≥ 44 px button with
  `aria-pressed`.
- `TeacherCard({ teacher, subject, index, active, onSelect })` — default export.
  Splits `teacher.title` on `' - '` into main title and detail; single primary
  CTA ("Vào học" / "Đang xem").
- `SessionBar({ status = 'idle' | 'active' | 'needs-confirm' | 'ending', fallback, sessionSeconds, teacherTitle, subjectLabel, onEndSession, onConfirmContinue, className })` —
  default export. `role="status"` live region describing study-session state.
- `ToastProvider({ children })` — named export. Supplies toast context; caps the
  live stack at 4 and auto-dismisses after `TOAST_TIMEOUT = 4200` ms unless
  `duration === 0`.
- `ToastContext` — `createContext(null)` named export from `toastContext.js`.
- `useToast()` — named export. Throws `'useToast must be used within ToastProvider'`
  when called outside the provider.

## Invariants

- `useToast()` must only be called under `ToastProvider`; the provider is mounted
  in `src/App.jsx` above the router outlet.
- `ToastProvider` assigns monotonically increasing ids from a module-level
  counter and slices to keep the newest toasts; `showToast()` returns the id.
- `OptimizedImage` must receive `width` and one of `height`/`aspectRatio`; this
  is the CLS guard and is enforced as a dev-time warning, not a hard throw.
- `ProgressBar` never trusts its input: non-numeric or out-of-range values are
  coerced and clamped, so the rendered bar cannot exceed its track.
- `ArenaButton` maps unknown `variant`/`size` values back to the primary/md
  defaults; it stays a native anchor/button so keyboard and screen-reader
  behaviour is inherited, not re-implemented.
- `LazyHeavyComponent` renders immediately when `IntersectionObserver` is
  unavailable (SSR/no-support fallback) and, with `keepMounted = true`, never
  unmounts after first visibility.
- Cards never rely on colour alone to signal selection — `SubjectCard` uses
  `aria-pressed` and `TeacherCard` renders a "Đang xem" chip.
- All components are pure presentational: they must not fetch, persist, or read
  auth state.

## Side Effects

- `ToastProvider` schedules `window.setTimeout` auto-dismiss timers per toast and
  mutates the `nextToastId` module counter.
- `LazyHeavyComponent` creates and disconnects an `IntersectionObserver` on a
  container ref.
- No network, storage, or Supabase access from this directory.

## Verification

- Run: `npm run lint && npm run build`
