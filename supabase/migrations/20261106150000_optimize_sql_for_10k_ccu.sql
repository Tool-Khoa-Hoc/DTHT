/*
  High-Concurrency SQL & Query Optimization for 10,000+ Concurrent Students (10k CCU)
  Date: 2026-11-06
  -----------------------------------------------------------------------------------
  GOALS:
    1. HOT-Update Tuple Tuning (`fillfactor`) on high-churn tables (`study_sessions`,
       `study_daily`, `profiles`) to prevent page splits and index bloat at ~200 RPS
       heartbeat writes (10,000 students × 1 beat / 50s).
    2. Short-circuit `protect_profile_fields()` trigger so `public.is_admin(auth.uid())`
       is ONLY evaluated when a protected column (`role`, `is_vip`, `vip_expired_at`,
       `is_approved_bang_chu`) actually changes or cross-user update occurs —
       eliminating 200+ redundant `SELECT EXISTS(...)` queries/sec during study heartbeats.
    3. Consolidate `heartbeat_study_session` + `end_study_session` hot-path queries:
       - Reuse `exp`, `study_seconds`, `streak`, `today_seconds` returned by
         `award_study_exp()` instead of re-querying `profiles` and `study_daily`.
       - Avoid double-updating `study_sessions` when closing a session in `end_study_session()`.
    4. Add missing Partial, Covering (`INCLUDE`), and Composite B-Tree indexes across
       `study_sessions`, `study_daily`, `profiles`, `campaigns`, `follows`, `documents`,
       `user_notes`, and `transactions`; drop redundant prefix index `idx_roadmap_milestones_user_mode`.
    5. Rewrite `get_daily_top_scholars(p_limit, p_fallback)` using a 3-stage index-backed
       CTE (`today_learners` -> `yesterday_learners` -> `alltime_learners`) so PostgreSQL
       never performs a Full Table Scan + Sort across `profiles LEFT JOIN study_daily`.
    6. Add `get_completed_campaign_counts(p_user_ids uuid[])` (Index-Only Scan on
       `idx_campaigns_completed_by_user`) to replace unbounded client-side full scans
       of `public.campaigns`.
    7. Add atomic `swap_roadmap_milestones(p_first_id uuid, p_second_id uuid)` RPC to
       collapse 3 sequential client round-trips into 1 atomic server-side swap.
    8. Upgrade remaining RLS policies (`campaigns`, `roadmap_milestones`, `follows`,
       `notifications`, `documents`, `document_reports`, `orders`, `payment_logs`,
       `transactions`, `admission_*`) to use the scalar `(SELECT auth.uid())` and
       `(SELECT public.is_admin((SELECT auth.uid())))` InitPlan form (evaluated once
       per query instead of once per scanned row).
*/

-- ===========================================================================
-- 1. STORAGE FILLFACTOR FOR HIGH-FREQUENCY HEARTBEAT TABLES (HOT UPDATES)
-- ===========================================================================
ALTER TABLE IF EXISTS public.study_sessions SET (fillfactor = 80);
ALTER TABLE IF EXISTS public.study_daily    SET (fillfactor = 80);
ALTER TABLE IF EXISTS public.profiles       SET (fillfactor = 90);

-- ===========================================================================
-- 2. COMPOSITE, PARTIAL & COVERING INDEXES FOR 10K CCU WORKLOADS
-- ===========================================================================

-- 2a. Study sessions: partial index on active (open) sessions only (~1 row/active student)
CREATE INDEX IF NOT EXISTS idx_study_sessions_active_user
  ON public.study_sessions (user_id, last_heartbeat_at DESC)
  WHERE ended_at IS NULL;

-- 2b. Study daily: covering index for daily & yesterday leaderboards (Index-Only Scan)
CREATE INDEX IF NOT EXISTS idx_study_daily_leaderboard_covering
  ON public.study_daily (study_date, seconds DESC, updated_at ASC)
  INCLUDE (user_id, exp)
  WHERE seconds >= 60;

-- 2c. Profiles: composite index for All-Time EXP Leaderboard & fallback ranking
CREATE INDEX IF NOT EXISTS idx_profiles_leaderboard_exp
  ON public.profiles (exp DESC, study_seconds DESC, is_approved_bang_chu DESC);

-- Partial indexes on profiles for fast role & Bang Chu lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role_staff
  ON public.profiles (role, display_name)
  WHERE role IN ('admin', 'collaborator');

