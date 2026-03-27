-- Public exam index for frontend auto-sync and admin bundle delete for consistency.

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
  ORDER BY n.updated_at DESC, n.exam_id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.public_list_exam_index() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_list_exam_index() TO anon;
GRANT EXECUTE ON FUNCTION public.public_list_exam_index() TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_list_exam_index() TO service_role;

CREATE OR REPLACE FUNCTION public.admin_delete_exam_bundle(p_exam_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam_id text := trim(COALESCE(p_exam_id, ''));
  v_deleted_keys integer := 0;
  v_deleted_results integer := 0;
  v_deleted_progress integer := 0;
  v_deleted_access integer := 0;
  v_deleted_sync_logs integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  IF v_exam_id = '' THEN
    RAISE EXCEPTION 'exam_id is required';
  END IF;

  DELETE FROM public.exam_results
  WHERE lower(exam_id) = lower(v_exam_id);
  GET DIAGNOSTICS v_deleted_results = ROW_COUNT;

  DELETE FROM public.exam_progress
  WHERE lower(exam_id) = lower(v_exam_id);
  GET DIAGNOSTICS v_deleted_progress = ROW_COUNT;

  DELETE FROM public.user_access_log
  WHERE lower(exam_id) = lower(v_exam_id);
  GET DIAGNOSTICS v_deleted_access = ROW_COUNT;

  DELETE FROM public.sync_logs
  WHERE lower(exam_id) = lower(v_exam_id);
  GET DIAGNOSTICS v_deleted_sync_logs = ROW_COUNT;

  DELETE FROM public.exam_keys
  WHERE lower(exam_id) = lower(v_exam_id);
  GET DIAGNOSTICS v_deleted_keys = ROW_COUNT;

  RETURN jsonb_build_object(
    'exam_id', v_exam_id,
    'deleted_exam_keys', v_deleted_keys,
    'deleted_exam_results', v_deleted_results,
    'deleted_exam_progress', v_deleted_progress,
    'deleted_user_access_logs', v_deleted_access,
    'deleted_sync_logs', v_deleted_sync_logs,
    'deleted', (v_deleted_keys > 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_exam_bundle(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_exam_bundle(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_exam_bundle(text) TO service_role;
