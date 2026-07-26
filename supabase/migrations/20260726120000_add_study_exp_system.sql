/*
  Study EXP / Level system ("Công Lực" & "Cấp độ") — July 2026
  --------------------------------------------------------------------------
  GOAL: reward time spent studying on the site (Học online) with EXP that
  raises a numeric Level, running ALONGSIDE the existing campaign-based
  Danh Hiệu ladder (Tân Binh → Bang Chủ) without touching it.

  EXP economy (kept in sync with src/utils/levelHelper.js):
    - 10 EXP per verified minute of study  (30 min => 300 EXP)
    - Level cost L -> L+1 = 100 * L EXP     (min EXP for level L = 50*L*(L-1))
    - Daily study-EXP cap  = 5 hours/day
    - Daily streak bonus    = min(streak, 7) * 20 EXP, granted once/day

  SECURITY (this is the whole point — EXP must not be forgeable from the client):
    1. EXP/level columns on profiles are made READ-ONLY to clients via a
       BEFORE UPDATE trigger. Normal profile saves (display_name, targets…)
       leave those columns untouched, so the trigger no-ops for them; any
       attempt to change them without the definer context raises.
    2. All crediting goes through award_study_exp() — SECURITY DEFINER,
       EXECUTE granted to `authenticated` only. It:
         - only ever touches the caller's own row (auth.uid()),
         - clamps a heartbeat to <=120s AND to real wall-clock elapsed since
           the last award (so spamming the RPC cannot inflate EXP),
         - enforces the 5h/day cap server-side,
         - authorizes the protected-column write with a txn-local GUC.
    3. study_daily has SELECT-own RLS and no client write path.
*/

-- 1. profiles: EXP / level state ------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS exp bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS study_seconds bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_exp_award_at timestamptz,
  ADD COLUMN IF NOT EXISTS study_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_study_date date;

COMMENT ON COLUMN public.profiles.exp IS 'Tổng công lực (EXP) tích luỹ, quyết định Cấp độ. Chỉ ghi qua award_study_exp().';
COMMENT ON COLUMN public.profiles.study_seconds IS 'Tổng thời gian học online đã xác thực (giây). Chỉ ghi qua award_study_exp().';
COMMENT ON COLUMN public.profiles.study_streak IS 'Số ngày học liên tiếp.';

-- 2. Per-day study aggregate (cap enforcement + history) ------------------
CREATE TABLE IF NOT EXISTS public.study_daily (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_date date NOT NULL,
  seconds    integer NOT NULL DEFAULT 0,
  exp        integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, study_date)
);

ALTER TABLE public.study_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "study_daily_select_own" ON public.study_daily;
CREATE POLICY "study_daily_select_own" ON public.study_daily
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- No INSERT/UPDATE/DELETE policy: clients cannot write. The definer RPC
-- (owned by postgres) bypasses RLS and is the only writer.
REVOKE ALL ON public.study_daily FROM anon, authenticated;
GRANT SELECT ON public.study_daily TO authenticated;