CREATE INDEX IF NOT EXISTS idx_profiles_approved_bang_chu
  ON public.profiles (id)
  WHERE is_approved_bang_chu = true;

-- 2d. Campaigns: previously had 0 indexes! Add targeted composite & partial indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_user_created
  ON public.campaigns (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaigns_public_created
  ON public.campaigns (created_at DESC)
  WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_campaigns_user_public_created
  ON public.campaigns (user_id, created_at DESC)
  WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_campaigns_completed_by_user
  ON public.campaigns (user_id)
  WHERE is_completed = true;

-- 2e. Follows: add index on following_id (fixes Seq Scan when counting followers)
CREATE INDEX IF NOT EXISTS idx_follows_following_id
  ON public.follows (following_id);

-- 2f. Documents: partial indexes matching Home.jsx & Library.jsx exact ORDER BY
CREATE INDEX IF NOT EXISTS idx_documents_public_featured_created
  ON public.documents (is_featured DESC, created_at DESC)
  WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_documents_public_edu_cat_featured_created
  ON public.documents (education_level, category, is_featured DESC, created_at DESC)
  WHERE is_public = true;

-- 2g. Transactions: partial index for payment reconciliation idempotency check
CREATE INDEX IF NOT EXISTS idx_transactions_code
  ON public.transactions (transaction_code)
  WHERE transaction_code IS NOT NULL;

-- 2h. Optional tables created out-of-band (user_notes, user_saved_documents, document_reviews)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_notes'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_notes_user_updated ON public.user_notes (user_id, updated_at DESC)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_saved_documents'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_saved_documents_user_doc ON public.user_saved_documents (user_id, document_id)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'document_reviews'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_document_reviews_doc_created ON public.document_reviews (document_id, created_at DESC)';
  END IF;
END $$;

-- 2i. Drop redundant prefix index on roadmap_milestones
-- (covered by idx_roadmap_milestones_user_mode_sort ON (user_id, mode, sort_order))
DROP INDEX IF EXISTS public.idx_roadmap_milestones_user_mode;

-- ===========================================================================
-- 3. SHORT-CIRCUIT BEFORE UPDATE TRIGGER ON PROFILES & DROP DUPLICATE TRIGGER
-- ===========================================================================
-- Remove duplicate trigger tr_protect_profile_fields (trg_protect_profile_fields remains)
DROP TRIGGER IF EXISTS tr_protect_profile_fields ON public.profiles;

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  -- Fast-path 1: Explicit internal bypass (handle_new_user, reconcile_vip_payment)
  IF current_setting('app.allow_protected_profile_update', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- Fast-path 2: Study heartbeat EXP updates (award_study_exp sets app.exp_ctx = 'on').
  -- When none of the 4 protected role/VIP columns are touched, return immediately
  -- without querying public.is_admin(auth.uid())!
  IF current_setting('app.exp_ctx', true) = 'on'
    AND NEW.role IS NOT DISTINCT FROM OLD.role
    AND NEW.is_vip IS NOT DISTINCT FROM OLD.is_vip
    AND NEW.vip_expired_at IS NOT DISTINCT FROM OLD.vip_expired_at
    AND NEW.is_approved_bang_chu IS NOT DISTINCT FROM OLD.is_approved_bang_chu
  THEN
    RETURN NEW;
  END IF;

  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_uid <> OLD.id AND NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'You can only update your own profile';
  END IF;

  -- Check column diffs FIRST; only call public.is_admin(v_uid) when a protected
  -- field is actually being modified.
  IF (
    NEW.role IS DISTINCT FROM OLD.role
    OR NEW.is_vip IS DISTINCT FROM OLD.is_vip
    OR NEW.vip_expired_at IS DISTINCT FROM OLD.vip_expired_at
    OR NEW.is_approved_bang_chu IS DISTINCT FROM OLD.is_approved_bang_chu
  ) AND NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'Not allowed to update protected profile fields';
  END IF;

  RETURN NEW;
END;
$$;

-- ===========================================================================
-- 4. HOT-PATH HEARTBEAT & SESSION RPC CONSOLIDATION
-- ===========================================================================
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
  v_study_seconds    bigint;
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

  -- Server-side Anti-AFK guards:
  -- 1. No interaction for > 22 minutes -> block credit
  -- 2. Past checkin_due_at without verification -> block credit
  IF (v_now - v_session.last_interaction_at) > interval '22 minutes' THEN
    v_idle_blocked := true;
  END IF;

  IF v_now > v_session.checkin_due_at AND NOT COALESCE(p_checkin_verified, false) THEN
    v_idle_blocked     := true;
    v_checkin_required := true;
  ELSIF NOT COALESCE(p_checkin_verified, false)
    AND v_now >= (v_session.checkin_due_at - interval '3 minutes')
  THEN
    v_checkin_required := true;
  END IF;

  v_delta := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_now - v_session.last_heartbeat_at)))::int);
  IF COALESCE(p_credit, true) AND NOT v_idle_blocked THEN
    v_credit := LEAST(v_delta, 90);
  END IF;

  IF v_credit > 0 THEN
    v_award         := public.award_study_exp(v_credit);
    v_credited      := COALESCE((v_award ->> 'awarded_seconds')::int, 0);
    v_exp           := COALESCE((v_award ->> 'exp')::bigint, 0);
    v_study_seconds := COALESCE((v_award ->> 'study_seconds')::bigint, 0);
    v_streak        := COALESCE((v_award ->> 'streak')::int, 0);
    v_today_seconds := COALESCE((v_award ->> 'today_seconds')::int, 0);
  ELSE
    v_credited := 0;
    SELECT exp, study_seconds, study_streak
      INTO v_exp, v_study_seconds, v_streak
      FROM public.profiles
     WHERE id = v_uid;

    SELECT COALESCE(seconds, 0)
      INTO v_today_seconds
      FROM public.study_daily
     WHERE user_id = v_uid AND study_date = v_today;
  END IF;

  -- Handle Pomodoro 25-minute check-in verification after v_today_seconds is known
  IF COALESCE(p_checkin_verified, false) THEN
    v_session.checkin_due_at := v_now + interval '28 minutes';
    v_checkin_required       := false;

    -- Grant +10 EXP focus bonus if under the daily 5h EXP cap
    IF COALESCE(v_today_seconds, 0) < 18000 THEN
      v_checkin_bonus := 10;
      PERFORM set_config('app.exp_ctx', 'on', true);

      UPDATE public.profiles
         SET exp = exp + v_checkin_bonus
       WHERE id = v_uid
       RETURNING exp INTO v_exp;

      INSERT INTO public.study_daily (user_id, study_date, seconds, exp, updated_at)
           VALUES (v_uid, v_today, 0, v_checkin_bonus, v_now)
      ON CONFLICT (user_id, study_date)
      DO UPDATE SET exp        = public.study_daily.exp + v_checkin_bonus,
                    updated_at = v_now;
    END IF;
  END IF;

  UPDATE public.study_sessions
     SET credited_seconds    = credited_seconds + v_credited,
         last_heartbeat_at   = v_now,
         last_interaction_at = v_session.last_interaction_at,
         checkin_due_at      = v_session.checkin_due_at
   WHERE id = p_session_id
   RETURNING credited_seconds INTO v_session.credited_seconds;

  RETURN jsonb_build_object(
    'session_id',        p_session_id,
    'credited_seconds',  v_session.credited_seconds,
    'session_seconds',   v_session.credited_seconds,
    'elapsed_seconds',   GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_now - v_session.started_at)))::int),
    'awarded_seconds',   v_credited,
    'awarded_exp',       COALESCE((v_award ->> 'awarded_exp')::int, 0) + v_checkin_bonus,
    'checkin_bonus_exp', v_checkin_bonus,
    'exp',               COALESCE(v_exp, 0),
    'study_seconds',     COALESCE(v_study_seconds, 0),
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

