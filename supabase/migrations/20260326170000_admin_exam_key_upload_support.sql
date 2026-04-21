-- Admin tools for managing exam answer keys and answer files via web UI.

ALTER TABLE public.exam_keys
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.admin_list_exam_keys()
RETURNS TABLE (
  exam_id text,
  answer_key jsonb,
  resources jsonb,
  last_synced_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  SELECT
    ek.exam_id,
    ek.answer_key,
    ek.resources,
    ek.last_synced_at,
    ek.created_at
  FROM public.exam_keys ek
  ORDER BY COALESCE(ek.last_synced_at, ek.created_at) DESC, ek.exam_id ASC;
END;
$$;

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

  SELECT *
    INTO v_row
    FROM public.exam_keys
   WHERE exam_id = v_exam_id;

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
   WHERE exam_id = v_exam_id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_exam_keys() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_exam_keys() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_exam_keys() TO service_role;

REVOKE ALL ON FUNCTION public.admin_get_exam_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_exam_key(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_exam_key(text) TO service_role;

REVOKE ALL ON FUNCTION public.admin_upsert_exam_key_bundle(text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_upsert_exam_key_bundle(text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_exam_key_bundle(text, jsonb, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.admin_delete_exam_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_exam_key(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_exam_key(text) TO service_role;

INSERT INTO storage.buckets (id, name, public)
VALUES ('exam-answer-files', 'exam-answer-files', true)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public;

DROP POLICY IF EXISTS exam_answer_files_admin_select ON storage.objects;
DROP POLICY IF EXISTS exam_answer_files_admin_insert ON storage.objects;
DROP POLICY IF EXISTS exam_answer_files_admin_update ON storage.objects;
DROP POLICY IF EXISTS exam_answer_files_admin_delete ON storage.objects;

CREATE POLICY exam_answer_files_admin_select
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'exam-answer-files'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

CREATE POLICY exam_answer_files_admin_insert
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'exam-answer-files'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

CREATE POLICY exam_answer_files_admin_update
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'exam-answer-files'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'exam-answer-files'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

CREATE POLICY exam_answer_files_admin_delete
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'exam-answer-files'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);
