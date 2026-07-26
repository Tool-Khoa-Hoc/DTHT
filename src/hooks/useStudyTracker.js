import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getLevelFromExp } from '../utils/levelHelper';

/*
 * useStudyTracker — accrues study time while a lesson is open and the tab is
 * visible, then credits it through the server-authoritative award_study_exp()
 * RPC. The client only ever *reports* elapsed seconds; the server clamps them
 * to real wall-clock time and the daily cap, so nothing here is trusted.
 *
 * Note on the embedded Google Sheet: it is cross-origin, so we cannot observe
 * interaction inside it. We therefore gate purely on document visibility
 * (switching tabs / minimising pauses accrual) and lean on the server's
 * wall-clock + daily-cap guards to bound AFK farming.
 */

const TICK_MS = 15000;        // sample cadence
const AWARD_THRESHOLD_S = 30; // send once this many seconds have banked
const MAX_CHUNK_S = 120;      // RPC rejects anything above this anyway
const MAX_DELTA_S = (TICK_MS / 1000) * 2; // guard against long timer stalls

export function useStudyTracker({
  enabled = false,
  initialExp,
  initialStudySeconds,
  initialStreak,
  onSync,
} = {}) {
  const [exp, setExp] = useState(0);
  const [studySeconds, setStudySeconds] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isAccruing, setIsAccruing] = useState(false);
  const [flash, setFlash] = useState(null); // { id, type:'exp'|'levelup', amount, level }

  const pendingRef = useRef(0);      // banked seconds not yet sent
  const lastTsRef = useRef(null);    // ms timestamp of previous sample
  const sendingRef = useRef(false);
  const expRef = useRef(0);
  const flashIdRef = useRef(0);
  const seededRef = useRef(false);
  const onSyncRef = useRef(onSync);

  expRef.current = exp;
  onSyncRef.current = onSync;

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

  const flush = useCallback(async (force = false) => {
    const banked = Math.floor(pendingRef.current);
    const minToSend = force ? 5 : AWARD_THRESHOLD_S;
    if (banked < minToSend || sendingRef.current) return;

    const chunk = Math.min(banked, MAX_CHUNK_S);
    pendingRef.current -= chunk;
    sendingRef.current = true;
    try {
      const { data, error } = await supabase.rpc('award_study_exp', { p_seconds: chunk });
      // On any error (incl. RPC not yet deployed) drop the chunk silently —
      // better to lose a few seconds than to spam or crash the study page.
      if (error || !data) return;

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
    } catch {
      /* network hiccup: chunk already dropped, stay quiet */
    } finally {
      sendingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsAccruing(false);
      return undefined;
    }

    lastTsRef.current = Date.now();

    const sample = () => {
      const now = Date.now();
      const active = document.visibilityState === 'visible';
      if (active && lastTsRef.current) {
        const delta = Math.min((now - lastTsRef.current) / 1000, MAX_DELTA_S);
        if (delta > 0) pendingRef.current += delta;
      }
      lastTsRef.current = now;
      setIsAccruing(active);
      if (pendingRef.current >= AWARD_THRESHOLD_S) flush(false);
    };

    const intervalId = window.setInterval(sample, TICK_MS);

    const onVisibility = () => {
      const now = Date.now();
      if (document.visibilityState === 'visible') {
        lastTsRef.current = now; // don't credit the hidden stretch
      } else {
        if (lastTsRef.current) {
          const delta = Math.min((now - lastTsRef.current) / 1000, MAX_DELTA_S);
          if (delta > 0) pendingRef.current += delta;
        }
        lastTsRef.current = now;
        setIsAccruing(false);
        flush(true);
      }
    };
    const onPageHide = () => flush(true);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      setIsAccruing(false);
      // Lesson closed / unmount: bank remaining time, then refresh the profile
      // so other pages see the new EXP total.
      flush(true).finally(() => onSyncRef.current?.());
    };
  }, [enabled, flush]);

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
  };
}
