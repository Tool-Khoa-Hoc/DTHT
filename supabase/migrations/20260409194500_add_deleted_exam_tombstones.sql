CREATE TABLE IF NOT EXISTS public.deleted_exam_tombstones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_key text NOT NULL UNIQUE,
  exam_id text,
  subject_folder text NOT NULL,
  exam_path text NOT NULL,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deleted_exam_tombstones_exam_id
  ON public.deleted_exam_tombstones ((lower(COALESCE(exam_id, ''))));

ALTER TABLE public.deleted_exam_tombstones ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.public_list_deleted_exam_tombstones()
RETURNS TABLE (
  identity_key text,
  exam_id text,
  subject_folder text,
  exam_path text,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.identity_key,
    d.exam_id,
    d.subject_folder,
    d.exam_path,
    d.updated_at
  FROM public.deleted_exam_tombstones d
  ORDER BY d.updated_at DESC, d.identity_key ASC;
$$;

REVOKE ALL ON FUNCTION public.public_list_deleted_exam_tombstones() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_list_deleted_exam_tombstones() TO anon;
GRANT EXECUTE ON FUNCTION public.public_list_deleted_exam_tombstones() TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_list_deleted_exam_tombstones() TO service_role;

CREATE OR REPLACE FUNCTION public.admin_mark_exam_deleted(
  p_exam_id text,
  p_subject_folder text DEFAULT NULL,
  p_exam_path text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam_id_input text := trim(COALESCE(p_exam_id, ''));
  v_subject_folder text := lower(trim(COALESCE(p_subject_folder, '')));
  v_exam_path text := trim(COALESCE(p_exam_path, ''));
  v_resolved_exam_id text;
  v_resources jsonb := '{}'::jsonb;
  v_identity_key text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  SELECT
    r.exam_id,
    COALESCE(r.resources, '{}'::jsonb)
  INTO
    v_resolved_exam_id,
    v_resources
  FROM public.resolve_exam_key_lookup(v_exam_id_input) r
  LIMIT 1;

  IF v_subject_folder = '' THEN
    v_subject_folder := lower(trim(COALESCE(
      v_resources->>'subject_folder',
      v_resources->>'subjectFolder',
      v_resources->>'subject',
      ''
    )));
  END IF;

  IF v_exam_path = '' THEN
    v_exam_path := trim(COALESCE(
      v_resources->>'exam_path',
      v_resources->>'examPath',
      v_resources->>'path',
      v_resources->>'id',
      NULLIF(v_exam_id_input, ''),
      NULLIF(v_resolved_exam_id, '')
    ));
  END IF;

  IF v_subject_folder = '' OR v_exam_path = '' THEN
    RAISE EXCEPTION 'subject_folder and exam_path are required to mark exam deleted';
  END IF;

  v_identity_key := lower(v_subject_folder) || ':' || lower(v_exam_path);

  INSERT INTO public.deleted_exam_tombstones (
    identity_key,
    exam_id,
    subject_folder,
    exam_path,
    deleted_by,
    updated_at
  )
  VALUES (
    v_identity_key,
    COALESCE(NULLIF(v_resolved_exam_id, ''), NULLIF(v_exam_id_input, ''), NULL),
    v_subject_folder,
    v_exam_path,
    auth.uid(),
    now()
  )
  ON CONFLICT (identity_key) DO UPDATE
  SET
    exam_id = EXCLUDED.exam_id,
    subject_folder = EXCLUDED.subject_folder,
    exam_path = EXCLUDED.exam_path,
    deleted_by = EXCLUDED.deleted_by,
    updated_at = now();

  RETURN jsonb_build_object(
    'identity_key', v_identity_key,
    'exam_id', COALESCE(NULLIF(v_resolved_exam_id, ''), NULLIF(v_exam_id_input, ''), NULL),
    'subject_folder', v_subject_folder,
    'exam_path', v_exam_path,
    'deleted', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_mark_exam_deleted(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_mark_exam_deleted(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_exam_deleted(text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_clear_deleted_exam_marker(
  p_exam_id text,
  p_subject_folder text DEFAULT NULL,
  p_exam_path text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam_id_input text := trim(COALESCE(p_exam_id, ''));
  v_subject_folder text := lower(trim(COALESCE(p_subject_folder, '')));
  v_exam_path text := trim(COALESCE(p_exam_path, ''));
  v_resolved_exam_id text;
  v_resources jsonb := '{}'::jsonb;
  v_identity_key text := '';
  v_deleted_count integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  SELECT
    r.exam_id,
    COALESCE(r.resources, '{}'::jsonb)
  INTO
    v_resolved_exam_id,
    v_resources
  FROM public.resolve_exam_key_lookup(v_exam_id_input) r
  LIMIT 1;

  IF v_subject_folder = '' THEN
    v_subject_folder := lower(trim(COALESCE(
      v_resources->>'subject_folder',
      v_resources->>'subjectFolder',
      v_resources->>'subject',
      ''
    )));
  END IF;

  IF v_exam_path = '' THEN
    v_exam_path := trim(COALESCE(
      v_resources->>'exam_path',
      v_resources->>'examPath',
      v_resources->>'path',
      v_resources->>'id',
      NULLIF(v_exam_id_input, ''),
      NULLIF(v_resolved_exam_id, '')
    ));
  END IF;

  IF v_subject_folder <> '' AND v_exam_path <> '' THEN
    v_identity_key := lower(v_subject_folder) || ':' || lower(v_exam_path);
  END IF;

  DELETE FROM public.deleted_exam_tombstones d
  WHERE (v_identity_key <> '' AND d.identity_key = v_identity_key)
     OR (v_exam_id_input <> '' AND lower(COALESCE(d.exam_id, '')) = lower(v_exam_id_input))
     OR (v_resolved_exam_id IS NOT NULL AND lower(COALESCE(d.exam_id, '')) = lower(v_resolved_exam_id));

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'identity_key', NULLIF(v_identity_key, ''),
    'deleted_count', v_deleted_count,
    'cleared', (v_deleted_count > 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_clear_deleted_exam_marker(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_clear_deleted_exam_marker(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_deleted_exam_marker(text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.public_list_exam_index()
RETURNS TABLE (
  exam_id text,
  title text,
  subject_folder text,
  exam_path text,
  duration_minutes integer,
  question_count integer,
  status text,
  icon text,
  color text,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH source_rows AS (
    SELECT
      ek.exam_id,
      COALESCE(ek.resources, '{}'::jsonb) AS resources,
      COALESCE(ek.last_synced_at, ek.created_at, now()) AS row_updated_at
    FROM public.exam_keys ek
  ),
  normalized AS (
    SELECT
      trim(COALESCE(sr.exam_id, '')) AS exam_id,
      NULLIF(trim(COALESCE(
        sr.resources->>'title',
        sr.resources->>'exam_title',
        sr.resources->>'examTitle',
        sr.exam_id
      )), '') AS title,
      lower(trim(COALESCE(
        sr.resources->>'subject_folder',
        sr.resources->>'subjectFolder',
        sr.resources->>'subject',
        ''
      ))) AS subject_folder,
      trim(COALESCE(
        sr.resources->>'exam_path',
        sr.resources->>'examPath',
        sr.resources->>'path',
        sr.resources->>'id',
        sr.exam_id
      )) AS exam_path,
      CASE
        WHEN trim(COALESCE(sr.resources->>'time', '')) ~ '^\d+$'
          THEN (sr.resources->>'time')::integer
        WHEN trim(COALESCE(sr.resources->>'duration_minutes', '')) ~ '^\d+$'
          THEN (sr.resources->>'duration_minutes')::integer
        ELSE NULL
      END AS duration_minutes,
      CASE
        WHEN trim(COALESCE(sr.resources->>'questions', '')) ~ '^\d+$'
          THEN (sr.resources->>'questions')::integer
        WHEN trim(COALESCE(sr.resources->>'question_count', '')) ~ '^\d+$'
          THEN (sr.resources->>'question_count')::integer
        ELSE NULL
      END AS question_count,
      NULLIF(trim(COALESCE(sr.resources->>'status', 'ongoing')), '') AS status,
      NULLIF(trim(COALESCE(sr.resources->>'icon', 'quiz')), '') AS icon,
      NULLIF(trim(COALESCE(
        sr.resources->>'color',
        CASE
          WHEN lower(trim(COALESCE(
            sr.resources->>'subject_folder',
            sr.resources->>'subjectFolder',
            sr.resources->>'subject',
            ''
          ))) = 'toan' THEN 'from-blue-500 to-indigo-600'
          WHEN lower(trim(COALESCE(
            sr.resources->>'subject_folder',
            sr.resources->>'subjectFolder',
            sr.resources->>'subject',
            ''
          ))) = 'ly' THEN 'from-amber-500 to-orange-600'
          WHEN lower(trim(COALESCE(
            sr.resources->>'subject_folder',
            sr.resources->>'subjectFolder',
            sr.resources->>'subject',
            ''
          ))) = 'hoa' THEN 'from-green-500 to-emerald-600'
          WHEN lower(trim(COALESCE(
            sr.resources->>'subject_folder',
            sr.resources->>'subjectFolder',
            sr.resources->>'subject',
            ''
          ))) = 'sinh' THEN 'from-teal-500 to-cyan-600'
          ELSE 'from-slate-500 to-slate-700'
        END
      )), '') AS color,
      sr.row_updated_at AS updated_at
    FROM source_rows sr
  )
  SELECT
    n.exam_id,
    n.title,
    n.subject_folder,
    n.exam_path,
    n.duration_minutes,
    n.question_count,
    n.status,
    n.icon,
    n.color,
    n.updated_at
  FROM normalized n
  WHERE n.exam_id <> ''
    AND n.subject_folder <> ''
    AND n.exam_path <> ''
    AND NOT EXISTS (
      SELECT 1
      FROM public.deleted_exam_tombstones d
      WHERE d.identity_key = lower(n.subject_folder) || ':' || lower(n.exam_path)
    )
  ORDER BY n.updated_at DESC, n.exam_id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.public_list_exam_index() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_list_exam_index() TO anon;
GRANT EXECUTE ON FUNCTION public.public_list_exam_index() TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_list_exam_index() TO service_role;
