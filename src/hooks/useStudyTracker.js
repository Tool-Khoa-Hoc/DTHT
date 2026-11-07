import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getLevelFromExp } from '../utils/levelHelper';

/*
 * useStudyTracker — EXP v3 (Daily Minutes + 4-Layer Anti-AFK System)
 *
 * Prevents AFK tab farming ("treo web cày phút") while preserving smooth
 * study tracking both inside the embedded Google Sheet and in external tabs:
 *
 *   Layer 1 (Study Intent Gate):
 *     Does not auto-accrue merely from opening the page in a background tab.
 *     Requires genuine user interaction on the study page (pointer/key/scroll,
 *     focusing the embedded Sheet iframe, or clicking Start / Fullscreen / Open Sheet).
 *
 *   Layer 2 (Adaptive Idle Timeout):
 *     - Visible tab outside iframe: pauses after 5 minutes of zero input.
 *     - Visible tab focused inside Sheet iframe: pauses after 12 minutes.
 *     - Hidden tab (studying in external Sheet / video tab): allows up to
 *       20 minutes per stretch before pausing for confirmation.
 *
 *   Layer 3 (Pomodoro 25-Minute Check-in Challenge):
 *     Every 25 minutes of credited study time, presents a lightweight 3-choice
 *     symbol check-in with a 3-minute grace window. Completing it awards a
 *     +10 EXP Focus Bonus; ignoring it pauses accrual so AFK/auto-clickers stop.
 *
 *   Layer 4 (Server-side Verification):
 *     Sends `p_interacted` and `p_checkin_verified` to `heartbeat_study_session`
 *     (gracefully falling back to the 2-arg RPC if the DB migration is pending).
 */

const HEARTBEAT_MS = 50000;                  // 50s base heartbeat cadence
const HEARTBEAT_JITTER_MS = 10000;           // ±5s randomized jitter to prevent 10k-CCU thundering herd
const TICK_MS = 1000;                        // 1s UI clock & anti-AFK watcher
const SESSION_LS_KEY = 'dtht.session.v1';
const SESSION_RESUME_MS = 5 * 60 * 1000;     // resume open session within 5 min
const VISIBLE_IDLE_MS = 5 * 60 * 1000;       // 5 min no input on visible tab -> pause
const IFRAME_FOCUS_IDLE_MS = 12 * 60 * 1000; // 12 min while focused inside Sheet iframe -> pause
const HIDDEN_STUDY_WINDOW_MS = 20 * 60 * 1000; // max 20 min continuous hidden tab study -> pause
const CHECKIN_INTERVAL_S = 25 * 60;          // Pomodoro check-in every 25 minutes (1500s)
const CHECKIN_GRACE_MS = 3 * 60 * 1000;      // 3 minutes to answer check-in before pause
const POINTER_THROTTLE_MS = 3000;            // throttle pointermove updates
const MAX_CYCLE_DELTA_S = 90;                // fallback max seconds per cycle
const AWARD_THRESHOLD_S = 30;                // fallback min banked seconds to flush
const MAX_CHUNK_S = 120;                     // server award_study_exp clamp

const CHECKIN_SYMBOLS = [
  { symbol: 'local_fire_department', icon: 'local_fire_department', label: 'Ngọn lửa', labelEn: 'Flame' },
  { symbol: 'menu_book', icon: 'menu_book', label: 'Sách vàng', labelEn: 'Scholar Book' },
  { symbol: 'bolt', icon: 'bolt', label: 'Tia chớp', labelEn: 'Lightning' },
  { symbol: 'ads_click', icon: 'ads_click', label: 'Hồng tâm', labelEn: 'Bullseye' },
  { symbol: 'emoji_events', icon: 'emoji_events', label: 'Cúp vàng', labelEn: 'Trophy' },
];

