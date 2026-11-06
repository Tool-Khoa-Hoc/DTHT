# Frontend Application (`src`)

## System Overview

`src/` is the frontend application subsystem for the DTHT web platform (Trạm Học Sinh Sinh Viên), built with React 19, Vite, and Tailwind CSS v4. It implements a responsive Single Page Application (SPA) offering study tools, GPA calculation, university admissions analysis, document library browsing, and gamified study tracking.

The subsystem is architected with a decoupled layer hierarchy:
- **Bootstrap & Routing**: `main.jsx` and `App.jsx` initialise React 19, mount global context providers (`ThemeProvider`, `AuthProvider`, `ToastProvider`), and configure lazy routes with chunk-retry resilience.
- **Visual Design System**: `index.css` configures Tailwind v4 and exports the "Môn phái học tập" / "Thư Phòng Sáng" design token palette (ink plum background, ember brand accents, gold badges, jade accents, arena typography, rice paper light mode).
- **Core Subsystems**: Eight focused child packages partition concerns across UI components, domain configuration, auth state, custom hooks, shared infrastructure, route views, and pure utilities.

## Local Interface & Invariants

### `main.jsx`
- Initializes the client runtime: mounts `<StrictMode><ThemeProvider><App /></ThemeProvider></StrictMode>` into `document.getElementById('root')`.
- Imports `index.css` for global style and token cascade.

### `App.jsx`
- `App()` — Default root export. Encloses the component hierarchy in `BrowserRouter`, `AuthProvider`, `ToastProvider`, `ErrorBoundary`, and `Suspense` with `PageSkeleton` fallback.
- `lazyRetry(componentImport)` — Lazy component wrapper handling Vite dynamic chunk reloads gracefully. Removes `vite-chunk-reload` on success, or sets `sessionStorage` flag and performs a single `window.location.reload()` if a chunk fetch fails after deployment.
- `scheduleIdleTask(callback, timeout = 1500)` — Polyfill for `requestIdleCallback` falling back to `setTimeout(..., min(timeout, 800))` to run non-critical startup work without blocking First Contentful Paint.
- `DeferredSpeedInsights()` — Defers `@vercel/speed-insights/react` import and mounting by 5000ms via `scheduleIdleTask`.
- **Boot Shell Dismissal**: Locates `#boot-shell`, sets `data-ready="true"`, and removes the element on the next animation frame.

### Routing Table
Routes defined in `App.jsx`:
- Public: `/` (AuthScreen), `/auth` (AuthScreen), `/auth/callback` (AuthCallback).
- Nested in `RootLayout`:
  - `/home` (Home — public view supported)
  - `/gpa` (GPACalculator)
  - `/library` (Library)
  - `/profile`, `/profile/:id` (Profile, UserProfile)
  - `/roadmap` (Roadmap)
  - `/admin` (Admin — guarded by `profile?.role === 'admin'`; contains inline tabs for document moderation, collaborator approval, and candidate promotion queue)
  - `/admission`, `/tim-truong/diem` (AdmissionCalculator)
  - `/schools`, `/tim-truong` (SchoolFinder)
  - `/arena` (StudyArena)
  - `/collaborator` (Collaborator)
  - `/hoc-online` (OnlineLearning)
  - `/courses/combo-dtht-hs12-2k9-chinh-phuc-dai-hoc` (CourseComboHs12)
  - `/notes` (Notes)

## Subdirectories & Boundaries

- **components**: [`./components/EGM.md`](./components/EGM.md) — Shell layout (`RootLayout`), global widgets (`Avatar`, `WelcomeModal`, `ErrorBoundary`), reusable UI primitives ([`./components/ui/EGM.md`](./components/ui/EGM.md)), and administrative tab extractions ([`./components/admin/EGM.md`](./components/admin/EGM.md)).
- **config**: [`./config/EGM.md`](./config/EGM.md) — Static app configuration, teacher seed registries (`teachers.seed.json`), and metadata definitions.
- **content**: [`./content/EGM.md`](./content/EGM.md) — Editorial course marketing models; exports `comboHs12Course` in `courseCatalog.js` for the `/courses/combo-dtht-hs12-2k9-chinh-phuc-dai-hoc` route.
- **contexts**: [`./contexts/EGM.md`](./contexts/EGM.md) — React context providers: `AuthContext` (auth session, profile SWR, next-path sanitation) and `ThemeContext` (dual theme state, localStorage sync, dark mode class toggling).
- **hooks**: [`./hooks/EGM.md`](./hooks/EGM.md) — Single hook package holding `useStudyTracker.js`, the core EXP v2 accrual and heartbeat synchronization engine.
- **lib**: [`./lib/EGM.md`](./lib/EGM.md) — Shared frontend utilities (singleton Supabase client, document query constants, route preloading) and admissions calculation engine ([`./lib/admission/EGM.md`](./lib/admission/EGM.md)).
- **pages**: [`./pages/EGM.md`](./pages/EGM.md) — 16 top-level route views and page controllers (including OAuth/magic link handler `AuthCallback`).
- **utils**: [`./utils/EGM.md`](./utils/EGM.md) — Pure computational helpers: Word document parsing (`docxParser.js`), EXP leveling and arena rank thresholds (`levelHelper.js`, `rankHelper.js`), URL sanitation (`urlSecurity.js`), asset paths (`mediaPath.js`), and duration formatting (`timeFormat.js`).

## Global Invariants

- **Root Element Dependency**: Assumes `<div id="root">` is defined in `index.html`.
- **Session Protection Boundary**: Access to all sub-routes nested within `RootLayout` (except `/home`) requires an authenticated user; non-authenticated requests redirect to `/auth`. Admin sub-panel strictly requires `profile?.role === 'admin'`.
- **Single Supabase Client**: The frontend strictly consumes the singleton Supabase client exported by `src/lib/supabase.js`; no secondary instances may be created.
- **Chunk Failure Recovery**: `lazyRetry` allows exactly one automatic page reload on dynamic import failure to prevent infinite reload loops when assets are outdated.
- **Strict Mode Compliance**: All top-level hooks and effects in `src/` must remain idempotent under React 19 `StrictMode` double-mounting in development.
- **Optimized Runtime Footprint**: Client bundle excludes decommissioned PDF rendering dependencies (`pdfjs-dist`, `react-pdf`) and unneeded external DNS prefetches. `katex` is isolated strictly to `devDependencies` for out-of-band scripts; static worker assets (`pdf.worker.min.mjs`, 1.37 MB) are pruned.

## Global Side Effects

- **DOM Mutation**: Mounts the React virtual DOM tree into `#root`, manages theme class on document element, and removes `#boot-shell` from the document body upon initial mount.
- **Storage Access**: Reads and writes `sessionStorage.getItem('vite-chunk-reload')` and `localStorage.getItem('dtht_theme')`.
- **Timer & Frame Scheduling**: Dispatches `requestAnimationFrame` for shell cleanup and `requestIdleCallback` / `setTimeout` for deferred analytics.
- **Network I/O**: Dispatches API requests via `@supabase/supabase-js`, pulls remote static assets (documents, images), and triggers lazy route module imports.

## Verification

- Run: `npm run lint && npm run build`
