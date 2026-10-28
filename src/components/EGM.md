# Application Components (`src/components`)

## Overview

The shell and cross-page widgets of the app: the authenticated layout that wraps
every route, the error boundary, the avatar primitive, and the first-visit
welcome modal. Two subdirectories hold the reusable UI kit and the admin panels;
this level only contains components that are coupled to routing or to global
app concerns.

## Interface

- `RootLayout()` — default export. Route shell rendering the desktop sidebar,
  mobile header/bottom tabs, `WelcomeModal`, and `<Outlet />`. Reads `user`,
  `profile`, `loading` from `useAuth()`. Local `BOTTOM_TABS` list:
  `/home`, `/gpa`, `/arena`, `/profile`.
- `ErrorBoundary` — default export class component
  (`getDerivedStateFromError`, `componentDidCatch`). Renders a fallback UI with
  a reload action when an unhandled rendering error occurs.
- `Avatar({ src, name, id, size = 'w-12 h-12', rounded = 'rounded-xl', className })` —
  default export. Renders the image, or a deterministic colour + initial when
  the image is missing or fails to load.
- `WelcomeModal()` — default export. First-run announcement dialog; mounted
  lazily by `RootLayout` only when needed.
- Child contracts:
  - [Admin panels](./admin/EGM.md) — `AdminLibrary`, `AdminCollaborator`,
    `AdminThongSoai` (`isActive`-gated tabs for `/admin`).
  - [UI primitives](./ui/EGM.md) — `ArenaButton`, `ProgressBar`, `Skeleton`,
    `OptimizedImage`, `LazyHeavyComponent`, `SubjectCard`, `TeacherCard`,
    `SessionBar`, `ToastProvider`/`useToast`.

## Invariants

- `RootLayout` is the authorisation boundary for the whole app. While
  `loading && !user` it renders `PageSkeleton`; once loading settles it allows
  **`/home` without a session** and redirects every other path to `/auth` with
  `<Navigate replace>`. Pages may therefore assume a user everywhere except
  `/home`.
- `RootLayout` must render a single `<Outlet />`; nested routes in `App.jsx`
  rely on it.
- `WelcomeModal` is code-split and only requested after an idle callback
  (`shouldLoadWelcomeModal`), so it must never be imported eagerly here.
- `Avatar` colour choice is a pure hash of `id`/`name`, so the same user keeps
  the same colour across renders and sessions; it must not use `Math.random`.
- `ErrorBoundary` catches unexpected UI rendering errors and logs them to the console
  while offering users an in-place retry action via `window.location.reload()`.
- `RootLayout` treats `admin`, `collaborator`, and `editor` as titled roles and
  falls back to the label `Học viên` for everyone else.
- Navigation is data-driven: route module keys passed to `preloadRouteModule`
  must exist in `src/lib/routeModules.js`; unknown keys are a silent no-op
  today but break prefetch.

## Side Effects

- `RootLayout`: route prefetch on hover/focus and after mount
  (`preloadRouteModule('Home')`), `requestAnimationFrame`/`requestIdleCallback`
  scheduling, `mainRef.scrollTo` on pathname change, and a lazy `import()` of
  `WelcomeModal`.
- `WelcomeModal`: reads/writes `localStorage` key `hasSeenWelcomeNotice_v1`,
  locks `document.body.style.overflow` while open, moves focus into the dialog,
  traps `Tab`, closes on `Escape`, and restores the previously focused element.
- `Avatar`: attaches `onError` to the `<img>` to switch to the initials fallback.
- No direct Supabase access in this directory; auth state arrives via context.

## Verification

- Run: `npm run lint && npm run build`
