# Study Tracker Hook (`src/hooks`)

## Overview

`useStudyTracker.js` is the EXP v2 accrual engine. It measures a *study session*
rather than tab visibility, because learners legitimately study inside a Google
Sheet opened in another tab. In the preferred session mode the server owns the
clock: `start_study_session()` opens a session and a heartbeat credits real
elapsed time; in fallback mode the hook accrues locally from timestamps and
flushes bounded chunks through `award_study_exp`.

## Interface

- `useStudyTracker({ enabled = false, initialExp, initialStudySeconds, initialStreak, onSync, subjectId = null, sheetId = null } = {})`
  — the only export. Returns:
  - Counters (v1-compatible): `exp`, `studySeconds`, `streak`, `level`,
    `levelInfo` (from `getLevelFromExp`), `isAccruing`.
  - Feedback: `flash` (`{ id, type: 'exp' | 'levelup', amount, level }`) and
    `clearFlash()`.
  - Session API (v2): `sessionStatus`
    (`'idle' | 'active' | 'needs-confirm' | 'fallback'`), `sessionSeconds`,
    `startSession()`, `confirmContinue()`, `endSession()`.
- Module constants (not exported): `HEARTBEAT_MS = 50000`, `TICK_MS = 1000`,
  `SESSION_LS_KEY = 'dtht.session.v1'`, `SESSION_RESUME_MS = 5 * 60 * 1000`,
  `IDLE_CONFIRM_MS = 90 * 60 * 1000`, `MAX_CYCLE_DELTA_S = 90`,
  `AWARD_THRESHOLD_S = 30`, `MAX_CHUNK_S = 120`.

## Invariants

- Counters seed from the profile **exactly once**, on first arrival
  (`seededRef`); later profile revisits must never clobber EXP earned live.
- `enabled` is the master switch: nothing accrues, no RPC fires, and no
  interval runs while it is false.
- Session mode is chosen lazily and latched in `modeRef`; a
  function-not-found class error (`PGRST202`, `42883`, 404, "could not find the
  function") permanently demotes that tracker instance to fallback mode, while
  any other error must not.
- No `sheetId` means fallback mode, even if the session RPCs exist.
- Server-side guards are authoritative: the wall-clock clamp and the 5 h/day cap
  live in `award_study_exp()`. The client must never assume it can exceed them.
- A failed award RPC **re-banks** the chunk instead of dropping it; a chunk is
  never larger than `MAX_CHUNK_S = 120` s.
- After `IDLE_CONFIRM_MS` without an interaction signal the session becomes
  `needs-confirm`; heartbeats continue with `p_credit=false` until
  `confirmContinue()` is called, so time cannot silently accrue while idle.
- A draft of the open session is persisted under `dtht.session.v1` and may only
  be resumed within `SESSION_RESUME_MS`; stale drafts are removed.
- `onSync` is read through a ref, so a changing callback identity must not
  restart the accrual loop.
- `endSession()` must be safe to call twice; "session not found / already
  ended" responses are treated as already-terminated, not as errors.

## Side Effects

- Supabase RPCs: `start_study_session`, `heartbeat_study_session`,
  `end_study_session`, `award_study_exp` (fallback path, `p_seconds` ≤ 120).
- `window.localStorage`: writes/reads/removes the `dtht.session.v1` session
  draft.
- Timers: a 1 s display tick and a 50 s heartbeat/fallback cycle, both cleared on
  cleanup.
- DOM listeners: `pointerdown`, `keydown`, `scroll` (passive) on `document`,
  `blur` on `window`, `pagehide` on `window`; all removed on cleanup.
- A final `fetch(..., { keepalive: true })` flush on page hide so the last chunk
  survives navigation.

## Verification

- Run: `npm run lint && npm run build`
