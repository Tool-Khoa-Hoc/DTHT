import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getLevelFromExp } from '../utils/levelHelper';

/*
 * useStudyTracker — EXP v2.
 *
 * v1 gated accrual on document visibility ("only count while the DTHT tab
 * is visible") to bound AFK farming. That broke the real study flow: the
 * learner opens the Google Sheet in a NEW tab (or follows a lesson link
 * inside the Sheet) and studies there, so the DTHT tab is hidden for the
 * whole session and nothing was ever credited.
 *
 * v2 therefore measures a *study session* instead of tab visibility:
 *
 *   SESSION MODE (preferred, needs the 20261022090000_study_sessions
 *   migration): start_study_session() opens a session, then a heartbeat
 *   every 50s lets the server credit real elapsed time from its own clock
 *   (capped per beat) through the unchanged award_study_exp() — its
 *   wall-clock clamp + 5h/day cap remain the anti-farming guards, so the
 *   tab may be hidden, minimised or in the background and time still
 *   accrues. After 90 minutes without any interaction signal the session
 *   switches to `needs-confirm`: heartbeats keep it alive with
 *   p_credit=false until confirmContinue() is called.
 *
 *   FALLBACK MODE (legacy-v2): if the session RPCs are not deployed yet
 *   (function-not-found / PGRST202 / 404) — or no sheetId was passed — the
 *   hook still fixes v1's bugs: it accrues by Date.now() timestamps with
 *   NO visibility gate, flushes chunks of <=120s through award_study_exp,
 *   RE-BANKS a chunk when the RPC fails instead of dropping it, and sends
 *   a final flush with fetch(keepalive) on pagehide.
 *
 * Returned API: the v1 fields (exp, studySeconds, streak, level, levelInfo,
 * isAccruing, flash, clearFlash) are unchanged; v2 adds sessionStatus
 * ('idle' | 'active' | 'needs-confirm' | 'fallback'), sessionSeconds,
 * startSession(), confirmContinue() and endSession().
 */

const HEARTBEAT_MS = 50000;          // session heartbeat / fallback cycle cadence
const TICK_MS = 1000;                // display clock refresh
const SESSION_LS_KEY = 'dtht.session.v1';
const SESSION_RESUME_MS = 5 * 60 * 1000; // resume an open session if page returns within 5 min
const IDLE_CONFIRM_MS = 90 * 60 * 1000;  // no interaction for 90 min -> needs-confirm
const MAX_CYCLE_DELTA_S = 90;        // fallback: max seconds one cycle may claim (mirrors server beat cap)
const AWARD_THRESHOLD_S = 30;        // fallback: send once this many seconds have banked
const MAX_CHUNK_S = 120;             // award_study_exp rejects anything above this anyway

function isMissingFunctionError(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const status = Number(error.status || error.statusCode || 0);
  const text = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
  return (
    code === 'PGRST202' || // PostgREST: function not in schema cache
    code === '42883' ||    // Postgres: function does not exist
    status === 404 ||
    /could not find the function/i.test(text) ||
    /function .* does not exist/i.test(text)
  );
}

function isSessionGoneError(error) {
  if (!error) return false;
  const text = `${error.message || ''} ${error.details || ''}`;
  return /study session not found/i.test(text) || /study session already ended/i.test(text);
}

