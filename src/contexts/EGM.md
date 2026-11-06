# Contexts (`src/contexts`)

## Overview

Application-wide state providers.
- `AuthContext.jsx` bootstraps the Supabase session once, subscribes to auth events, and layers the user's `profiles` row on top via SWR so any component can read `user`, `profile`, and `loading` without prop drilling.
- `ThemeContext.jsx` manages dual visual themes ("Thư Phòng Sáng" ⇋ "Mặc Dạ Tối"), persisting user preference to `localStorage` and synchronizing `.dark` class on `document.documentElement` alongside meta `theme-color`.

## Interface

### `AuthContext.jsx`
- `AuthProvider({ children })` — named export. Context provider mounted in `src/App.jsx` above the router. Owns `user`, `loading`, and the SWR-cached `profile`.
- `useAuth()` — named export. Returns `{ user, profile, loading, refreshProfile }`:
  - `user` — Supabase `User` or `null`.
  - `profile` — `profiles` row (`display_name`, `avatar_url`, `role`, `university`, `user_mode`, target/current GPA fields, `admission_scores`, `is_approved_bang_chu`, `exp`, `study_seconds`, `study_streak`, `last_study_date`) or `null`.
  - `loading` — `true` until the initial `getSession()` resolves.
  - `refreshProfile()` — SWR `mutate` for the profile key.
- `sanitizeNextPath(rawNext, fallback = '/home')` — named export. Validates relative path redirect targets to prevent open-redirect vulnerabilities.
- Internal (not exported): `fetcherProfile(userId)` selects the profile row.

### `ThemeContext.jsx`
- `ThemeProvider({ children })` — named export. Context provider mounted in `src/main.jsx` wrapping `<App />`.
- `useTheme()` — named export. Returns `{ theme, isDark, toggleTheme, setTheme }`:
  - `theme` — `'light' | 'dark'`.
  - `isDark` — boolean (`theme === 'dark'`).
  - `toggleTheme()` — toggles between `'light'` and `'dark'`.
  - `setTheme(newTheme)` — sets theme to explicit `'light'` or `'dark'`.
- Internal: `THEME_STORAGE_KEY = 'dtht_theme'`.

## Invariants

- `AuthProvider` must wrap every component that calls `useAuth()`; `App.jsx` places it above `ToastProvider` and the router.
- `ThemeProvider` wraps the application root in `src/main.jsx`.
- `useTheme()` throws `'useTheme must be used within a ThemeProvider'` if invoked outside `ThemeProvider`.
- `ThemeContext` initializes from `localStorage.getItem('dtht_theme')` falling back to `window.matchMedia('(prefers-color-scheme: dark)')`.
- `loading` starts `true` and flips to `false` exactly once, after the initial session bootstrap settles (the `finally` branch is guarded by an `active` flag so an unmounted provider never sets state).
- The `user` reference is kept stable across `TOKEN_REFRESHED` events: the state updater returns the previous object when `prev.id === next.id`. This is deliberate — re-creating the object retriggers downstream effects on tab focus.
- The SWR key is `profile-${user.id}` and is `null` when signed out, so no profile request fires for anonymous visitors.
- SWR options are contract: `revalidateOnFocus: false`, `revalidateOnReconnect: true`, `dedupingInterval: 5000`.
- A profile fetch error logs and returns `null` rather than throwing; consumers must tolerate `user` non-null with `profile` null (e.g. during signup races).
- Callers must not mutate `profile`; writes go to Supabase and are reflected by `refreshProfile()`.

## Side Effects

- Supabase Auth: `getSession()` on mount and `onAuthStateChange()` subscription (unsubscribed on unmount).
- Supabase PostgREST: single-row `select` from `profiles` for the current user, revalidated on reconnect.
- DOM Mutation: `ThemeContext` toggles the `dark` class on `document.documentElement` and updates `meta[name="theme-color"]` (`#12100E` for dark, `#FAF7F0` for light).
- Storage: `ThemeContext` reads and writes `dtht_theme` to `localStorage`.

## Verification

- Run: `npm run lint && npm run build`