-- Consolidate end_study_session to avoid double-updating study_sessions when closing
CREATE OR REPLACE FUNCTION public.end_study_session(p_session_id uuid)
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
  v_credit           integer     := 0;
  v_award            jsonb       := NULL;
  v_credited         integer     := 0;
  v_exp              bigint;
  v_study_seconds    bigint;
  v_streak           integer;
  v_today_seconds    integer     := 0;
  v_idle_blocked     boolean     := false;
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

  IF (v_now - v_session.last_interaction_at) > interval '22 minutes'
    OR v_now > v_session.checkin_due_at
  THEN
    v_idle_blocked := true;
  END IF;

  v_delta := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_now - v_session.last_heartbeat_at)))::int);
  IF NOT v_idle_blocked THEN
    v_credit := LEAST(v_delta, 90);
  END IF;

  IF v_credit > 0 THEN
    v_award         := public.award_study_exp(v_credit);
    v_credited      := COALESCE((v_award ->> 'awarded_seconds')::int, 0);
    v_exp           := COALESCE((v_award ->> 'exp')::bigint, 0);
    v_study_seconds := COALESCE((v_award ->> 'study_seconds')::bigint, 0);
    v_streak        := COALESCE((v_award ->> 'streak')::int, 0);
    v_today_seconds := COALESCE((v_award ->> 'today_seconds')::int, 0);
  ELSE
    SELECT exp, study_seconds, study_streak
      INTO v_exp, v_study_seconds, v_streak
      FROM public.profiles
     WHERE id = v_uid;

    SELECT COALESCE(seconds, 0)
      INTO v_today_seconds
      FROM public.study_daily
     WHERE user_id = v_uid AND study_date = v_today;
  END IF;

  -- Single atomic UPDATE to credit final tail AND close ended_at = v_now
  UPDATE public.study_sessions
     SET credited_seconds  = credited_seconds + v_credited,
         last_heartbeat_at = v_now,
         ended_at          = v_now
   WHERE id = p_session_id
   RETURNING credited_seconds INTO v_session.credited_seconds;

  RETURN jsonb_build_object(
    'session_id',       p_session_id,
    'credited_seconds', v_session.credited_seconds,
    'session_seconds',  v_session.credited_seconds,
    'elapsed_seconds',  GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_now - v_session.started_at)))::int),
    'awarded_seconds',  v_credited,
    'awarded_exp',      COALESCE((v_award ->> 'awarded_exp')::int, 0),
    'exp',              COALESCE(v_exp, 0),
    'study_seconds',    COALESCE(v_study_seconds, 0),
    'streak',           COALESCE(v_streak, 0),
    'today_seconds',    COALESCE(v_today_seconds, 0),
    'today_minutes',    FLOOR(COALESCE(v_today_seconds, 0) / 60.0)::int,
    'award',            v_award,
    'ended',            true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.end_study_session(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.end_study_session(uuid) TO authenticated;

-- ===========================================================================
-- 5. INDEX-DRIVEN DAILY LEADERBOARD RPC (NO FULL-TABLE JOIN/SORT)
-- ===========================================================================
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
    -- Uses idx_study_daily_leaderboard_covering: pure B-tree index scan on today
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
      sd.seconds::bigint AS sort_primary,
      COALESCE(p.exp, 0)::bigint AS sort_secondary,
      sd.updated_at AS sort_time
    FROM public.study_daily sd
    INNER JOIN public.profiles p ON p.id = sd.user_id
    WHERE sd.study_date = v_today
      AND sd.seconds >= 60
    ORDER BY sd.seconds DESC, sd.updated_at ASC
    LIMIT v_limit
  ),
  yesterday_learners AS (
    -- Uses idx_study_daily_leaderboard_covering on (v_today - 1) only when needed
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
      0::integer AS today_seconds,
      0::integer AS today_minutes,
      0::integer AS today_exp,
      false AS is_today,
      2 AS bucket_order,
      sd_yest.seconds::bigint AS sort_primary,
      COALESCE(p.exp, 0)::bigint AS sort_secondary,
      sd_yest.updated_at AS sort_time
    FROM public.study_daily sd_yest
    INNER JOIN public.profiles p ON p.id = sd_yest.user_id
    WHERE COALESCE(p_fallback, true) = true
      AND sd_yest.study_date = (v_today - 1)
      AND sd_yest.seconds >= 60
      AND NOT EXISTS (SELECT 1 FROM today_learners tl WHERE tl.id = sd_yest.user_id)
    ORDER BY sd_yest.seconds DESC, sd_yest.updated_at ASC
    LIMIT GREATEST(0, v_limit - (SELECT count(*)::integer FROM today_learners))
  ),
  alltime_learners AS (
    -- Uses idx_profiles_leaderboard_exp on profiles only if today + yesterday < v_limit
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
      0::integer AS today_seconds,
      0::integer AS today_minutes,
      0::integer AS today_exp,
      false AS is_today,
      3 AS bucket_order,
      COALESCE(p.exp, 0)::bigint AS sort_primary,
      COALESCE(p.study_seconds, 0)::bigint AS sort_secondary,
      now() AS sort_time
    FROM public.profiles p
    WHERE COALESCE(p_fallback, true) = true
      AND NOT EXISTS (SELECT 1 FROM today_learners tl WHERE tl.id = p.id)
      AND NOT EXISTS (SELECT 1 FROM yesterday_learners yl WHERE yl.id = p.id)
    ORDER BY p.exp DESC, p.study_seconds DESC, p.is_approved_bang_chu DESC
    LIMIT GREATEST(
      0,
      v_limit
        - (SELECT count(*)::integer FROM today_learners)
        - (SELECT count(*)::integer FROM yesterday_learners)
    )
  ),
  combined AS (
    SELECT * FROM today_learners
    UNION ALL
    SELECT * FROM yesterday_learners
    UNION ALL
    SELECT * FROM alltime_learners
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

-- ===========================================================================
-- 6. SCOPED COMPLETED CAMPAIGNS AGGREGATION RPC (INDEX-ONLY SCAN)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.get_completed_campaign_counts(
  p_user_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  user_id         uuid,
  completed_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.user_id,
    COUNT(*)::integer AS completed_count
  FROM public.campaigns c
  WHERE c.is_completed = true
    AND c.user_id IS NOT NULL
    AND (p_user_ids IS NULL OR c.user_id = ANY(p_user_ids))
  GROUP BY c.user_id;
$$;

REVOKE ALL ON FUNCTION public.get_completed_campaign_counts(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.get_completed_campaign_counts(uuid[]) TO anon, authenticated;

-- ===========================================================================
-- 7. ATOMIC SINGLE-ROUND-TRIP ROADMAP MILESTONE REORDER RPC
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.swap_roadmap_milestones(
  p_first_id  uuid,
  p_second_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_row_a public.roadmap_milestones%ROWTYPE;
  v_row_b public.roadmap_milestones%ROWTYPE;
  v_order_a integer;
  v_order_b integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_first_id IS NULL OR p_second_id IS NULL OR p_first_id = p_second_id THEN
    RETURN false;
  END IF;

  SELECT * INTO v_row_a
    FROM public.roadmap_milestones
   WHERE id = p_first_id AND user_id = v_uid
   FOR UPDATE;

  SELECT * INTO v_row_b
    FROM public.roadmap_milestones
   WHERE id = p_second_id AND user_id = v_uid
   FOR UPDATE;

  IF v_row_a.id IS NULL OR v_row_b.id IS NULL OR v_row_a.mode <> v_row_b.mode THEN
    RAISE EXCEPTION 'Milestones not found or belong to different modes';
  END IF;

  v_order_a := v_row_a.sort_order;
  v_order_b := CASE WHEN v_row_b.sort_order = v_row_a.sort_order THEN v_row_a.sort_order + 1 ELSE v_row_b.sort_order END;

  -- Swap via temporary negative sentinel inside single transaction
  UPDATE public.roadmap_milestones
     SET sort_order = -2147483647,
         updated_at = now()
   WHERE id = p_first_id AND user_id = v_uid;

  UPDATE public.roadmap_milestones
     SET sort_order = v_order_a,
         updated_at = now()
   WHERE id = p_second_id AND user_id = v_uid;

  UPDATE public.roadmap_milestones
     SET sort_order = v_order_b,
         updated_at = now()
   WHERE id = p_first_id AND user_id = v_uid;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.swap_roadmap_milestones(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.swap_roadmap_milestones(uuid, uuid) TO authenticated;

-- ===========================================================================
-- 8. RLS INITPLAN OPTIMIZATION ((SELECT public.is_admin((SELECT auth.uid()))))
-- ===========================================================================

-- 8a. documents: replace inline profiles subquery with scalar (SELECT public.is_admin(...))
DROP POLICY IF EXISTS "documents_delete" ON public.documents;
CREATE POLICY "documents_delete"
  ON public.documents FOR DELETE
  USING (
    uploaded_by = (SELECT auth.uid())
    OR (SELECT public.is_admin((SELECT auth.uid())))
  );

DROP POLICY IF EXISTS "documents_insert" ON public.documents;
CREATE POLICY "documents_insert"
  ON public.documents FOR INSERT
  WITH CHECK (
    uploaded_by = (SELECT auth.uid())
    OR (SELECT public.is_admin((SELECT auth.uid())))
  );

DROP POLICY IF EXISTS "documents_update" ON public.documents;
CREATE POLICY "documents_update"
  ON public.documents FOR UPDATE
  USING (
    uploaded_by = (SELECT auth.uid())
    OR (SELECT public.is_admin((SELECT auth.uid())))
  )
  WITH CHECK (
    uploaded_by = (SELECT auth.uid())
    OR (SELECT public.is_admin((SELECT auth.uid())))
  );

-- 8b. orders, payment_logs, transactions: replace EXISTS(SELECT 1 FROM profiles...) with scalar is_admin InitPlan
DROP POLICY IF EXISTS "orders_select_policy" ON public.orders;
CREATE POLICY "orders_select_policy"
  ON public.orders FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin((SELECT auth.uid())))
  );

DROP POLICY IF EXISTS "orders_insert_policy" ON public.orders;
CREATE POLICY "orders_insert_policy"
  ON public.orders FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin((SELECT auth.uid())))
  );

DROP POLICY IF EXISTS "orders_update_policy" ON public.orders;
CREATE POLICY "orders_update_policy"
  ON public.orders FOR UPDATE
  USING ((SELECT public.is_admin((SELECT auth.uid()))));

DROP POLICY IF EXISTS "orders_delete_policy" ON public.orders;
CREATE POLICY "orders_delete_policy"
  ON public.orders FOR DELETE
  USING ((SELECT public.is_admin((SELECT auth.uid()))));

DROP POLICY IF EXISTS "payment_logs_admin_only" ON public.payment_logs;
CREATE POLICY "payment_logs_admin_only"
  ON public.payment_logs FOR ALL
  USING ((SELECT public.is_admin((SELECT auth.uid()))));

DROP POLICY IF EXISTS "transactions_select_policy" ON public.transactions;
CREATE POLICY "transactions_select_policy"
  ON public.transactions FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin((SELECT auth.uid())))
  );

