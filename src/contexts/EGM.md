# Auth Context (`src/contexts`)

## Overview

Application-wide authentication and profile state. `AuthContext.jsx` bootstraps
the Supabase session once, subscribes to auth events, and layers the user's
`profiles` row on top via SWR so any component can read `user`, `profile`, and
`loading` without prop drilling.

## Interface

- `AuthProvider({ children })` — named export. Context provider mounted in
  `src/App.jsx` above the router. Owns `user`, `loading`, and the SWR-cached
  `profile`.
- `useAuth()` — named export. Returns `{ user, profile, loading, refreshProfile }`:
  - `user` — Supabase `User` or `null`.
  - `profile` — `profiles` row (`display_name`, `avatar_url`, `role`,
    `university`, `user_mode`, target/current GPA fields, `admission_scores`,
    `is_approved_bang_chu`, `exp`, `study_seconds`, `study_streak`,
    `last_study_date`) or `null`.
  - `loading` — `true` until the initial `getSession()` resolves.
  - `refreshProfile()` — SWR `mutate` for the profile key.
- Internal (not exported): `fetcherProfile(userId)` selects the profile row.

## Invariants

- `AuthProvider` must wrap every component that calls `useAuth()`; `App.jsx`
  places it above `ToastProvider` and the router.
- `loading` starts `true` and flips to `false` exactly once, after the initial
  session bootstrap settles (the `finally` branch is guarded by an `active` flag
  so an unmounted provider never sets state).
- The `user` reference is kept stable across `TOKEN_REFRESHED` events: the
  state updater returns the previous object when `prev.id === next.id`. This is
  deliberate — re-creating the object retriggers downstream effects on tab
  focus.
- The SWR key is `profile-${user.id}` and is `null` when signed out, so no
  profile request fires for anonymous visitors.
- SWR options are contract: `revalidateOnFocus: false`,
  `revalidateOnReconnect: true`, `dedupingInterval: 5000`.
- A profile fetch error logs and returns `null` rather than throwing; consumers
  must tolerate `user` non-null with `profile` null (e.g. during signup races).
- Callers must not mutate `profile`; writes go to Supabase and are reflected by
  `refreshProfile()`.

## Side Effects

- Supabase Auth: `getSession()` on mount and `onAuthStateChange()` subscription
  (unsubscribed on unmount).
- Supabase PostgREST: single-row `select` from `profiles` for the current user,
  revalidated on reconnect.
- No storage access directly (session persistence is handled by the Supabase
  client), no timers.

## Verification

- Run: `npm run lint && npm run build`
