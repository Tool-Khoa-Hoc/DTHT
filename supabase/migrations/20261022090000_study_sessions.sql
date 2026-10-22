/*
  Study sessions — EXP v2 (October 2026)
  --------------------------------------------------------------------------
  GOAL: fix the "switch tab = stop earning EXP" flaw of the July 2026 system.
  The old client tracker only accrued time while the DTHT tab was visible,
  but the real study flow (open the Google Sheet in a new tab / follow a
  lesson link inside the Sheet) always hides the DTHT tab — so whole study
  sessions earned 0 EXP.

  NEW MODEL: an explicit study session, kept alive by heartbeats.
    - start_study_session()   opens a session for one sheet,
    - heartbeat_study_session() credits elapsed time (computed from the
      SERVER clock, capped at 90s per beat) through the existing
      award_study_exp() — so the wall-clock clamp, the 120s chunk limit and
      the 5h/day cap of the July system all keep applying unchanged,
    - end_study_session()     final heartbeat + close.
  Visibility of the DTHT tab no longer gates anything; anti-farming relies
  on the server-side clamps (per-beat cap + wall-clock + daily cap), exactly
  like the July design intended.

  This migration ONLY adds new objects. profiles / study_daily /
  award_study_exp() from 20260726120000_add_study_exp_system.sql are
  untouched, and the client falls back to the legacy award path when these
  functions are not deployed yet, so rollout order is safe either way.

  SECURITY: study_sessions has SELECT-own RLS and no client write path;
  all writes go through the SECURITY DEFINER RPCs below, which only ever
  touch sessions owned by auth.uid().
*/

-- 1. Sessions table --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id        text,
  sheet_id          text NOT NULL,
  started_at        timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  ended_at          timestamptz,
  credited_seconds  integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_open
  ON public.study_sessions (user_id, ended_at);

COMMENT ON TABLE public.study_sessions IS 'Phiên học online (EXP v2): heartbeat server-side thay cho visibility gate. Chỉ ghi qua start/heartbeat/end_study_session().';
COMMENT ON COLUMN public.study_sessions.credited_seconds IS 'Số giây đã được award_study_exp() xác thực trong phiên (sau clamp).';

ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "study_sessions_select_own" ON public.study_sessions;
CREATE POLICY "study_sessions_select_own" ON public.study_sessions
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- No INSERT/UPDATE/DELETE policy: clients cannot write directly. The
-- definer RPCs (owned by postgres) bypass RLS and are the only writers.
REVOKE ALL ON public.study_sessions FROM anon, authenticated;
GRANT SELECT ON public.study_sessions TO authenticated;

-- 2. Open a session ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_study_session(
  p_sheet_id   text,
  p_subject_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_sheet_id IS NULL OR length(trim(p_sheet_id)) = 0 THEN
    RAISE EXCEPTION 'sheet_id is required';
  END IF;

  -- One open session per user: close any stale one left behind by a
  -- crashed tab / dropped connection before opening the new session.
  UPDATE public.study_sessions
     SET ended_at = now()
   WHERE user_id = v_uid
     AND ended_at IS NULL;

  INSERT INTO public.study_sessions (user_id, subject_id, sheet_id)
       VALUES (v_uid, p_subject_id, p_sheet_id)
    RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_study_session(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.start_study_session(text, text) TO authenticated;

-- 3. Heartbeat: credit elapsed time through the existing award path -------
CREATE OR REPLACE FUNCTION public.heartbeat_study_session(
  p_session_id uuid,
  p_credit     boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid        := auth.uid();
  v_now       timestamptz := now();
  v_session   public.study_sessions%ROWTYPE;
  v_delta     integer;
  v_credit    integer := 0;
  v_award     jsonb := NULL;
  v_credited  integer;
  v_exp       bigint;
  v_streak    integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_session
    FROM public.study_sessions
   WHERE id = p_session_id
     AND user_id = v_uid
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Study session not found';
  END IF;
  IF v_session.ended_at IS NOT NULL THEN
    RAISE EXCEPTION 'Study session already ended';
  END IF;

  -- Credit is computed from the SERVER clock and capped per beat, so a
  -- throttled background tab (timers slowed to ~1/min) still earns its
  -- real time, while a forgotten tab can never claim a huge lump at once.
  v_delta := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_now - v_session.last_heartbeat_at)))::int);
  IF COALESCE(p_credit, true) THEN
    v_credit := LEAST(v_delta, 90);
  END IF;

  IF v_credit > 0 THEN
    -- Reuse the July award path wholesale: it re-clamps to wall-clock
    -- since the last award and enforces the 5h/day cap, then returns the
    -- caller's fresh totals. awarded_seconds is what was *really*
    -- credited after those clamps.
    v_award    := public.award_study_exp(v_credit);
    v_credited := COALESCE((v_award ->> 'awarded_seconds')::int, 0);
  ELSE
    v_credited := 0;
  END IF;

  UPDATE public.study_sessions
     SET credited_seconds  = credited_seconds + v_credited,
         last_heartbeat_at = v_now
   WHERE id = p_session_id
   RETURNING credited_seconds INTO v_session.credited_seconds;

  IF v_award IS NOT NULL THEN
    v_exp    := (v_award ->> 'exp')::bigint;
    v_streak := (v_award ->> 'streak')::int;
  ELSE
    SELECT exp, study_streak INTO v_exp, v_streak
      FROM public.profiles WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'session_id',       p_session_id,
    'credited_seconds', v_session.credited_seconds,
    'session_seconds',  v_session.credited_seconds,
    'elapsed_seconds',  GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_now - v_session.started_at)))::int),
    'awarded_seconds',  v_credited,
    'awarded_exp',      COALESCE((v_award ->> 'awarded_exp')::int, 0),
    'exp',              COALESCE(v_exp, 0),
    'streak',           COALESCE(v_streak, 0),
    'award',            v_award,
    'ended',            false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.heartbeat_study_session(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.heartbeat_study_session(uuid, boolean) TO authenticated;

-- 4. Close a session (final heartbeat first) -------------------------------
CREATE OR REPLACE FUNCTION public.end_study_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_session public.study_sessions%ROWTYPE;
  v_result  jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_session
    FROM public.study_sessions
   WHERE id = p_session_id
     AND user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Study session not found';
  END IF;

  -- Already closed (e.g. superseded by a newer session): report totals
  -- instead of raising, so client cleanup can call this unconditionally.
  IF v_session.ended_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'session_id',       p_session_id,
      'credited_seconds', v_session.credited_seconds,
      'session_seconds',  v_session.credited_seconds,
      'awarded_seconds',  0,
      'awarded_exp',      0,
      'award',            NULL,
      'ended',            true
    );
  END IF;

  -- Final heartbeat credits the tail (same 90s per-beat cap), then close.
  v_result := public.heartbeat_study_session(p_session_id, true);

  UPDATE public.study_sessions
     SET ended_at = now()
   WHERE id = p_session_id;

  RETURN v_result || jsonb_build_object('ended', true);
END;
$$;

REVOKE ALL ON FUNCTION public.end_study_session(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.end_study_session(uuid) TO authenticated;