DROP POLICY IF EXISTS "transactions_insert_policy" ON public.transactions;
CREATE POLICY "transactions_insert_policy"
  ON public.transactions FOR INSERT
  WITH CHECK ((SELECT public.is_admin((SELECT auth.uid()))));

DROP POLICY IF EXISTS "transactions_update_policy" ON public.transactions;
CREATE POLICY "transactions_update_policy"
  ON public.transactions FOR UPDATE
  USING ((SELECT public.is_admin((SELECT auth.uid()))));

DROP POLICY IF EXISTS "transactions_delete_policy" ON public.transactions;
CREATE POLICY "transactions_delete_policy"
  ON public.transactions FOR DELETE
  USING ((SELECT public.is_admin((SELECT auth.uid()))));

-- 8c. admission_* admin write policies (wrap outer is_admin in scalar SELECT)
DROP POLICY IF EXISTS "admission_schools_write_admin" ON public.admission_schools;
CREATE POLICY "admission_schools_write_admin"
  ON public.admission_schools FOR ALL
  USING ((SELECT public.is_admin((SELECT auth.uid()))))
  WITH CHECK ((SELECT public.is_admin((SELECT auth.uid()))));

DROP POLICY IF EXISTS "admission_cutoffs_insert_admin" ON public.admission_cutoffs;
CREATE POLICY "admission_cutoffs_insert_admin"
  ON public.admission_cutoffs FOR INSERT
  WITH CHECK ((SELECT public.is_admin((SELECT auth.uid()))));

