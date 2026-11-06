/*
  Daily Top Scholars ("Sĩ tử tiêu biểu theo phút học trong ngày") & Anti-AFK System
  Date: 2026-11-06
  --------------------------------------------------------------------------
  GOALS:
    1. Separate daily EXP cap (5 hours = 18,000s / 3,000 EXP) from verified daily
       study time (`study_daily.seconds` & `profiles.study_seconds`), so students
       who study > 5 hours in a single day are still accurately ranked by their
       real study minutes on the daily leaderboard.
    2. Add Multi-Layer Anti-AFK server enforcement on `study_sessions` and
       `heartbeat_study_session`:
         - Tracks `last_interaction_at` and `checkin_due_at` (Pomodoro 25-28m check-in).
         - Refuses to credit time if `now() - last_interaction_at > 22 minutes`
           or if the periodic check-in window has expired without verification.
         - Reconciles legacy `study_sessions` schema if present (`subject_id` text).
    3. Add index `idx_study_daily_leaderboard` on `study_daily (study_date, seconds DESC, updated_at ASC)`.
    4. Extend `public_profile_view` with `is_vip`, `today_seconds`, `today_minutes`,
       `today_exp`, and `last_study_date`.
    5. Create `get_daily_top_scholars(p_limit, p_fallback)` (Option A):
         - Ranks scholars who studied today (`study_date = today_vn`, `seconds >= 60`)
           by `today_seconds DESC, updated_at ASC`.
         - When `p_fallback = true` and fewer than `p_limit` scholars have studied
           today (e.g. early morning), fills remaining slots from yesterday's top
           learners / highest EXP scholars (`is_today = false`).
*/

-- 1. Ensure study_daily table & daily leaderboard index exist --------------
CREATE TABLE IF NOT EXISTS public.study_daily (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_date date NOT NULL,
  seconds    integer NOT NULL DEFAULT 0,
  exp        integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, study_date)
);

CREATE INDEX IF NOT EXISTS idx_study_daily_leaderboard
  ON public.study_daily (study_date, seconds DESC, updated_at ASC)
  WHERE seconds > 0;

-- 2. Reconcile & upgrade study_sessions schema for Anti-AFK ----------------
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id          text,
  sheet_id            text NOT NULL DEFAULT 'general',
  started_at          timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at   timestamptz NOT NULL DEFAULT now(),
  last_interaction_at timestamptz NOT NULL DEFAULT now(),
  checkin_due_at      timestamptz NOT NULL DEFAULT (now() + interval '28 minutes'),
  ended_at            timestamptz,
  credited_seconds    integer NOT NULL DEFAULT 0
);

DO $$
BEGIN
  -- If legacy study_sessions had subject_id as uuid FK -> subjects(id), convert to text
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'study_sessions'
      AND constraint_name = 'study_sessions_subject_id_fkey'
  ) THEN
    ALTER TABLE public.study_sessions DROP CONSTRAINT study_sessions_subject_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'study_sessions'
      AND column_name = 'subject_id'
      AND data_type <> 'text'
  ) THEN
    DROP INDEX IF EXISTS public.idx_study_sessions_subject_id;
    ALTER TABLE public.study_sessions
      ALTER COLUMN subject_id TYPE text USING subject_id::text;
  END IF;

  -- If legacy duration_minutes column exists and is NOT NULL, make it nullable with default 0
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'study_sessions'
      AND column_name = 'duration_minutes'
  ) THEN
    ALTER TABLE public.study_sessions
      ALTER COLUMN duration_minutes SET DEFAULT 0,
      ALTER COLUMN duration_minutes DROP NOT NULL;
  END IF;

  -- Add missing v2 + Anti-AFK columns safely
  ALTER TABLE public.study_sessions
    ADD COLUMN IF NOT EXISTS sheet_id            text NOT NULL DEFAULT 'general',
    ADD COLUMN IF NOT EXISTS started_at          timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS last_heartbeat_at   timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS checkin_due_at      timestamptz NOT NULL DEFAULT (now() + interval '28 minutes'),
    ADD COLUMN IF NOT EXISTS ended_at            timestamptz,
    ADD COLUMN IF NOT EXISTS credited_seconds    integer NOT NULL DEFAULT 0;
END $$;

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_open
  ON public.study_sessions (user_id, ended_at);

