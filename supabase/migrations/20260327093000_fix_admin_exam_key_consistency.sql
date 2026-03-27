-- Harden exam key admin RPCs for case-insensitive consistency and alias cleanup.
-- This prevents stale answer keys when exam_id casing changed across local/public data.

CREATE OR REPLACE FUNCTION public.admin_get_exam_key(p_exam_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam_id text := trim(COALESCE(p_exam_id, ''));
  v_row public.exam_keys%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  IF v_exam_id = '' THEN
    RAISE EXCEPTION 'exam_id is required';
  END IF;

  -- Prefer exact id, fallback to case-insensitive match.
  SELECT *
    INTO v_row
    FROM public.exam_keys ek
   WHERE lower(ek.exam_id) = lower(v_exam_id)
   ORDER BY (ek.exam_id = v_exam_id) DESC, COALESCE(ek.last_synced_at, ek.created_at) DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'exam_id', v_row.exam_id,
    'answer_key', v_row.answer_key,
    'resources', v_row.resources,
    'last_synced_at', v_row.last_synced_at,
    'created_at', v_row.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_exam_key_bundle(
  p_exam_id text,
  p_answer_key jsonb DEFAULT '{}'::jsonb,
  p_resources jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam_id text := trim(COALESCE(p_exam_id, ''));
  v_row public.exam_keys%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  IF v_exam_id = '' THEN
    RAISE EXCEPTION 'exam_id is required';
  END IF;

  -- Remove stale aliases that differ only by letter case.
  DELETE FROM public.exam_keys
   WHERE lower(exam_id) = lower(v_exam_id)
     AND exam_id <> v_exam_id;

  INSERT INTO public.exam_keys (
    exam_id,
    answer_key,
    resources,
    created_at,
    last_synced_at
  )
  VALUES (
    v_exam_id,
    COALESCE(p_answer_key, '{}'::jsonb),
    COALESCE(p_resources, '{}'::jsonb),
    now(),
    now()
  )
  ON CONFLICT (exam_id) DO UPDATE
  SET
    answer_key = COALESCE(EXCLUDED.answer_key, public.exam_keys.answer_key),
    resources = COALESCE(public.exam_keys.resources, '{}'::jsonb) || COALESCE(EXCLUDED.resources, '{}'::jsonb),
    last_synced_at = now()
  RETURNING *
  INTO v_row;

  RETURN jsonb_build_object(
    'exam_id', v_row.exam_id,
    'answer_key', v_row.answer_key,
    'resources', v_row.resources,
    'last_synced_at', v_row.last_synced_at,
    'created_at', v_row.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_exam_key(p_exam_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam_id text := trim(COALESCE(p_exam_id, ''));
  v_deleted_count integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  IF v_exam_id = '' THEN
    RAISE EXCEPTION 'exam_id is required';
  END IF;

  DELETE FROM public.exam_keys
   WHERE lower(exam_id) = lower(v_exam_id);

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count > 0;
END;
$$;