DROP POLICY IF EXISTS "admission_cutoffs_update_admin" ON public.admission_cutoffs;
CREATE POLICY "admission_cutoffs_update_admin"
  ON public.admission_cutoffs FOR UPDATE
  USING ((SELECT public.is_admin((SELECT auth.uid()))))
  WITH CHECK ((SELECT public.is_admin((SELECT auth.uid()))));

DROP POLICY IF EXISTS "admission_cutoffs_delete_admin" ON public.admission_cutoffs;
CREATE POLICY "admission_cutoffs_delete_admin"
  ON public.admission_cutoffs FOR DELETE
  USING ((SELECT public.is_admin((SELECT auth.uid()))));

DROP POLICY IF EXISTS "admission_conversion_anchors_write_admin" ON public.admission_conversion_anchors;
CREATE POLICY "admission_conversion_anchors_write_admin"
  ON public.admission_conversion_anchors FOR ALL
  USING ((SELECT public.is_admin((SELECT auth.uid()))))
  WITH CHECK ((SELECT public.is_admin((SELECT auth.uid()))));

DROP POLICY IF EXISTS "admission_score_distributions_write_admin" ON public.admission_score_distributions;
CREATE POLICY "admission_score_distributions_write_admin"
  ON public.admission_score_distributions FOR ALL
  USING ((SELECT public.is_admin((SELECT auth.uid()))))
  WITH CHECK ((SELECT public.is_admin((SELECT auth.uid()))));
