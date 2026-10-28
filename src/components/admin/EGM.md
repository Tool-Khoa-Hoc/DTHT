# Admin Components (`src/components/admin`)

## Overview

Tab-scoped administration panels mounted by the `/admin` page. Each panel is a
self-contained "peanut": it owns its own data fetching, its own mutations, and
renders nothing unless it is the currently selected tab. All three talk to
Supabase directly through the shared client and rely on Postgres row-level
security to authorise the operations they attempt.

## Interface

- `AdminLibrary({ isActive })` — default export. Document management table for
  the `documents` table: create, edit, delete, toggle `is_featured`, split by
  `education_level` (`thpt` / `university`). Local `CATEGORIES` constant lists
  the 15 subject categories (`toan`, `ly`, `hoa`, `sinh`, `van`, `anh`, `su`,
  `dia`, `gdcd`, `tin`, `giai_tich`, `lap_trinh`, `kien_truc`, `kinh_te`,
  `khac`). Reads `user` from `useAuth()` for `uploaded_by`.
- `AdminCollaborator({ isActive })` — default export. Collaborator
  ("Truyền Đạo Sư") roster: paged listing by role, free-text user search, and
  promote/demote between `collaborator` and `user`.
- `AdminThongSoai({ isActive })` — default export. "Thống Soái" candidate queue:
  users with ≥ 50 completed campaigns, approved/rejected through
  `profiles.is_approved_bang_chu`.
- Shared helper (module-local, not exported): `adminUserDirectory({ search, role, ids, limit })`
  wraps the `admin_user_directory` RPC and normalises the result to an array.
- Module constants: `ADMIN_USER_DIRECTORY_SELECT_LIMIT = 200` (duplicated in
  `AdminCollaborator.jsx` and `AdminThongSoai.jsx`).

## Invariants

- Every panel accepts a required `isActive: boolean` prop and must be a no-op
  when `isActive` is false: `AdminThongSoai` returns `null`, and all three only
  fetch inside `useEffect` guarded by `isActive`.
- Writes to `documents` must pass the URL through `assertSafeExternalUrl()`
  first; it throws on anything that is not an absolute `http:`/`https:` URL.
- `author_name` falls back to `'Khuyết danh'`; `major` is only persisted when
  `education_level === 'university'`, otherwise it is written as `null`.
- Deletes are irreversible and require `window.confirm` acknowledgement before
  the Supabase call.
- Role arithmetic is closed over `{ admin, collaborator, editor, user }`;
  collaborator panels never surface `role === 'admin'` accounts in search
  results.
- The `admin_user_directory` RPC caps results, so callers must not assume the
  full roster is returned; `ADMIN_USER_DIRECTORY_SELECT_LIMIT` is the ceiling.
- `AdminThongSoai` eligibility is exactly "completed campaigns ≥ 50"; the
  candidate list is sorted descending by that count.

## Side Effects

- Supabase PostgREST: `documents` select/insert/update/delete,
  `profiles` update (`role`, `is_approved_bang_chu`, profile columns),
  `campaigns` select (`user_id`, `is_completed`).
- Supabase RPC: `admin_user_directory` (paged directory/search by role or id
  set) from both collaborator and Thong Soai panels.
- Browser dialogs: `window.confirm` before delete, `alert()` for mutation
  failures, and a transient inline success/error message cleared after 3 s.

## Verification

- Run: `npm run lint && npm run build`