-- 3. Upgrade award_study_exp(): separate 5h EXP cap from real study minutes -
CREATE OR REPLACE FUNCTION public.award_study_exp(p_seconds integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid              uuid        := auth.uid();
  v_now              timestamptz := now();
  v_today            date        := (v_now AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  v_last_award       timestamptz;
  v_streak           integer;
  v_last_study       date;
  v_elapsed          numeric;
  v_raw_credit       integer;
  v_time_credit      integer;
  v_exp_credit       integer;
  v_today_seconds    integer := 0;
  v_time_remaining   integer;
  v_exp_remaining    integer;
  v_exp_gain         integer := 0;
  v_streak_bonus     integer := 0;
  v_first_today      boolean := false;
  v_total_exp        bigint;
  v_total_seconds    bigint;
  v_new_today_sec    integer;
  c_exp_cap_seconds  constant integer := 18000; -- 5h/day EXP cap (3,000 EXP)
  c_time_cap_seconds constant integer := 50400; -- 14h/day human study sanity cap
  c_exp_per_min      constant integer := 10;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- A single heartbeat may never claim more than 120 real seconds.
  p_seconds := GREATEST(0, LEAST(COALESCE(p_seconds, 0), 120));

  SELECT last_exp_award_at, study_streak, last_study_date
    INTO v_last_award, v_streak, v_last_study
    FROM public.profiles WHERE id = v_uid FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  SELECT seconds INTO v_today_seconds
    FROM public.study_daily
   WHERE user_id = v_uid AND study_date = v_today;
  v_today_seconds := COALESCE(v_today_seconds, 0);

  IF p_seconds = 0 THEN
    SELECT exp, study_seconds INTO v_total_exp, v_total_seconds
      FROM public.profiles WHERE id = v_uid;
    RETURN jsonb_build_object(
      'awarded_exp', 0,
      'awarded_seconds', 0,
      'today_seconds', v_today_seconds,
      'today_minutes', FLOOR(v_today_seconds / 60.0)::int,
      'streak_bonus', 0,
      'exp', COALESCE(v_total_exp, 0),
      'study_seconds', COALESCE(v_total_seconds, 0),
      'streak', COALESCE(v_streak, 0),
      'capped', v_today_seconds >= c_exp_cap_seconds
    );
  END IF;

  -- Wall-clock clamp: cannot credit more than real time elapsed since the
  -- previous award (+5s grace). Defeats rapid-fire RPC farming.
  IF v_last_award IS NULL THEN
    v_raw_credit := p_seconds;
  ELSE
    v_elapsed    := EXTRACT(EPOCH FROM (v_now - v_last_award));
    v_raw_credit := LEAST(p_seconds, FLOOR(v_elapsed)::int + 5);
  END IF;
  v_raw_credit := GREATEST(0, v_raw_credit);

  -- Separate time credit (up to 14h/day for daily study minutes leaderboard)
  -- from EXP credit (strictly capped at 5h/day = 18,000s).
  v_time_remaining := GREATEST(0, c_time_cap_seconds - v_today_seconds);
  v_time_credit    := LEAST(v_raw_credit, v_time_remaining);

  v_exp_remaining  := GREATEST(0, c_exp_cap_seconds - v_today_seconds);
  v_exp_credit     := LEAST(v_time_credit, v_exp_remaining);

  IF v_time_credit <= 0 THEN
    SELECT exp, study_seconds INTO v_total_exp, v_total_seconds
      FROM public.profiles WHERE id = v_uid;
    RETURN jsonb_build_object(
      'awarded_exp', 0,
      'awarded_seconds', 0,
      'today_seconds', v_today_seconds,
      'today_minutes', FLOOR(v_today_seconds / 60.0)::int,
      'streak_bonus', 0,
      'exp', COALESCE(v_total_exp, 0),
      'study_seconds', COALESCE(v_total_seconds, 0),
      'streak', COALESCE(v_streak, 0),
      'capped', true
    );
  END IF;

  v_exp_gain := FLOOR(v_exp_credit * c_exp_per_min / 60.0)::int;

  -- Streak: only the first credited study of the day moves it + pays bonus.
  IF v_last_study IS NULL OR v_last_study < v_today THEN
    v_first_today := true;
    IF v_last_study = (v_today - 1) THEN
      v_streak := COALESCE(v_streak, 0) + 1;
    ELSE
      v_streak := 1;
    END IF;
    v_streak_bonus := LEAST(v_streak, 7) * 20;
  END IF;

  v_exp_gain := v_exp_gain + v_streak_bonus;

  -- Authorize the protected-column write for THIS transaction only.
  PERFORM set_config('app.exp_ctx', 'on', true);

  UPDATE public.profiles
     SET exp               = exp + v_exp_gain,
         study_seconds     = study_seconds + v_time_credit,
         last_exp_award_at = v_now,
         study_streak      = CASE WHEN v_first_today THEN v_streak ELSE study_streak END,
         last_study_date   = CASE WHEN v_first_today THEN v_today  ELSE last_study_date END
   WHERE id = v_uid
   RETURNING exp, study_seconds, study_streak
        INTO v_total_exp, v_total_seconds, v_streak;

  INSERT INTO public.study_daily (user_id, study_date, seconds, exp, updated_at)
       VALUES (v_uid, v_today, v_time_credit, v_exp_gain, v_now)
  ON CONFLICT (user_id, study_date)
  DO UPDATE SET seconds    = public.study_daily.seconds + EXCLUDED.seconds,
                exp        = public.study_daily.exp + EXCLUDED.exp,
                updated_at = v_now
  RETURNING seconds INTO v_new_today_sec;

  RETURN jsonb_build_object(
    'awarded_exp',     v_exp_gain,
    'awarded_seconds', v_time_credit,
    'today_seconds',   COALESCE(v_new_today_sec, v_today_seconds + v_time_credit),
    'today_minutes',   FLOOR(COALESCE(v_new_today_sec, v_today_seconds + v_time_credit) / 60.0)::int,
    'streak_bonus',    v_streak_bonus,
    'exp',             v_total_exp,
    'study_seconds',   v_total_seconds,
    'streak',          v_streak,
    'capped',          (v_exp_remaining - v_exp_credit) <= 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.award_study_exp(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.award_study_exp(integer) TO authenticated;

-- 4. Upgrade Session RPCs with Server-side Anti-AFK & Pomodoro Check-in ----
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
  v_uid uuid        := auth.uid();
  v_now timestamptz := now();
  v_id  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_sheet_id IS NULL OR length(trim(p_sheet_id)) = 0 THEN
    RAISE EXCEPTION 'sheet_id is required';
  END IF;

  UPDATE public.study_sessions
     SET ended_at = v_now
   WHERE user_id = v_uid
     AND ended_at IS NULL;

  INSERT INTO public.study_sessions (
    user_id,
    subject_id,
    sheet_id,
    started_at,
    last_heartbeat_at,
    last_interaction_at,
    checkin_due_at
  )
  VALUES (
    v_uid,
    p_subject_id,
    p_sheet_id,
    v_now,
    v_now,
    v_now,
    v_now + interval '28 minutes'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_study_session(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.start_study_session(text, text) TO authenticated;

-- Drop old 2-arg signature first to avoid PostgREST overload ambiguity
DROP FUNCTION IF EXISTS public.heartbeat_study_session(uuid, boolean);

CREATE OR REPLACE FUNCTION public.heartbeat_study_session(
  p_session_id       uuid,
  p_credit           boolean DEFAULT true,
  p_interacted       boolean DEFAULT true,
  p_checkin_verified boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid              uuid        := auth.uid();
  v_now              timestamptz := now();
  v_today            date        := (v_now AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  v_session          public.study_sessions%ROWTYPE;
  v_delta            integer;
  v_credit           integer := 0;
  v_award            jsonb := NULL;
  v_credited         integer := 0;
  v_checkin_bonus    integer := 0;
  v_exp              bigint;
  v_streak           integer;
  v_today_seconds    integer := 0;
  v_idle_blocked     boolean := false;
  v_checkin_required boolean := false;
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

  -- Update interaction timestamp when client reports genuine user activity
  IF COALESCE(p_interacted, false) OR COALESCE(p_checkin_verified, false) THEN
    v_session.last_interaction_at := v_now;
  END IF;

  -- Handle Pomodoro 25-minute check-in verification
  IF COALESCE(p_checkin_verified, false) THEN
    v_session.checkin_due_at := v_now + interval '28 minutes';

    -- Grant +10 EXP focus bonus if under the daily 5h EXP cap
    SELECT COALESCE(seconds, 0) INTO v_today_seconds
      FROM public.study_daily
     WHERE user_id = v_uid AND study_date = v_today;

    IF v_today_seconds < 18000 THEN
      v_checkin_bonus := 10;
      PERFORM set_config('app.exp_ctx', 'on', true);
      UPDATE public.profiles
         SET exp = exp + v_checkin_bonus
       WHERE id = v_uid;

      INSERT INTO public.study_daily (user_id, study_date, seconds, exp, updated_at)
           VALUES (v_uid, v_today, 0, v_checkin_bonus, v_now)
      ON CONFLICT (user_id, study_date)
      DO UPDATE SET exp        = public.study_daily.exp + v_checkin_bonus,
                    updated_at = v_now;
    END IF;
  END IF;

  -- Server-side Anti-AFK guards:
  -- 1. No interaction for > 22 minutes -> block credit
  -- 2. Past checkin_due_at without verification -> block credit
  IF (v_now - v_session.last_interaction_at) > interval '22 minutes' THEN
    v_idle_blocked := true;
  END IF;

  IF v_now > v_session.checkin_due_at AND NOT COALESCE(p_checkin_verified, false) THEN
    v_idle_blocked     := true;
    v_checkin_required := true;
  ELSIF v_now >= (v_session.checkin_due_at - interval '3 minutes') THEN
    v_checkin_required := true;
  END IF;

  v_delta := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_now - v_session.last_heartbeat_at)))::int);
  IF COALESCE(p_credit, true) AND NOT v_idle_blocked THEN
    v_credit := LEAST(v_delta, 90);
  END IF;

  IF v_credit > 0 THEN
    v_award    := public.award_study_exp(v_credit);
    v_credited := COALESCE((v_award ->> 'awarded_seconds')::int, 0);
  ELSE
    v_credited := 0;
  END IF;

  UPDATE public.study_sessions
     SET credited_seconds    = credited_seconds + v_credited,
         last_heartbeat_at   = v_now,
         last_interaction_at = v_session.last_interaction_at,
         checkin_due_at      = v_session.checkin_due_at
   WHERE id = p_session_id
   RETURNING credited_seconds INTO v_session.credited_seconds;

  SELECT exp, study_streak INTO v_exp, v_streak
    FROM public.profiles WHERE id = v_uid;

  SELECT COALESCE(seconds, 0) INTO v_today_seconds
    FROM public.study_daily
   WHERE user_id = v_uid AND study_date = v_today;

  RETURN jsonb_build_object(
    'session_id',        p_session_id,
    'credited_seconds',  v_session.credited_seconds,
    'session_seconds',   v_session.credited_seconds,
    'elapsed_seconds',   GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_now - v_session.started_at)))::int),
    'awarded_seconds',   v_credited,
    'awarded_exp',       COALESCE((v_award ->> 'awarded_exp')::int, 0) + v_checkin_bonus,
    'checkin_bonus_exp', v_checkin_bonus,
    'exp',               COALESCE(v_exp, 0),
    'streak',            COALESCE(v_streak, 0),
    'today_seconds',     COALESCE(v_today_seconds, 0),
    'today_minutes',     FLOOR(COALESCE(v_today_seconds, 0) / 60.0)::int,
    'idle_blocked',      v_idle_blocked,
    'checkin_required',  v_checkin_required,
    'award',             v_award,
    'ended',             false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.heartbeat_study_session(uuid, boolean, boolean, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.heartbeat_study_session(uuid, boolean, boolean, boolean) TO authenticated;

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

  v_result := public.heartbeat_study_session(p_session_id, true, false, false);

  UPDATE public.study_sessions
     SET ended_at = now()
   WHERE id = p_session_id;

  RETURN v_result || jsonb_build_object('ended', true);
END;
$$;

REVOKE ALL ON FUNCTION public.end_study_session(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.end_study_session(uuid) TO authenticated;

-- 5. Expose today's study minutes on public_profile_view -------------------
CREATE OR REPLACE VIEW public.public_profile_view
WITH (security_invoker = false) AS
SELECT
  p.id,
  p.display_name,
  p.avatar_url,
  p.role,
  p.university,
  p.user_mode,
  p.target_gpa,
  p.target_thpt,
  p.target_dgnl,
  p.current_gpa,
  p.is_approved_bang_chu,
  p.exp,
  p.study_seconds,
  p.study_streak,
  p.is_vip,
  COALESCE(sd.seconds, 0) AS today_seconds,
  FLOOR(COALESCE(sd.seconds, 0) / 60.0)::integer AS today_minutes,
  COALESCE(sd.exp, 0) AS today_exp,
  p.last_study_date
FROM public.profiles p
LEFT JOIN public.study_daily sd
  ON sd.user_id = p.id
 AND sd.study_date = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;

REVOKE ALL ON public.public_profile_view FROM anon, authenticated;
GRANT SELECT ON public.public_profile_view TO anon, authenticated;

-- 6. Dedicated RPC: get_daily_top_scholars (Option A: Today + Smart Fill) --
CREATE OR REPLACE FUNCTION public.get_daily_top_scholars(
  p_limit    integer DEFAULT 5,
  p_fallback boolean DEFAULT true
)
RETURNS TABLE (
  id                   uuid,
  display_name         text,
  avatar_url           text,
  role                 text,
  university           text,
  user_mode            text,
  target_gpa           numeric,
  target_thpt          numeric,
  target_dgnl          numeric,
  current_gpa          numeric,
  is_approved_bang_chu boolean,
  is_vip               boolean,
  exp                  bigint,
  study_seconds        bigint,
  study_streak         integer,
  today_seconds        integer,
  today_minutes        integer,
  today_exp            integer,
  is_today             boolean,
  rank                 integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 5), 100));
  v_today date    := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
BEGIN
  RETURN QUERY
  WITH today_learners AS (
    SELECT
      p.id,
      p.display_name,
      p.avatar_url,
      p.role,
      p.university,
      p.user_mode,
      p.target_gpa,
      p.target_thpt,
      p.target_dgnl,
      p.current_gpa,
      p.is_approved_bang_chu,
      p.is_vip,
      COALESCE(p.exp, 0)::bigint AS exp,
      COALESCE(p.study_seconds, 0)::bigint AS study_seconds,
      COALESCE(p.study_streak, 0)::integer AS study_streak,
      sd.seconds::integer AS today_seconds,
      FLOOR(sd.seconds / 60.0)::integer AS today_minutes,
      sd.exp::integer AS today_exp,
      true AS is_today,
      1 AS bucket_order,
      sd.seconds AS sort_primary,
      COALESCE(p.exp, 0)::bigint AS sort_secondary,
      sd.updated_at AS sort_time
    FROM public.study_daily sd
    INNER JOIN public.profiles p ON p.id = sd.user_id
    WHERE sd.study_date = v_today
      AND sd.seconds >= 60
    ORDER BY sd.seconds DESC, sd.updated_at ASC, p.exp DESC
    LIMIT v_limit
  ),
  fallback_learners AS (
    SELECT
      p.id,
      p.display_name,
      p.avatar_url,
      p.role,
      p.university,
      p.user_mode,
      p.target_gpa,
      p.target_thpt,
      p.target_dgnl,
      p.current_gpa,
      p.is_approved_bang_chu,
      p.is_vip,
      COALESCE(p.exp, 0)::bigint AS exp,
      COALESCE(p.study_seconds, 0)::bigint AS study_seconds,
      COALESCE(p.study_streak, 0)::integer AS study_streak,
      COALESCE(sd_today.seconds, 0)::integer AS today_seconds,
      FLOOR(COALESCE(sd_today.seconds, 0) / 60.0)::integer AS today_minutes,
      COALESCE(sd_today.exp, 0)::integer AS today_exp,
      false AS is_today,
      2 AS bucket_order,
      COALESCE(sd_yest.seconds, 0)::integer AS sort_primary,
      COALESCE(p.exp, 0)::bigint AS sort_secondary,
      COALESCE(p.updated_at, p.created_at, now()) AS sort_time
    FROM public.profiles p
    LEFT JOIN public.study_daily sd_today
      ON sd_today.user_id = p.id AND sd_today.study_date = v_today
    LEFT JOIN public.study_daily sd_yest
      ON sd_yest.user_id = p.id AND sd_yest.study_date = (v_today - 1)
    WHERE COALESCE(p_fallback, true) = true
      AND NOT EXISTS (SELECT 1 FROM today_learners tl WHERE tl.id = p.id)
    ORDER BY
      COALESCE(sd_yest.seconds, 0) DESC,
      COALESCE(p.exp, 0) DESC,
      COALESCE(p.study_seconds, 0) DESC,
      COALESCE(p.is_approved_bang_chu, false) DESC
    LIMIT GREATEST(0, v_limit - (SELECT count(*)::integer FROM today_learners))
  ),
  combined AS (
    SELECT * FROM today_learners
    UNION ALL
    SELECT * FROM fallback_learners
  )
  SELECT
    c.id,
    c.display_name,
    c.avatar_url,
    c.role,
    c.university,
    c.user_mode,
    c.target_gpa,
    c.target_thpt,
    c.target_dgnl,
    c.current_gpa,
    c.is_approved_bang_chu,
    c.is_vip,
    c.exp,
    c.study_seconds,
    c.study_streak,
    c.today_seconds,
    c.today_minutes,
    c.today_exp,
    c.is_today,
    ROW_NUMBER() OVER (
      ORDER BY c.bucket_order ASC, c.sort_primary DESC, c.sort_secondary DESC, c.sort_time ASC
    )::integer AS rank
  FROM combined c
  ORDER BY rank ASC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_daily_top_scholars(integer, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.get_daily_top_scholars(integer, boolean) TO anon, authenticated;