export function useStudyTracker({
  enabled = false,
  initialExp,
  initialStudySeconds,
  initialStreak,
  onSync,
  subjectId = null,
  sheetId = null,
} = {}) {
  const [exp, setExp] = useState(0);
  const [studySeconds, setStudySeconds] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isAccruing, setIsAccruing] = useState(false);
  const [flash, setFlash] = useState(null); // { id, type:'exp'|'levelup', amount, level }
  const [sessionStatus, setSessionStatus] = useState('idle'); // idle|active|needs-confirm|fallback
  const [sessionSeconds, setSessionSeconds] = useState(0);

  const expRef = useRef(0);
  const flashIdRef = useRef(0);
  const seededRef = useRef(false);
  const onSyncRef = useRef(onSync);
  const sheetIdRef = useRef(sheetId);
  const subjectIdRef = useRef(subjectId);

  // --- session-mode refs ---
  const modeRef = useRef(null); // null (undecided) | 'session' | 'fallback'
  const sessionIdRef = useRef(null);
  const startingRef = useRef(null); // in-flight ensureSession() promise
  const heartbeatBusyRef = useRef(false);
  const displayBaseRef = useRef(0); // server-confirmed credited seconds of this session
  const displayAnchorRef = useRef(null); // ms ts the current display segment started (null = frozen)

  // --- fallback-mode refs ---
  const pendingRef = useRef(0); // banked seconds not yet sent
  const fallbackSentRef = useRef(0); // seconds of this session already accepted by the server
  const fallbackLastTsRef = useRef(null);
  const sendingRef = useRef(false);

  // --- shared ---
  const lastInteractionRef = useRef(Date.now());
  const needsConfirmRef = useRef(false);
  const enabledRef = useRef(false);

  expRef.current = exp;
  onSyncRef.current = onSync;
  sheetIdRef.current = sheetId;
  subjectIdRef.current = subjectId;
  enabledRef.current = enabled;

  // Seed live counters from the profile exactly once, when it first arrives.
  // Never re-seed afterwards or we'd clobber EXP earned live this session.
  useEffect(() => {
    if (seededRef.current) return;
    if (typeof initialExp !== 'number') return;
    seededRef.current = true;
    setExp(Math.max(0, Math.floor(initialExp)));
    setStudySeconds(Math.max(0, Math.floor(Number(initialStudySeconds) || 0)));
    setStreak(Math.max(0, Math.floor(Number(initialStreak) || 0)));
  }, [initialExp, initialStudySeconds, initialStreak]);

  // Fold an award_study_exp() result (direct, or nested in a heartbeat
  // response) into state + the +EXP / level-up flash. Unchanged from v1.
  const applyAward = useCallback((data) => {
    if (!data) return;
    const newExp = Number(data.exp) || 0;
    const before = getLevelFromExp(expRef.current);
    const after = getLevelFromExp(newExp);

    setExp(newExp);
    if (data.study_seconds != null) setStudySeconds(Number(data.study_seconds) || 0);
    if (data.streak != null) setStreak(Number(data.streak) || 0);

    const gained = Number(data.awarded_exp) || 0;
    if (after.level > before.level) {
      flashIdRef.current += 1;
      setFlash({ id: flashIdRef.current, type: 'levelup', level: after.level, amount: gained });
    } else if (gained > 0) {
      flashIdRef.current += 1;
      setFlash({ id: flashIdRef.current, type: 'exp', amount: gained });
    }
  }, []);

  // fetch(keepalive) RPC call for pagehide/unmount, where a normal async
  // supabase.rpc may be cancelled by the browser. sendBeacon cannot set
  // headers, so we fetch with the anon key + the user's access token.
  const keepaliveRpc = useCallback(async (fnName, params) => {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!baseUrl || !anonKey) return;
    let accessToken = anonKey;
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) accessToken = data.session.access_token;
    } catch { /* fall back to anon key */ }
    try {
      await fetch(`${String(baseUrl).replace(/\/$/, '')}/rest/v1/rpc/${fnName}`, {
        method: 'POST',
        keepalive: true,
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params || {}),
      });
    } catch { /* page is going away; nothing more we can do */ }
  }, []);

  // --- localStorage session draft -------------------------------------------
  const saveDraft = useCallback(() => {
    try {
      if (!sessionIdRef.current) return;
      window.localStorage.setItem(SESSION_LS_KEY, JSON.stringify({
        sessionId: sessionIdRef.current,
        sheetId: sheetIdRef.current,
        subjectId: subjectIdRef.current,
        baseSeconds: displayBaseRef.current,
        savedAt: Date.now(),
      }));
    } catch { /* private mode etc. — resume is best-effort */ }
  }, []);

  const readDraft = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(SESSION_LS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const clearDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(SESSION_LS_KEY);
    } catch { /* ignore */ }
  }, []);

  // What the session clock should display right now.
  const computeSessionSeconds = useCallback(() => {
    if (modeRef.current === 'session') {
      const segment = displayAnchorRef.current
        ? Math.max(0, (Date.now() - displayAnchorRef.current) / 1000)
        : 0;
      return Math.floor(displayBaseRef.current + segment);
    }
    if (modeRef.current === 'fallback') {
      return Math.floor(fallbackSentRef.current + pendingRef.current);
    }
    return 0;
  }, []);

  const enterFallback = useCallback(() => {
    modeRef.current = 'fallback';
    sessionIdRef.current = null;
    clearDraft();
    fallbackLastTsRef.current = Date.now();
    setSessionStatus(needsConfirmRef.current ? 'needs-confirm' : 'fallback');
  }, [clearDraft]);

  // Adopt a server session (freshly started or resumed) from a heartbeat /
  // start response payload.
  const adoptSession = useCallback((sessionId, data) => {
    sessionIdRef.current = sessionId;
    modeRef.current = 'session';
    const credited = Number(data?.credited_seconds ?? data?.session_seconds);
    if (Number.isFinite(credited) && credited >= 0) displayBaseRef.current = credited;
    displayAnchorRef.current = needsConfirmRef.current ? null : Date.now();
    if (data?.award) applyAward(data.award);
    else if (data?.exp != null) {
      setExp(Number(data.exp) || 0);
      if (data.streak != null) setStreak(Number(data.streak) || 0);
    }
    setSessionStatus(needsConfirmRef.current ? 'needs-confirm' : 'active');
    saveDraft();
  }, [applyAward, saveDraft]);

  // --- session heartbeat ------------------------------------------------------
  const doHeartbeat = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId || heartbeatBusyRef.current) return;
    heartbeatBusyRef.current = true;
    try {
      const { data, error } = await supabase.rpc('heartbeat_study_session', {
        p_session_id: sessionId,
        p_credit: !needsConfirmRef.current,
      });
      if (error) {
        if (isMissingFunctionError(error)) {
          // Migration vanished mid-session: keep earning via the legacy path.
          enterFallback();
        } else if (isSessionGoneError(error)) {
          // Server closed it (newer session elsewhere / admin): forget it;
          // the next cycle starts a fresh session.
          sessionIdRef.current = null;
          displayAnchorRef.current = null;
          clearDraft();
        }
        // Ordinary errors: leave everything as-is. The server computes the
        // next credit from last_heartbeat_at, so no time is lost (each beat
        // is capped at 90s — an accepted trade-off).
        return;
      }
      if (data) adoptSession(sessionId, data);
    } catch {
      /* network hiccup: next beat retries, server clock keeps the time */
    } finally {
      heartbeatBusyRef.current = false;
    }
  }, [adoptSession, clearDraft, enterFallback]);

  // --- start / resume ---------------------------------------------------------
  const ensureSession = useCallback(async () => {
    if (modeRef.current === 'fallback' || sessionIdRef.current) return;
    if (startingRef.current) return startingRef.current;

    // Without a sheetId there is nothing to open a session against (the
    // page has not been wired for v2 yet) — go straight to fallback mode.
    if (!sheetIdRef.current) {
      enterFallback();
      return;
    }

    startingRef.current = (async () => {
      try {
        // Resume a recent open session for the same sheet (page reload /
        // brief navigation away): one heartbeat both validates it and
        // credits the gap.
        const draft = readDraft();
        if (
          draft?.sessionId &&
          draft.sheetId === sheetIdRef.current &&
          Date.now() - Number(draft.savedAt || 0) < SESSION_RESUME_MS
        ) {
          displayBaseRef.current = Math.max(0, Number(draft.baseSeconds) || 0);
          const { data, error } = await supabase.rpc('heartbeat_study_session', {
            p_session_id: draft.sessionId,
            p_credit: !needsConfirmRef.current,
          });
          if (!error && data) {
            adoptSession(draft.sessionId, data);
            return;
          }
          if (isMissingFunctionError(error)) {
            enterFallback();
            return;
          }
          clearDraft(); // stale/foreign session — fall through and start fresh
        }

        const { data, error } = await supabase.rpc('start_study_session', {
          p_sheet_id: sheetIdRef.current,
          p_subject_id: subjectIdRef.current ?? null,
        });
        if (error) {
          if (isMissingFunctionError(error)) {
            enterFallback();
          }
          // Other errors (network/auth): stay undecided, next cycle retries.
          return;
        }
        if (data) {
          displayBaseRef.current = 0;
          adoptSession(data, { credited_seconds: 0 });
        }
      } catch {
        /* stay undecided; the next cycle retries */
      } finally {
        startingRef.current = null;
      }
    })();
    return startingRef.current;
  }, [adoptSession, clearDraft, enterFallback, readDraft]);

  // Public: (re)start tracking for the current sheet. Safe to call from a
  // click handler ("Mở sheet") — never throws, never blocks the caller.
  const startSession = useCallback(() => {
    lastInteractionRef.current = Date.now();
    ensureSession().catch(() => {});
  }, [ensureSession]);

  // --- fallback flush (re-bank on error — the v1 drop-the-chunk bug) ---------
  const flushFallback = useCallback(async (force = false) => {
    const banked = Math.floor(pendingRef.current);
    const minToSend = force ? 5 : AWARD_THRESHOLD_S;
    if (banked < minToSend || sendingRef.current) return;

    const chunk = Math.min(banked, MAX_CHUNK_S);
    pendingRef.current -= chunk;
    sendingRef.current = true;
    try {
      const { data, error } = await supabase.rpc('award_study_exp', { p_seconds: chunk });
      if (error || !data) {
        pendingRef.current += chunk; // RE-BANK: retry next cycle, don't lose the time
        return;
      }
      fallbackSentRef.current += Number(data.awarded_seconds ?? chunk) || 0;
      applyAward(data);
    } catch {
      pendingRef.current += chunk; // RE-BANK on network failure too
    } finally {
      sendingRef.current = false;
    }
  }, [applyAward]);

  // --- main cycle ---------------------------------------------------------------
  const cycle = useCallback(async () => {
    if (modeRef.current === 'session') {
      await doHeartbeat();
      return;
    }
    if (modeRef.current === 'fallback') {
      const now = Date.now();
      if (fallbackLastTsRef.current) {
        // Accrue by timestamp — visibility is irrelevant. While
        // needs-confirm is up we stop accruing but still flush what's banked.
        if (!needsConfirmRef.current) {
          const delta = Math.min((now - fallbackLastTsRef.current) / 1000, MAX_CYCLE_DELTA_S);
          if (delta > 0) pendingRef.current += delta;
        }
      }
      fallbackLastTsRef.current = now;
      if (pendingRef.current >= AWARD_THRESHOLD_S) await flushFallback(false);
      return;
    }
    await ensureSession();
  }, [doHeartbeat, ensureSession, flushFallback]);

  // --- end ------------------------------------------------------------------------
  const endSession = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    sessionIdRef.current = null;
    displayAnchorRef.current = null;
    clearDraft();
    if (modeRef.current === 'session' && sessionId) {
      modeRef.current = null;
      try {
        const { data, error } = await supabase.rpc('end_study_session', { p_session_id: sessionId });
        if (!error && data?.award) applyAward(data.award);
      } catch { /* best effort */ }
    } else if (modeRef.current === 'fallback') {
      await flushFallback(true);
    }
    setSessionStatus('idle');
    setSessionSeconds(0);
    displayBaseRef.current = 0;
    fallbackSentRef.current = 0;
    pendingRef.current = 0;
  }, [applyAward, clearDraft, flushFallback]);

  const confirmContinue = useCallback(() => {
    lastInteractionRef.current = Date.now();
    needsConfirmRef.current = false;
    if (modeRef.current === 'session') {
      // Resume the display segment; the false-credit heartbeats kept
      // last_heartbeat_at fresh, so only time from now on is credited.
      displayAnchorRef.current = Date.now();
      setSessionStatus('active');
      doHeartbeat();
    } else if (modeRef.current === 'fallback') {
      fallbackLastTsRef.current = Date.now();
      setSessionStatus('fallback');
    }
  }, [doHeartbeat]);

  // --- interaction signals ------------------------------------------------------
  useEffect(() => {
    if (!enabled) return undefined;
    const mark = () => { lastInteractionRef.current = Date.now(); };
    const onBlur = () => {
      // Clicking into the cross-origin Sheet iframe blurs the window while
      // the iframe becomes the active element — that IS study interaction.
      const el = document.activeElement;
      if (el && el.tagName === 'IFRAME') mark();
    };
    document.addEventListener('pointerdown', mark, { passive: true });
    document.addEventListener('keydown', mark);
    document.addEventListener('scroll', mark, { passive: true });
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('pointerdown', mark);
      document.removeEventListener('keydown', mark);
      document.removeEventListener('scroll', mark);
      window.removeEventListener('blur', onBlur);
    };
  }, [enabled]);

  // --- display clock + idle (needs-confirm) watcher -------------------------------
  useEffect(() => {
    if (!enabled) return undefined;
    const id = window.setInterval(() => {
      if (
        !needsConfirmRef.current &&
        modeRef.current &&
        Date.now() - lastInteractionRef.current > IDLE_CONFIRM_MS
      ) {
        // Freeze the displayed clock at its current value, then switch to
        // keepalive-only heartbeats (p_credit=false) until confirmContinue.
        displayBaseRef.current = computeSessionSeconds();
        displayAnchorRef.current = null;
        needsConfirmRef.current = true;
        setSessionStatus('needs-confirm');
        setIsAccruing(false);
      }
      setSessionSeconds(computeSessionSeconds());
      setIsAccruing(
        Boolean(modeRef.current) && !needsConfirmRef.current,
      );
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [enabled, computeSessionSeconds]);

  // --- lifecycle: start, heartbeat loop, pagehide, cleanup -----------------------
  useEffect(() => {
    if (!enabled) {
      setIsAccruing(false);
      setSessionStatus('idle');
      return undefined;
    }

    lastInteractionRef.current = Date.now();
    needsConfirmRef.current = false;
    cycle();
    const intervalId = window.setInterval(cycle, HEARTBEAT_MS);

    const onPageHide = () => {
      // Final beat that survives page unload. Session mode: heartbeat (NOT
      // end — a returning page may resume within 5 minutes). Fallback:
      // award the banked chunk (min 5s, cap 120s) optimistically.
      if (modeRef.current === 'session' && sessionIdRef.current) {
        saveDraft();
        keepaliveRpc('heartbeat_study_session', {
          p_session_id: sessionIdRef.current,
          p_credit: !needsConfirmRef.current,
        });
      } else if (modeRef.current === 'fallback') {
        const banked = Math.floor(pendingRef.current);
        if (banked >= 5 && !sendingRef.current) {
          const chunk = Math.min(banked, MAX_CHUNK_S);
          pendingRef.current -= chunk;
          keepaliveRpc('award_study_exp', { p_seconds: chunk });
        }
      }
    };
    window.addEventListener('pagehide', onPageHide);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('pagehide', onPageHide);
      setIsAccruing(false);
      // Teacher changed / unmount: close the session (keepalive end — a
      // plain rpc may be cancelled during unmount navigation), bank any
      // fallback time the reliable way, then refresh the profile so other
      // pages see the new EXP total.
      if (modeRef.current === 'session' && sessionIdRef.current) {
        const closingId = sessionIdRef.current;
        sessionIdRef.current = null;
        clearDraft();
        keepaliveRpc('end_study_session', { p_session_id: closingId })
          .finally(() => onSyncRef.current?.());
      } else if (modeRef.current === 'fallback') {
        flushFallback(true).finally(() => onSyncRef.current?.());
      } else {
        onSyncRef.current?.();
      }
      // Reset per-session state so a new teacher/session starts clean.
      // (modeRef keeps 'fallback' sticky if the migration is missing.)
      if (modeRef.current === 'session') modeRef.current = null;
      displayBaseRef.current = 0;
      displayAnchorRef.current = null;
      fallbackSentRef.current = 0;
      fallbackLastTsRef.current = null;
      setSessionSeconds(0);
      setSessionStatus('idle');
    };
  }, [enabled, sheetId, subjectId, cycle, flushFallback, keepaliveRpc, saveDraft, clearDraft]);

  const clearFlash = useCallback(() => setFlash(null), []);
  const levelInfo = getLevelFromExp(exp);

  return {
    exp,
    studySeconds,
    streak,
    level: levelInfo.level,
    levelInfo,
    isAccruing,
    flash,
    clearFlash,
    sessionStatus,
    sessionSeconds,
    startSession,
    confirmContinue,
    endSession,
  };
}
