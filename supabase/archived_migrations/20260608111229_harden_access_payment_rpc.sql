-- Harden exam access, payment order metadata, and advisor-reported RLS/function issues.

-- ---------------------------------------------------------------------------
-- 1. Exam access: never trust a user id passed from the browser.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_vip(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND p.is_vip = true
      AND p.vip_expired_at IS NOT NULL
      AND p.vip_expired_at > now()
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_vip(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_vip(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.check_and_log_exam_access(p_exam_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_exam_id text := trim(COALESCE(p_exam_id, ''));
  v_role text;
  v_daily_count int;
  free_limit constant int := 3;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'isRevisit', false, 'reason', 'not_logged_in');
  END IF;

  IF v_exam_id = '' THEN
    RETURN jsonb_build_object('allowed', false, 'isRevisit', false, 'reason', 'missing_exam_id');
  END IF;

  SELECT p.role
  INTO v_role
  FROM public.profiles p
  WHERE p.id = v_actor_id;

  IF v_role = 'admin' THEN
    RETURN jsonb_build_object('allowed', true, 'isRevisit', false, 'reason', null);
  END IF;

  IF public.is_active_vip(v_actor_id) THEN
    RETURN jsonb_build_object('allowed', true, 'isRevisit', false, 'reason', null);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_access_log l
    WHERE l.user_id = v_actor_id
      AND l.exam_id = v_exam_id
  ) THEN
    RETURN jsonb_build_object('allowed', true, 'isRevisit', true, 'reason', null);
  END IF;

  SELECT count(*)
  INTO v_daily_count
  FROM public.user_access_log l
  WHERE l.user_id = v_actor_id
    AND l.created_at >= CURRENT_DATE::timestamptz
    AND l.created_at < (CURRENT_DATE + 1)::timestamptz;

  IF v_daily_count >= free_limit THEN
    RETURN jsonb_build_object('allowed', false, 'isRevisit', false, 'reason', 'daily_limit');
  END IF;

  INSERT INTO public.user_access_log (user_id, exam_id)
  VALUES (v_actor_id, v_exam_id)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('allowed', true, 'isRevisit', false, 'reason', null);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[check_and_log_exam_access] user=% exam=%: %', v_actor_id, v_exam_id, SQLERRM;
    RETURN jsonb_build_object('allowed', false, 'isRevisit', false, 'reason', 'error');
END;
$$;

COMMENT ON FUNCTION public.check_and_log_exam_access(text) IS
  'Checks exam access using auth.uid() only. The browser must not pass a user id.';

REVOKE ALL ON FUNCTION public.check_and_log_exam_access(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_log_exam_access(text) TO authenticated;

-- Keep the old signature safe while the API cache/client rollout settles.
CREATE OR REPLACE FUNCTION public.check_and_log_exam_access(p_user_id uuid, p_exam_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'isRevisit', false, 'reason', 'not_logged_in');
  END IF;

  IF p_user_id IS DISTINCT FROM v_actor_id AND NOT public.is_admin(v_actor_id) THEN
    RETURN jsonb_build_object('allowed', false, 'isRevisit', false, 'reason', 'forbidden_user_mismatch');
  END IF;

  RETURN public.check_and_log_exam_access(p_exam_id);
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_log_exam_access(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_log_exam_access(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Payment order metadata: make transfer_code first-class and browser-readable.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_transfer_code_from_uuid(p_id uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 'DH' || upper(substr(replace(p_id::text, '-', ''), 1, 12));
$$;

CREATE OR REPLACE FUNCTION public.set_order_transfer_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;

  IF NEW.transfer_code IS NULL OR btrim(NEW.transfer_code) = '' THEN
    NEW.transfer_code := public.order_transfer_code_from_uuid(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.orders
SET transfer_code = public.order_transfer_code_from_uuid(id)
WHERE transfer_code IS NULL OR btrim(transfer_code) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_transfer_code_unique
  ON public.orders (transfer_code);

REVOKE ALL ON FUNCTION public.order_transfer_code_from_uuid(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_transfer_code_from_uuid(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.set_order_transfer_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_order_transfer_code() TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Advisor/RLS hardening: avoid per-row auth init plans and duplicate policy work.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "exam_keys_admin_all" ON public.exam_keys;
DROP POLICY IF EXISTS "exam_keys_select" ON public.exam_keys;
DROP POLICY IF EXISTS "exam_keys_admin_insert" ON public.exam_keys;
DROP POLICY IF EXISTS "exam_keys_admin_update" ON public.exam_keys;
DROP POLICY IF EXISTS "exam_keys_admin_delete" ON public.exam_keys;
DROP POLICY IF EXISTS "Admins can manage exam keys" ON public.exam_keys;

CREATE POLICY "exam_keys_select_admin" ON public.exam_keys
  FOR SELECT TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

CREATE POLICY "exam_keys_insert_admin" ON public.exam_keys
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin((SELECT auth.uid())));

CREATE POLICY "exam_keys_update_admin" ON public.exam_keys
  FOR UPDATE TO authenticated
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));

CREATE POLICY "exam_keys_delete_admin" ON public.exam_keys
  FOR DELETE TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

DO $$
BEGIN
  IF to_regclass('public.exam_subjects') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage exam subjects" ON public.exam_subjects';
    EXECUTE 'DROP POLICY IF EXISTS "Everyone can read exam subjects" ON public.exam_subjects';
    EXECUTE 'DROP POLICY IF EXISTS "exam_subjects_read_public" ON public.exam_subjects';
    EXECUTE 'DROP POLICY IF EXISTS "exam_subjects_insert_admin" ON public.exam_subjects';
    EXECUTE 'DROP POLICY IF EXISTS "exam_subjects_update_admin" ON public.exam_subjects';
    EXECUTE 'DROP POLICY IF EXISTS "exam_subjects_delete_admin" ON public.exam_subjects';

    EXECUTE 'CREATE POLICY "exam_subjects_read_public" ON public.exam_subjects FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "exam_subjects_insert_admin" ON public.exam_subjects FOR INSERT TO authenticated WITH CHECK (public.is_admin((SELECT auth.uid())))';
    EXECUTE 'CREATE POLICY "exam_subjects_update_admin" ON public.exam_subjects FOR UPDATE TO authenticated USING (public.is_admin((SELECT auth.uid()))) WITH CHECK (public.is_admin((SELECT auth.uid())))';
    EXECUTE 'CREATE POLICY "exam_subjects_delete_admin" ON public.exam_subjects FOR DELETE TO authenticated USING (public.is_admin((SELECT auth.uid())))';
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.school_scores') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Public read school_scores" ON public.school_scores';
    EXECUTE 'DROP POLICY IF EXISTS "school_scores_read_public" ON public.school_scores';
    EXECUTE 'DROP POLICY IF EXISTS "school_scores_insert_admin" ON public.school_scores';
    EXECUTE 'DROP POLICY IF EXISTS "school_scores_update_admin" ON public.school_scores';
    EXECUTE 'DROP POLICY IF EXISTS "school_scores_delete_admin" ON public.school_scores';

    EXECUTE 'CREATE POLICY "school_scores_read_public" ON public.school_scores FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "school_scores_insert_admin" ON public.school_scores FOR INSERT TO authenticated WITH CHECK (public.is_admin((SELECT auth.uid())))';
    EXECUTE 'CREATE POLICY "school_scores_update_admin" ON public.school_scores FOR UPDATE TO authenticated USING (public.is_admin((SELECT auth.uid()))) WITH CHECK (public.is_admin((SELECT auth.uid())))';
    EXECUTE 'CREATE POLICY "school_scores_delete_admin" ON public.school_scores FOR DELETE TO authenticated USING (public.is_admin((SELECT auth.uid())))';
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.user_notes') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view their own notes" ON public.user_notes';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert their own notes" ON public.user_notes';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update their own notes" ON public.user_notes';
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete their own notes" ON public.user_notes';
    EXECUTE 'DROP POLICY IF EXISTS "user_notes_select_own" ON public.user_notes';
    EXECUTE 'DROP POLICY IF EXISTS "user_notes_insert_own" ON public.user_notes';
    EXECUTE 'DROP POLICY IF EXISTS "user_notes_update_own" ON public.user_notes';
    EXECUTE 'DROP POLICY IF EXISTS "user_notes_delete_own" ON public.user_notes';

    EXECUTE 'CREATE POLICY "user_notes_select_own" ON public.user_notes FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()))';
    EXECUTE 'CREATE POLICY "user_notes_insert_own" ON public.user_notes FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()))';
    EXECUTE 'CREATE POLICY "user_notes_update_own" ON public.user_notes FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()))';
    EXECUTE 'CREATE POLICY "user_notes_delete_own" ON public.user_notes FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()))';
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_deleted_exam_tombstones_deleted_by
  ON public.deleted_exam_tombstones (deleted_by)
  WHERE deleted_by IS NOT NULL;

DROP INDEX IF EXISTS public.idx_user_access_log_user_date;

DROP POLICY IF EXISTS "deleted_exam_tombstones_admin_all" ON public.deleted_exam_tombstones;
CREATE POLICY "deleted_exam_tombstones_admin_all" ON public.deleted_exam_tombstones
  FOR ALL TO authenticated
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "sync_logs_admin_select" ON public.sync_logs;
CREATE POLICY "sync_logs_admin_select" ON public.sync_logs
  FOR SELECT TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "orders_select_own_or_admin" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_own_only" ON public.orders;
DROP POLICY IF EXISTS "orders_update_admin_only" ON public.orders;
DROP POLICY IF EXISTS "orders_select_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_update_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_delete_policy" ON public.orders;

CREATE POLICY "orders_select_own_or_admin" ON public.orders
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_admin((SELECT auth.uid()))
  );

CREATE POLICY "orders_insert_own_only" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "orders_update_admin_only" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));

CREATE POLICY "orders_delete_admin_only" ON public.orders
  FOR DELETE TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "payment_logs_admin_only" ON public.payment_logs;
DROP POLICY IF EXISTS "payment_logs_insert_admin_only" ON public.payment_logs;
DROP POLICY IF EXISTS "payment_logs_admin_select" ON public.payment_logs;
DROP POLICY IF EXISTS "transactions_admin_only" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert_admin_only" ON public.transactions;
DROP POLICY IF EXISTS "transactions_admin_select" ON public.transactions;

CREATE POLICY "payment_logs_admin_select" ON public.payment_logs
  FOR SELECT TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

CREATE POLICY "transactions_admin_select" ON public.transactions
  FOR SELECT TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

-- ---------------------------------------------------------------------------
-- 4. Function privilege/search_path hardening.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  signature text;
  fn regprocedure;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public._rescore_exam_results_for_exam(text)',
    'public._trg_rescore_exam_results_on_exam_keys()',
    'public.resolve_exam_key_lookup(text)',
    'public.set_order_transfer_code()',
    'public.order_transfer_code_from_uuid(uuid)'
  ]
  LOOP
    fn := to_regprocedure(signature);
    CONTINUE WHEN fn IS NULL;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

DO $$
DECLARE
  function_name text;
  fn regprocedure;
BEGIN
  FOREACH function_name IN ARRAY ARRAY[
    'list_exam_answer_files',
    'calculate_flat_score',
    'admin_delete_exam_bundle',
    'admin_list_exam_subjects',
    'admin_upsert_exam_subject',
    'admin_delete_exam_subject',
    'normalize_answers_to_flat'
  ]
  LOOP
    FOR fn IN
      SELECT p.oid::regprocedure
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = function_name
    LOOP
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, auth, storage, extensions', fn);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    END LOOP;
  END LOOP;
END;
$$;

-- Admin RPCs still execute through authenticated browser sessions, but every
-- function checks public.is_admin(auth.uid()) before touching protected data.
DO $$
DECLARE
  function_name text;
  fn regprocedure;
BEGIN
  FOREACH function_name IN ARRAY ARRAY[
    'admin_clear_deleted_exam_marker',
    'admin_delete_exam_bundle',
    'admin_delete_exam_key',
    'admin_delete_exam_subject',
    'admin_get_exam_key',
    'admin_get_thongsoai_candidates',
    'admin_list_exam_answer_status',
    'admin_list_exam_keys',
    'admin_list_exam_subjects',
    'admin_mark_exam_deleted',
    'admin_update_exam_identity',
    'admin_upsert_exam_answer_resource',
    'admin_upsert_exam_key_bundle',
    'admin_upsert_exam_subject',
    'admin_user_directory'
  ]
  LOOP
    FOR fn IN
      SELECT p.oid::regprocedure
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = function_name
    LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
    END LOOP;
  END LOOP;
END;
$$;