function createCheckinChallenge(seq) {
  const pool = [...CHECKIN_SYMBOLS];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  const options = pool.slice(0, 3);
  const target = options[Math.floor(Math.random() * options.length)];
  const now = Date.now();
  return {
    id: `chk-${now}-${seq}`,
    targetSymbol: target.symbol,
    targetIcon: target.icon,
    targetLabel: target.label,
    targetLabelEn: target.labelEn,
    options,
    createdAt: now,
    expiresAt: now + CHECKIN_GRACE_MS,
  };
}

function isMissingFunctionError(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const status = Number(error.status || error.statusCode || 0);
  const text = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
  return (
    code === 'PGRST202' ||
    code === '42883' ||
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
  const [todaySeconds, setTodaySeconds] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isAccruing, setIsAccruing] = useState(false);
  const [flash, setFlash] = useState(null); // { id, type:'exp'|'levelup'|'checkin', amount, level }
  const [sessionStatus, setSessionStatus] = useState('idle'); // idle|ready|active|needs-confirm|fallback
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [idleReason, setIdleReason] = useState('none'); // none|not-started|visible-idle|hidden-timeout|checkin-expired
  const [checkinPrompt, setCheckinPrompt] = useState(null);
  const [checkinRemainingSec, setCheckinRemainingSec] = useState(0);

  const expRef = useRef(0);
  const flashIdRef = useRef(0);
  const seededRef = useRef(false);
  const onSyncRef = useRef(onSync);
  const sheetIdRef = useRef(sheetId);
  const subjectIdRef = useRef(subjectId);

  // --- session-mode refs ---
  const modeRef = useRef(null); // null | 'session' | 'fallback'
  const legacyHeartbeatArgsRef = useRef(false); // true if DB only supports 2-arg heartbeat
  const sessionIdRef = useRef(null);
  const startingRef = useRef(null);
  const heartbeatBusyRef = useRef(false);
  const displayBaseRef = useRef(0);
  const displayAnchorRef = useRef(null);

  // --- fallback-mode refs ---
  const pendingRef = useRef(0);
  const fallbackSentRef = useRef(0);
  const fallbackLastTsRef = useRef(null);
  const sendingRef = useRef(false);

  // --- Anti-AFK & Check-in refs ---
  const hasStudyIntentRef = useRef(false);
  const lastInteractionRef = useRef(Date.now());
  const interactedSinceBeatRef = useRef(false);
  const hiddenSinceRef = useRef(null);
  const needsConfirmRef = useRef(false);
  const checkinSeqRef = useRef(0);
  const nextCheckinAtSecRef = useRef(CHECKIN_INTERVAL_S);
  const activeCheckinRef = useRef(null);
  const checkinVerifiedPendingRef = useRef(false);
  const enabledRef = useRef(false);

  expRef.current = exp;
  onSyncRef.current = onSync;
  sheetIdRef.current = sheetId;
  subjectIdRef.current = subjectId;
  enabledRef.current = enabled;

  // Seed live counters from profile once
  useEffect(() => {
    if (seededRef.current) return;
    if (typeof initialExp !== 'number') return;
    seededRef.current = true;
    setExp(Math.max(0, Math.floor(initialExp)));
    setStudySeconds(Math.max(0, Math.floor(Number(initialStudySeconds) || 0)));
    setStreak(Math.max(0, Math.floor(Number(initialStreak) || 0)));
  }, [initialExp, initialStudySeconds, initialStreak]);

  const applyAward = useCallback((data, bonusExp = 0) => {
    if (!data) return;
    const newExp = Number(data.exp) || 0;
    const before = getLevelFromExp(expRef.current);
    const after = getLevelFromExp(newExp);

    setExp(newExp);
    if (data.study_seconds != null) setStudySeconds(Number(data.study_seconds) || 0);
    if (data.today_seconds != null) setTodaySeconds(Number(data.today_seconds) || 0);
    if (data.streak != null) setStreak(Number(data.streak) || 0);

    const gained = (Number(data.awarded_exp) || 0) + (Number(bonusExp) || 0);
    if (after.level > before.level) {
      flashIdRef.current += 1;
      setFlash({ id: flashIdRef.current, type: 'levelup', level: after.level, amount: gained });
    } else if (bonusExp > 0) {
      flashIdRef.current += 1;
      setFlash({ id: flashIdRef.current, type: 'checkin', amount: gained });
    } else if (gained > 0) {
      flashIdRef.current += 1;
      setFlash({ id: flashIdRef.current, type: 'exp', amount: gained });
    }
  }, []);

  const keepaliveRpc = useCallback(async (fnName, params) => {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!baseUrl || !anonKey) return;
    let accessToken = anonKey;
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) accessToken = data.session.access_token;
    } catch {
      /* fall back to anon key */
    }
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
    } catch {
      /* page is unloading */
    }
  }, []);

  const saveDraft = useCallback(() => {
    try {
      if (!sessionIdRef.current) return;
      window.localStorage.setItem(
        SESSION_LS_KEY,
        JSON.stringify({
          sessionId: sessionIdRef.current,
          sheetId: sheetIdRef.current,
          subjectId: subjectIdRef.current,
          baseSeconds: displayBaseRef.current,
          savedAt: Date.now(),
        }),
      );
    } catch {
      /* ignore storage errors */
    }
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
    } catch {
      /* ignore */
    }
  }, []);

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

  const adoptSession = useCallback(
    (sessionId, data) => {
      sessionIdRef.current = sessionId;
      modeRef.current = 'session';
      const credited = Number(data?.credited_seconds ?? data?.session_seconds);
      if (Number.isFinite(credited) && credited >= 0) {
        displayBaseRef.current = credited;
      }
      if (data?.today_seconds != null) {
        setTodaySeconds(Number(data.today_seconds) || 0);
      }
      if (data?.idle_blocked && !needsConfirmRef.current) {
        needsConfirmRef.current = true;
        displayAnchorRef.current = null;
        setIdleReason('visible-idle');
      } else {
        displayAnchorRef.current = needsConfirmRef.current ? null : Date.now();
      }
      const checkinBonus = Number(data?.checkin_bonus_exp) || 0;
      if (data?.award) {
        applyAward(data.award, checkinBonus);
      } else if (data?.exp != null) {
        setExp(Number(data.exp) || 0);
        if (data.study_seconds != null) setStudySeconds(Number(data.study_seconds) || 0);
        if (data.streak != null) setStreak(Number(data.streak) || 0);
        if (checkinBonus > 0) {
          flashIdRef.current += 1;
          setFlash({ id: flashIdRef.current, type: 'checkin', amount: checkinBonus });
        }
      }
      setSessionStatus(needsConfirmRef.current ? 'needs-confirm' : 'active');
      saveDraft();
    },
    [applyAward, saveDraft],
  );

  // Helper to call heartbeat_study_session with automatic 4-arg -> 2-arg fallback
  const callHeartbeatRpc = useCallback(
    async ({ sessionId, credit, interacted, checkinVerified }) => {
      if (!legacyHeartbeatArgsRef.current) {
        const res = await supabase.rpc('heartbeat_study_session', {
          p_session_id: sessionId,
          p_credit: credit,
          p_interacted: interacted,
          p_checkin_verified: checkinVerified,
        });
        if (res.error && isMissingFunctionError(res.error)) {
          // Try legacy 2-arg signature before giving up on session mode
          const retry = await supabase.rpc('heartbeat_study_session', {
            p_session_id: sessionId,
            p_credit: credit,
          });
          if (!retry.error) {
            legacyHeartbeatArgsRef.current = true;
            return retry;
          }
          return retry;
        }
        return res;
      }
      return supabase.rpc('heartbeat_study_session', {
        p_session_id: sessionId,
        p_credit: credit,
      });
    },
    [],
  );

  const doHeartbeat = useCallback(
    async (opts = {}) => {
      const sessionId = sessionIdRef.current;
      if (!sessionId || heartbeatBusyRef.current) return;
      heartbeatBusyRef.current = true;

      const checkinVerified = Boolean(
        opts.checkinVerified || checkinVerifiedPendingRef.current,
      );
      const interacted = Boolean(
        opts.interacted ||
          interactedSinceBeatRef.current ||
          checkinVerified ||
          Date.now() - lastInteractionRef.current < HEARTBEAT_MS * 1.5,
      );

      interactedSinceBeatRef.current = false;
      checkinVerifiedPendingRef.current = false;

      try {
        const { data, error } = await callHeartbeatRpc({
          sessionId,
          credit: !needsConfirmRef.current,
          interacted,
          checkinVerified,
        });

        if (error) {
          if (isMissingFunctionError(error)) {
            enterFallback();
          } else if (isSessionGoneError(error)) {
            sessionIdRef.current = null;
            displayAnchorRef.current = null;
            clearDraft();
          }
          return;
        }
        if (data) adoptSession(sessionId, data);
      } catch {
        /* retry on next beat */
      } finally {
        heartbeatBusyRef.current = false;
      }
    },
    [adoptSession, callHeartbeatRpc, clearDraft, enterFallback],
  );

  const ensureSession = useCallback(async () => {
    if (!hasStudyIntentRef.current) {
      setSessionStatus('ready');
      setIdleReason('not-started');
      return;
    }
    if (modeRef.current === 'fallback' || sessionIdRef.current) return;
    if (startingRef.current) return startingRef.current;

    if (!sheetIdRef.current) {
      enterFallback();
      return;
    }

    startingRef.current = (async () => {
      try {
        const draft = readDraft();
        if (
          draft?.sessionId &&
          draft.sheetId === sheetIdRef.current &&
          Date.now() - Number(draft.savedAt || 0) < SESSION_RESUME_MS
        ) {
          displayBaseRef.current = Math.max(0, Number(draft.baseSeconds) || 0);
          const { data, error } = await callHeartbeatRpc({
            sessionId: draft.sessionId,
            credit: !needsConfirmRef.current,
            interacted: true,
            checkinVerified: false,
          });
          if (!error && data) {
            adoptSession(draft.sessionId, data);
            return;
          }
          if (isMissingFunctionError(error)) {
            enterFallback();
            return;
          }
          clearDraft();
        }

        const { data, error } = await supabase.rpc('start_study_session', {
          p_sheet_id: sheetIdRef.current,
          p_subject_id: subjectIdRef.current ?? null,
        });
        if (error) {
          if (isMissingFunctionError(error)) {
            enterFallback();
          }
          return;
        }
        if (data) {
          displayBaseRef.current = 0;
          nextCheckinAtSecRef.current = CHECKIN_INTERVAL_S;
          adoptSession(data, { credited_seconds: 0 });
        }
      } catch {
        /* retry next cycle */
      } finally {
        startingRef.current = null;
      }
    })();
    return startingRef.current;
  }, [adoptSession, callHeartbeatRpc, clearDraft, enterFallback, readDraft]);

  const flushFallback = useCallback(
    async (force = false) => {
      const banked = Math.floor(pendingRef.current);
      const minToSend = force ? 5 : AWARD_THRESHOLD_S;
      if (banked < minToSend || sendingRef.current) return;

      const chunk = Math.min(banked, MAX_CHUNK_S);
      pendingRef.current -= chunk;
      sendingRef.current = true;
      try {
        const { data, error } = await supabase.rpc('award_study_exp', { p_seconds: chunk });
        if (error || !data) {
          pendingRef.current += chunk;
          return;
        }
        fallbackSentRef.current += Number(data.awarded_seconds ?? chunk) || 0;
        applyAward(data);
      } catch {
        pendingRef.current += chunk;
      } finally {
        sendingRef.current = false;
      }
    },
    [applyAward],
  );

  const cycle = useCallback(async () => {
    if (!hasStudyIntentRef.current) {
      setSessionStatus('ready');
      setIdleReason('not-started');
      return;
    }
    if (modeRef.current === 'session') {
      await doHeartbeat();
      return;
    }
    if (modeRef.current === 'fallback') {
      const now = Date.now();
      if (fallbackLastTsRef.current) {
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

  // Public: explicitly start or mark study intent (selecting teacher, opening sheet, etc.)
  const startSession = useCallback(() => {
    hasStudyIntentRef.current = true;
    lastInteractionRef.current = Date.now();
    interactedSinceBeatRef.current = true;
    hiddenSinceRef.current =
      typeof document !== 'undefined' && document.visibilityState === 'hidden'
        ? Date.now()
        : null;
    if (needsConfirmRef.current) {
      needsConfirmRef.current = false;
      setIdleReason('none');
      activeCheckinRef.current = null;
      setCheckinPrompt(null);
      if (modeRef.current === 'session') {
        displayAnchorRef.current = Date.now();
        setSessionStatus('active');
        doHeartbeat({ interacted: true });
        return;
      }
      if (modeRef.current === 'fallback') {
        fallbackLastTsRef.current = Date.now();
        setSessionStatus('fallback');
        return;
      }
    }
    setIdleReason('none');
    ensureSession().catch(() => {});
  }, [doHeartbeat, ensureSession]);

  const confirmContinue = useCallback(() => {
    hasStudyIntentRef.current = true;
    lastInteractionRef.current = Date.now();
    interactedSinceBeatRef.current = true;
    hiddenSinceRef.current = null;
    needsConfirmRef.current = false;
    setIdleReason('none');

    if (activeCheckinRef.current) {
      activeCheckinRef.current = null;
      setCheckinPrompt(null);
      checkinVerifiedPendingRef.current = true;
      nextCheckinAtSecRef.current = computeSessionSeconds() + CHECKIN_INTERVAL_S;
    }

    if (modeRef.current === 'session') {
      displayAnchorRef.current = Date.now();
      setSessionStatus('active');
      doHeartbeat({ interacted: true, checkinVerified: checkinVerifiedPendingRef.current });
    } else if (modeRef.current === 'fallback') {
      fallbackLastTsRef.current = Date.now();
      setSessionStatus('fallback');
    } else {
      ensureSession().catch(() => {});
    }
  }, [computeSessionSeconds, doHeartbeat, ensureSession]);

  // Verify the 25-minute Pomodoro symbol check-in
  const submitCheckin = useCallback(
    (chosenSymbol) => {
      const current = activeCheckinRef.current;
      if (!current) return false;
      if (chosenSymbol !== current.targetSymbol) {
        // Wrong symbol clicked -> generate a fresh one to defeat blind auto-clickers
        checkinSeqRef.current += 1;
        const nextChallenge = createCheckinChallenge(checkinSeqRef.current);
        activeCheckinRef.current = nextChallenge;
        setCheckinPrompt(nextChallenge);
        return false;
      }

      // Verified!
      activeCheckinRef.current = null;
      setCheckinPrompt(null);
      setCheckinRemainingSec(0);
      lastInteractionRef.current = Date.now();
      interactedSinceBeatRef.current = true;
      checkinVerifiedPendingRef.current = true;
      needsConfirmRef.current = false;
      setIdleReason('none');
      nextCheckinAtSecRef.current = computeSessionSeconds() + CHECKIN_INTERVAL_S;

      if (modeRef.current === 'session') {
        if (!displayAnchorRef.current) {
          displayAnchorRef.current = Date.now();
        }
        setSessionStatus('active');
        doHeartbeat({ interacted: true, checkinVerified: true });
      } else if (modeRef.current === 'fallback') {
        fallbackLastTsRef.current = Date.now();
        setSessionStatus('fallback');
      }
      return true;
    },
    [computeSessionSeconds, doHeartbeat],
  );

  const endSession = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    sessionIdRef.current = null;
    displayAnchorRef.current = null;
    hasStudyIntentRef.current = false;
    activeCheckinRef.current = null;
    setCheckinPrompt(null);
    clearDraft();
    if (modeRef.current === 'session' && sessionId) {
      modeRef.current = null;
      try {
        const { data, error } = await supabase.rpc('end_study_session', {
          p_session_id: sessionId,
        });
        if (!error && data?.award) applyAward(data.award);
      } catch {
        /* best effort */
      }
    } else if (modeRef.current === 'fallback') {
      await flushFallback(true);
    }
    setSessionStatus('idle');
    setIdleReason('none');
    setSessionSeconds(0);
    displayBaseRef.current = 0;
    fallbackSentRef.current = 0;
    pendingRef.current = 0;
  }, [applyAward, clearDraft, flushFallback]);

  // --- Layer 1 & 2: User interaction & visibility listeners -----------------
  useEffect(() => {
    if (!enabled) return undefined;
    let lastMoveTs = 0;

    const markInteraction = () => {
      const now = Date.now();
      lastInteractionRef.current = now;
      interactedSinceBeatRef.current = true;
      if (!hasStudyIntentRef.current) {
        hasStudyIntentRef.current = true;
        setIdleReason('none');
        ensureSession().catch(() => {});
      }
    };

    const onPointerMove = () => {
      const now = Date.now();
      if (now - lastMoveTs < POINTER_THROTTLE_MS) return;
      lastMoveTs = now;
      markInteraction();
    };

    const onBlur = () => {
      // Clicking into the embedded Google Sheet iframe blurs the parent window
      // while making the iframe the activeElement — this IS active studying!
      const el = document.activeElement;
      if (el && el.tagName === 'IFRAME') {
        markInteraction();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenSinceRef.current = Date.now();
      } else {
        hiddenSinceRef.current = null;
        lastInteractionRef.current = Date.now();
        interactedSinceBeatRef.current = true;
      }
    };

    document.addEventListener('pointerdown', markInteraction, { passive: true });
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('keydown', markInteraction);
    document.addEventListener('wheel', markInteraction, { passive: true });
    document.addEventListener('scroll', markInteraction, { passive: true });
    document.addEventListener('touchstart', markInteraction, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);

    return () => {
      document.removeEventListener('pointerdown', markInteraction);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('keydown', markInteraction);
      document.removeEventListener('wheel', markInteraction);
      document.removeEventListener('scroll', markInteraction);
      document.removeEventListener('touchstart', markInteraction);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
    };
  }, [enabled, ensureSession]);

  // --- Layer 2 & 3: 1s display clock + Anti-AFK idle & Pomodoro watcher -----
  useEffect(() => {
    if (!enabled) return undefined;
    const id = window.setInterval(() => {
      const now = Date.now();
      const currentSec = computeSessionSeconds();

      if (modeRef.current && !needsConfirmRef.current) {
        const isHidden =
          typeof document !== 'undefined' && document.visibilityState === 'hidden';
        const isIframeFocused =
          typeof document !== 'undefined' &&
          document.activeElement &&
          document.activeElement.tagName === 'IFRAME';

        // If focus is inside the Sheet iframe on a visible tab, keep refreshing interaction
        // up to IFRAME_FOCUS_IDLE_MS
        const maxIdleMs = isHidden
          ? HIDDEN_STUDY_WINDOW_MS
          : isIframeFocused
            ? IFRAME_FOCUS_IDLE_MS
            : VISIBLE_IDLE_MS;

        const idleElapsed = isHidden && hiddenSinceRef.current
          ? now - hiddenSinceRef.current
          : now - lastInteractionRef.current;

        if (idleElapsed > maxIdleMs) {
          displayBaseRef.current = currentSec;
          displayAnchorRef.current = null;
          needsConfirmRef.current = true;
          setIdleReason(isHidden ? 'hidden-timeout' : 'visible-idle');
          setSessionStatus('needs-confirm');
          setIsAccruing(false);
        }

        // Layer 3: Trigger 25-minute Pomodoro check-in
        if (
          !needsConfirmRef.current &&
          !activeCheckinRef.current &&
          currentSec >= nextCheckinAtSecRef.current
        ) {
          checkinSeqRef.current += 1;
          const challenge = createCheckinChallenge(checkinSeqRef.current);
          activeCheckinRef.current = challenge;
          setCheckinPrompt(challenge);
          setCheckinRemainingSec(Math.ceil(CHECKIN_GRACE_MS / 1000));
        }

        // Check if active Pomodoro check-in grace window expired (3 minutes)
        if (activeCheckinRef.current) {
          const remMs = activeCheckinRef.current.expiresAt - now;
          if (remMs <= 0) {
            displayBaseRef.current = currentSec;
            displayAnchorRef.current = null;
            needsConfirmRef.current = true;
            setIdleReason('checkin-expired');
            setSessionStatus('needs-confirm');
            setIsAccruing(false);
            setCheckinRemainingSec(0);
          } else {
            setCheckinRemainingSec(Math.ceil(remMs / 1000));
          }
        }
      }

      setSessionSeconds(computeSessionSeconds());
      setIsAccruing(
        Boolean(modeRef.current) && hasStudyIntentRef.current && !needsConfirmRef.current,
      );
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [enabled, computeSessionSeconds]);

  // --- Lifecycle: start/resume, heartbeat loop, pagehide, cleanup -----------
  useEffect(() => {
    if (!enabled) {
      setIsAccruing(false);
      setSessionStatus('idle');
      return undefined;
    }

    // Resume immediately if there is a fresh draft (< 5 min old) for this sheet;
    // otherwise wait for user interaction (Layer 1 Study Intent Gate).
    const draft = readDraft();
    const hasFreshDraft = Boolean(
      draft?.sessionId &&
        draft.sheetId === sheetId &&
        Date.now() - Number(draft.savedAt || 0) < SESSION_RESUME_MS,
    );

    if (hasFreshDraft) {
      hasStudyIntentRef.current = true;
    }

    lastInteractionRef.current = Date.now();
    needsConfirmRef.current = false;
    nextCheckinAtSecRef.current = CHECKIN_INTERVAL_S;
    activeCheckinRef.current = null;
    setCheckinPrompt(null);

    cycle();
    const jitteredIntervalMs =
      HEARTBEAT_MS + Math.floor(Math.random() * HEARTBEAT_JITTER_MS) - 4000;
    const intervalId = window.setInterval(cycle, jitteredIntervalMs);

    const onPageHide = () => {
      if (modeRef.current === 'session' && sessionIdRef.current) {
        saveDraft();
        keepaliveRpc(
          'heartbeat_study_session',
          legacyHeartbeatArgsRef.current
            ? {
                p_session_id: sessionIdRef.current,
                p_credit: !needsConfirmRef.current,
              }
            : {
                p_session_id: sessionIdRef.current,
                p_credit: !needsConfirmRef.current,
                p_interacted: interactedSinceBeatRef.current,
                p_checkin_verified: false,
              },
        );
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
      if (modeRef.current === 'session' && sessionIdRef.current) {
        const closingId = sessionIdRef.current;
        sessionIdRef.current = null;
        clearDraft();
        keepaliveRpc('end_study_session', { p_session_id: closingId }).finally(() =>
          onSyncRef.current?.(),
        );
      } else if (modeRef.current === 'fallback') {
        flushFallback(true).finally(() => onSyncRef.current?.());
      } else {
        onSyncRef.current?.();
      }
      if (modeRef.current === 'session') modeRef.current = null;
      displayBaseRef.current = 0;
      displayAnchorRef.current = null;
      fallbackSentRef.current = 0;
      fallbackLastTsRef.current = null;
      activeCheckinRef.current = null;
      setCheckinPrompt(null);
      setSessionSeconds(0);
      setSessionStatus('idle');
    };
  }, [enabled, sheetId, subjectId, cycle, flushFallback, keepaliveRpc, saveDraft, clearDraft, readDraft]);

  const clearFlash = useCallback(() => setFlash(null), []);
  const levelInfo = getLevelFromExp(exp);
  const todayMinutes = Math.floor(Math.max(0, todaySeconds) / 60);

  return {
    exp,
    studySeconds,
    todaySeconds,
    todayMinutes,
    streak,
    level: levelInfo.level,
    levelInfo,
    isAccruing,
    flash,
    clearFlash,
    sessionStatus,
    sessionSeconds,
    idleReason,
    checkinPrompt,
    checkinRemainingSec,
    submitCheckin,
    startSession,
    confirmContinue,
    endSession,
  };
}
