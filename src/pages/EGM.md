# Pages (`src/pages`)

## Overview

Route-level screens for the DTHT study platform. Every module here is a default
exported React component mounted by `src/App.jsx`; all but `AuthScreen` render
inside `RootLayout` (sidebar + bottom tabs + `Outlet`) and therefore assume an
authenticated `useAuth()` context, because `RootLayout` redirects to `/auth`
when there is no session. Pages own their data fetching and orchestrate the
lower layers: `src/lib/admission` for maths, `src/hooks/useStudyTracker` for
EXP, and `src/components/**` for presentation.

## Interface

| Component | Route(s) | Responsibility |
| --- | --- | --- |
| `AuthScreen()` | `/`, `/auth` | Sign-in / sign-up via Supabase Auth with Vietnamese error mapping and post-login redirect. |
| `Home()` | `/home` | Landing hub: four "arena gates", rank ladder from `RANK_TIERS`, idle route prefetch. |
| `GPACalculator()` | `/gpa` | University GPA: semester + subject CRUD, GPA on the 4-point scale via `lib/admission/gpa`. |
| `Library()` | `/library` | Document library: search/category/education-level filters, notifications, report submission, PDF/preview. |
| `Profile()` | `/profile` | Own profile editing, rank/level panel, saved subjects, campaigns, own documents. |
| `Roadmap()` | `/roadmap` | Milestone timeline for student and university modes, seeded defaults, reordering. |
| `Admin()` | `/admin` | Admin console: user directory, role grants, document moderation, Thong Soai queue. |
| `AdmissionCalculator()` | `/admission`, `/tim-truong/diem` | Unified score entry across THPT/học bạ/HSA/V-ACT/TSA/BCA/SPT/H-SCA/V-SAT, persisted as score profile v3. |
| `SchoolFinder()` | `/schools`, `/tim-truong` | Cutoff lookup, combo selection, admission-probability estimate, wishlist. |
| `StudyArena()` | `/arena` | Study campaigns (private/public), sub-targets, leaderboard, completion. |
| `Collaborator()` | `/collaborator` | Document publishing console for collaborators and admins. |
| `UserProfile()` | `/profile/:id` | Public profile view, follower/following graph, public campaigns and documents. |
| `OnlineLearning()` | `/hoc-online` | Subject/teacher sheet gallery, embedded Google Sheet, live study session via `useStudyTracker`. |
| `Notes()` | `/notes` | Personal notes CRUD with debounced autosave and search. |
| `CourseComboHs12()` | `/courses/combo-dtht-hs12-2k9-chinh-phuc-dai-hoc` | Marketing page for the five HS12 learning packages. |

## Invariants

- A page is reachable only if it is registered in three places: an entry in
  `routeModuleLoaders` (`src/lib/routeModules.js`), a `lazyRetry()` constant in
  `src/App.jsx`, and a `<Route>` element. All page modules are code-split; none
  may be imported eagerly by another page.
- `RootLayout` is the authentication gate: pages may assume `user` is non-null,
  but must still tolerate `profile` being `null` while SWR resolves.
- Role-gated screens redirect rather than render: `Admin` requires
  `profile.role === 'admin'` and `Collaborator` requires
  `collaborator`/`admin`; both otherwise `<Navigate to="/home" />`.
  `UserProfile` is public-readable but reads `user` for the follow toggle.
- Admission maths must come from `src/lib/admission/*`. `AdmissionCalculator`
  and `SchoolFinder` may not hardcode exam labels, scales, combo lists, or
  subject keys, and must write scores exclusively through `saveScoreEntry`.
- `SchoolFinder` must treat `convertScore` `{ value: null }` as "no anchor" and
  show the caveat; it must never fall back to a linear scale conversion.
- Every user-scoped query is filtered by `user.id` (semesters, subjects,
  campaigns, notes, roadmap milestones, wishlists) and every failure path leaves
  an empty list plus an error message instead of throwing to the boundary.
- Every external document/lesson URL passes through `sanitizeExternalUrl` /
  `assertSafeExternalUrl` before being rendered as a link or written to
  `documents`.
- `Library` must degrade gracefully when the `document_reports` /
  `notifications` tables are absent (migration not applied) — report and
  notification features are optional, browsing is not.
- `OnlineLearning` is the only page that starts study sessions; it passes
  `enabled: Boolean(user && activeTeacher)` plus the selected `sheetId` and
  `subjectId`, and wires `startSession` / `confirmContinue` / `endSession` into
  `SessionBar`.
- `GPACalculator` computes university GPA only — it must not regain the
  admission-score calculator that now lives in `AdmissionCalculator`.
- `CourseComboHs12` renders `comboHs12Course` in array order; its local visual
  presets are index-aligned with the content model's five packages.
- `Notes` enforces `TITLE_MAX_LENGTH = 200`, `CONTENT_MAX_LENGTH = 10000`, and
  `AUTOSAVE_DEBOUNCE_MS = 1500`, and must flush or discard safely on unmount.

## Side Effects

- Supabase PostgREST tables: `profiles`, `documents`, `document_reports`,
  `notifications`, `semesters`, `subjects`, `campaigns`, `user_notes`,
  `roadmap_milestones`, `follows`, `public_profile_view` (read-only view),
  `admission_wishlists`.
- Supabase RPCs: `admin_user_directory`, `admin_get_thongsoai_candidates`,
  plus the study-session RPCs driven through `useStudyTracker`.
- Authentication: sign-in/sign-up/sign-out on `AuthScreen`; `refreshProfile()`
  after profile edits; redirects via `useNavigate`.
- Browser APIs: `window.confirm`/`alert` for destructive actions,
  `sessionStorage` chunk-reload guard in `App.jsx`, `localStorage` via the study
  tracker and welcome modal, `navigator`/`document` reads for library search and
  pagination.

## Verification

- Run: `npm run lint && npm run build`