-- 3. Anti-tamper trigger: EXP columns are read-only outside the RPC -------
CREATE OR REPLACE FUNCTION public.protect_exp_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
        NEW.exp               IS DISTINCT FROM OLD.exp
     OR NEW.study_seconds     IS DISTINCT FROM OLD.study_seconds
     OR NEW.last_exp_award_at IS DISTINCT FROM OLD.last_exp_award_at
     OR NEW.study_streak      IS DISTINCT FROM OLD.study_streak
     OR NEW.last_study_date   IS DISTINCT FROM OLD.last_study_date
  ) AND current_setting('app.exp_ctx', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'EXP/level columns are read-only; use award_study_exp()';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_exp ON public.profiles;
CREATE TRIGGER trg_protect_exp
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_exp_columns();

-- 4. The one sanctioned way to earn EXP -----------------------------------
CREATE OR REPLACE FUNCTION public.award_study_exp(p_seconds integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           uuid        := auth.uid();
  v_now           timestamptz := now();
  v_today         date        := (v_now AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  v_last_award    timestamptz;
  v_streak        integer;
  v_last_study    date;
  v_elapsed       numeric;
  v_credit        integer;
  v_today_seconds integer := 0;
  v_remaining     integer;
  v_exp_gain      integer;
  v_streak_bonus  integer := 0;
  v_first_today   boolean := false;
  v_total_exp     bigint;
  v_total_seconds bigint;
  c_cap_seconds   constant integer := 18000; -- 5h/day
  c_exp_per_min   constant integer := 10;
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

  IF p_seconds = 0 THEN
    SELECT exp, study_seconds INTO v_total_exp, v_total_seconds
      FROM public.profiles WHERE id = v_uid;
    RETURN jsonb_build_object(
      'awarded_exp', 0, 'awarded_seconds', 0, 'streak_bonus', 0,
      'exp', COALESCE(v_total_exp, 0), 'study_seconds', COALESCE(v_total_seconds, 0),
      'streak', COALESCE(v_streak, 0), 'capped', false);
  END IF;

  -- Wall-clock clamp: cannot credit more than real time elapsed since the
  -- previous award (+5s grace). Defeats rapid-fire RPC farming.
  IF v_last_award IS NULL THEN
    v_credit := p_seconds;
  ELSE
    v_elapsed := EXTRACT(EPOCH FROM (v_now - v_last_award));
    v_credit  := LEAST(p_seconds, FLOOR(v_elapsed)::int + 5);
  END IF;
  v_credit := GREATEST(0, v_credit);

  -- Daily cap.
  SELECT seconds INTO v_today_seconds
    FROM public.study_daily WHERE user_id = v_uid AND study_date = v_today;
  v_today_seconds := COALESCE(v_today_seconds, 0);
  v_remaining := GREATEST(0, c_cap_seconds - v_today_seconds);
  v_credit := LEAST(v_credit, v_remaining);

  IF v_credit <= 0 THEN
    SELECT exp, study_seconds INTO v_total_exp, v_total_seconds
      FROM public.profiles WHERE id = v_uid;
    RETURN jsonb_build_object(
      'awarded_exp', 0, 'awarded_seconds', 0, 'streak_bonus', 0,
      'exp', COALESCE(v_total_exp, 0), 'study_seconds', COALESCE(v_total_seconds, 0),
      'streak', COALESCE(v_streak, 0), 'capped', true);
  END IF;

  v_exp_gain := FLOOR(v_credit * c_exp_per_min / 60.0)::int;

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
         study_seconds     = study_seconds + v_credit,
         last_exp_award_at = v_now,
         study_streak      = CASE WHEN v_first_today THEN v_streak ELSE study_streak END,
         last_study_date   = CASE WHEN v_first_today THEN v_today  ELSE last_study_date END
   WHERE id = v_uid
   RETURNING exp, study_seconds, study_streak
        INTO v_total_exp, v_total_seconds, v_streak;

  INSERT INTO public.study_daily (user_id, study_date, seconds, exp, updated_at)
       VALUES (v_uid, v_today, v_credit, v_exp_gain, v_now)
  ON CONFLICT (user_id, study_date)
  DO UPDATE SET seconds    = study_daily.seconds + EXCLUDED.seconds,
                exp        = study_daily.exp + EXCLUDED.exp,
                updated_at = v_now;

  RETURN jsonb_build_object(
    'awarded_exp',     v_exp_gain,
    'awarded_seconds', v_credit,
    'streak_bonus',    v_streak_bonus,
    'exp',             v_total_exp,
    'study_seconds',   v_total_seconds,
    'streak',          v_streak,
    'capped',          (v_remaining - v_credit) <= 0);
END;
$$;

REVOKE ALL ON FUNCTION public.award_study_exp(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.award_study_exp(integer) TO authenticated;

-- 5. Expose EXP on the safe public view (for future leaderboards) ---------
DROP VIEW IF EXISTS public.public_profile_view;
CREATE VIEW public.public_profile_view
WITH (security_invoker = false) AS
SELECT
  id,
  display_name,
  avatar_url,
  role,
  university,
  user_mode,
  target_gpa,
  target_thpt,
  target_dgnl,
  current_gpa,
  is_approved_bang_chu,
  exp,
  study_seconds,
  study_streak
FROM public.profiles;

REVOKE ALL ON public.public_profile_view FROM anon, authenticated;
GRANT SELECT ON public.public_profile_view TO anon, authenticated;
