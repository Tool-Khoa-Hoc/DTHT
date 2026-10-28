# Shared Library (`src/lib`)

## Overview

Infrastructure shared by every page: the singleton Supabase client, the
document-domain helpers (column lists, categories, search normalisation, date
and file-kind formatting), and the lazy route-module registry used for
prefetching. The heavy analytical code lives in the `admission/` child, which is
kept separate because it is pure maths rather than app plumbing.

## Interface

- `supabase.js`
  - `supabase` — the configured `@supabase/supabase-js` client (named export).
- `documents.js`
  - `DOCUMENT_FIELDS` — canonical `documents` select list.
  - `ADMIN_DOCUMENT_FIELDS` — `DOCUMENT_FIELDS` plus the embedded
    `document_reports(...)` relation used by admin moderation.
  - `LIBRARY_THPT_CATEGORIES` — `[{ label, value }]` filter chips (`''` = all).
  - `normalizeSearchText(value)` — NFD-strip, lowercase, trim.
  - `getDocumentUploadDate(document)` — `uploaded_at || created_at || null`.
  - `formatViDate(value, options)`, `formatViDateTime(value)` — `vi-VN`
    formatting, returning `null` for missing/invalid dates.
  - `getDocumentKindMeta(fileUrl)` — badge metadata (label/icon/colour) derived
    from the file extension/URL.
  - `getEducationLevelLabel(level)` — Vietnamese label for `thpt` / `university`.
- `routeModules.js`
  - `routeModuleLoaders` — `{ [routeKey]: () => import('../pages/…') }` for
    `RootLayout`, `Home`, `GPACalculator`, `Library`, `Profile`, `Roadmap`,
    `Admin`, `AdmissionCalculator`, `SchoolFinder`, `StudyArena`,
    `Collaborator`, `UserProfile`, `OnlineLearning`, `Notes`,
    `CourseComboHs12`.
  - `shouldPrefetchModules()` — capability/connection gate.
  - `preloadRouteModule(key)` — memoised dynamic import, resolves `null` for
    unknown keys or constrained clients.
- Child contract:
  - [Admission engine](./admission/EGM.md) — exam registry, score profiles,
    cutoffs, conversions, formulas, prediction.

## Invariants

- `supabase.js` reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from
  `import.meta.env`; both must exist at build time. The client config is
  contract: `persistSession: true`, `detectSessionInUrl: true`,
  `autoRefreshToken: true`, `db.schema = 'public'`, and the
  `x-application-name: tram-hs-sv` header.
- `supabase` is a module singleton — constructing a second client would fork the
  auth session and is forbidden.
- `DOCUMENT_FIELDS` / `ADMIN_DOCUMENT_FIELDS` must match the columns actually
  present on `documents` (plus `document_reports`); drift makes PostgREST return
  a 400 rather than partial data.
- `normalizeSearchText` is the only permitted search folding: diacritic removal
  must stay consistent between the search index and the query, otherwise
  Vietnamese titles stop matching.
- Date formatters return `null` (not `''` or `NaN`) for invalid input; callers
  decide the placeholder.
- Every key in `routeModuleLoaders` must correspond to a real module and to the
  key used by `App.jsx` and `RootLayout` prefetch handlers.
- `preloadRouteModule` caches the promise per key, resolves `null` for unknown
  keys, and **deletes the cache entry when the import rejects** so a later
  attempt can retry.
- `shouldPrefetchModules()` must return `false` for `saveData`, `slow-2g`/`2g`/`3g`,
  `deviceMemory < 4`, or `hardwareConcurrency < 6`, and `false` when
  `navigator` is unavailable.

## Side Effects

- `supabase.js` instantiates a network client with persistent auth storage
  (session tokens are written by the Supabase SDK, not by this module).
- `routeModules.js` triggers chunk downloads via dynamic `import()` whenever
  `preloadRouteModule` runs; it keeps a module-level `preloadCache` map.
- `documents.js` is side-effect free: pure formatting and string helpers.

## Verification

- Run: `npm run lint && npm run build`
