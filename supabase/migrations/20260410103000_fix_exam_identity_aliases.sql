-- Preserve canonical exam identity while keeping old ids/routes as aliases.
-- Also expose a safe public metadata RPC so frontend can resolve bundle paths
-- without leaking VIP/admin-only resources.

CREATE OR REPLACE FUNCTION public.resolve_exam_key_lookup(p_exam_lookup text)
RETURNS TABLE (
  exam_id text,
  answer_key jsonb,
  resources jsonb,
  last_synced_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH input_value AS (
    SELECT
      trim(COALESCE(p_exam_lookup, '')) AS raw_lookup,
      lower(trim(COALESCE(p_exam_lookup, ''))) AS normalized_lookup
  ),
  ranked AS (
    SELECT
      ek.exam_id,
      ek.answer_key,
      ek.resources,
      ek.last_synced_at,
      ek.created_at,
      (
        CASE WHEN lower(ek.exam_id) = iv.normalized_lookup THEN 100 ELSE 0 END +
        CASE WHEN lower(COALESCE(ek.resources->>'exam_id', '')) = iv.normalized_lookup THEN 95 ELSE 0 END +
        CASE WHEN lower(COALESCE(ek.resources->>'examId', '')) = iv.normalized_lookup THEN 95 ELSE 0 END +
        CASE WHEN lower(COALESCE(ek.resources->>'exam_path', '')) = iv.normalized_lookup THEN 90 ELSE 0 END +
        CASE WHEN lower(COALESCE(ek.resources->>'examPath', '')) = iv.normalized_lookup THEN 90 ELSE 0 END +
        CASE WHEN lower(COALESCE(ek.resources->>'path', '')) = iv.normalized_lookup THEN 85 ELSE 0 END +
        CASE WHEN lower(COALESCE(ek.resources->>'bundle_path', '')) = iv.normalized_lookup THEN 82 ELSE 0 END +
        CASE WHEN lower(COALESCE(ek.resources->>'bundlePath', '')) = iv.normalized_lookup THEN 82 ELSE 0 END +
        CASE WHEN lower(COALESCE(ek.resources->>'content_path', '')) = iv.normalized_lookup THEN 80 ELSE 0 END +
        CASE WHEN lower(COALESCE(ek.resources->>'contentPath', '')) = iv.normalized_lookup THEN 80 ELSE 0 END +
        CASE WHEN lower(COALESCE(ek.resources->>'id', '')) = iv.normalized_lookup THEN 75 ELSE 0 END +
        CASE WHEN lower(COALESCE(ek.resources->>'legacy_exam_id', '')) = iv.normalized_lookup THEN 70 ELSE 0 END +
        CASE WHEN lower(COALESCE(ek.resources->>'legacy_exam_path', '')) = iv.normalized_lookup THEN 68 ELSE 0 END +
        CASE WHEN EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(
            CASE
              WHEN jsonb_typeof(ek.resources->'legacy_exam_ids') = 'array' THEN ek.resources->'legacy_exam_ids'
              WHEN jsonb_typeof(ek.resources->'legacyExamIds') = 'array' THEN ek.resources->'legacyExamIds'
              ELSE '[]'::jsonb
            END
          ) AS legacy_exam_ids(value)
          WHERE lower(trim(legacy_exam_ids.value)) = iv.normalized_lookup
        ) THEN 65 ELSE 0 END +
        CASE WHEN EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(
            CASE
              WHEN jsonb_typeof(ek.resources->'legacy_exam_paths') = 'array' THEN ek.resources->'legacy_exam_paths'
              WHEN jsonb_typeof(ek.resources->'legacyExamPaths') = 'array' THEN ek.resources->'legacyExamPaths'
              ELSE '[]'::jsonb
            END
          ) AS legacy_exam_paths(value)
          WHERE lower(trim(legacy_exam_paths.value)) = iv.normalized_lookup
        ) THEN 63 ELSE 0 END
      ) AS match_score,
      iv.raw_lookup
    FROM public.exam_keys ek
    CROSS JOIN input_value iv
    WHERE iv.normalized_lookup <> ''
      AND (
        lower(ek.exam_id) = iv.normalized_lookup
        OR lower(COALESCE(ek.resources->>'exam_id', '')) = iv.normalized_lookup
        OR lower(COALESCE(ek.resources->>'examId', '')) = iv.normalized_lookup
        OR lower(COALESCE(ek.resources->>'exam_path', '')) = iv.normalized_lookup
        OR lower(COALESCE(ek.resources->>'examPath', '')) = iv.normalized_lookup
        OR lower(COALESCE(ek.resources->>'path', '')) = iv.normalized_lookup
        OR lower(COALESCE(ek.resources->>'bundle_path', '')) = iv.normalized_lookup
        OR lower(COALESCE(ek.resources->>'bundlePath', '')) = iv.normalized_lookup
        OR lower(COALESCE(ek.resources->>'content_path', '')) = iv.normalized_lookup
        OR lower(COALESCE(ek.resources->>'contentPath', '')) = iv.normalized_lookup
        OR lower(COALESCE(ek.resources->>'id', '')) = iv.normalized_lookup
        OR lower(COALESCE(ek.resources->>'legacy_exam_id', '')) = iv.normalized_lookup
        OR lower(COALESCE(ek.resources->>'legacy_exam_path', '')) = iv.normalized_lookup
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(
            CASE
              WHEN jsonb_typeof(ek.resources->'legacy_exam_ids') = 'array' THEN ek.resources->'legacy_exam_ids'
              WHEN jsonb_typeof(ek.resources->'legacyExamIds') = 'array' THEN ek.resources->'legacyExamIds'
              ELSE '[]'::jsonb
            END
          ) AS legacy_exam_ids(value)
          WHERE lower(trim(legacy_exam_ids.value)) = iv.normalized_lookup
        )
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(
            CASE
              WHEN jsonb_typeof(ek.resources->'legacy_exam_paths') = 'array' THEN ek.resources->'legacy_exam_paths'
              WHEN jsonb_typeof(ek.resources->'legacyExamPaths') = 'array' THEN ek.resources->'legacyExamPaths'
              ELSE '[]'::jsonb
            END
          ) AS legacy_exam_paths(value)
          WHERE lower(trim(legacy_exam_paths.value)) = iv.normalized_lookup
        )
      )
  )
  SELECT
    r.exam_id,
    r.answer_key,
    r.resources,
    r.last_synced_at,
    r.created_at
  FROM ranked r
  WHERE r.match_score > 0
  ORDER BY
    r.match_score DESC,
    (lower(r.exam_id) = lower(r.raw_lookup)) DESC,
    COALESCE(r.last_synced_at, r.created_at) DESC,
    r.exam_id ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_exam_key_lookup(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_exam_key_lookup(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_exam_key_lookup(text) TO service_role;

CREATE OR REPLACE FUNCTION public.public_get_exam_resources(p_exam_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam_id text;
  v_resources jsonb := '{}'::jsonb;
  v_title text;
  v_subject_folder text;
  v_exam_path text;
  v_bundle_path text;
  v_description text;
  v_status text;
  v_icon text;
  v_color text;
  v_document_url text;
  v_duration_minutes integer;
  v_question_count integer;
  v_updated_at timestamptz;
  v_legacy_exam_ids text[] := ARRAY[]::text[];
  v_legacy_exam_paths text[] := ARRAY[]::text[];
BEGIN
  SELECT
    r.exam_id,
    COALESCE(r.resources, '{}'::jsonb),
    COALESCE(r.last_synced_at, r.created_at, now())
  INTO
    v_exam_id,
    v_resources,
    v_updated_at
  FROM public.resolve_exam_key_lookup(p_exam_id) r
  LIMIT 1;

  IF v_exam_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_title := NULLIF(trim(COALESCE(
    v_resources->>'title',
    v_resources->>'exam_title',
    v_resources->>'examTitle',
    v_exam_id
  )), '');
  v_subject_folder := NULLIF(lower(trim(COALESCE(
    v_resources->>'subject_folder',
    v_resources->>'subjectFolder',
    v_resources->>'subject',
    ''
  ))), '');
  v_exam_path := NULLIF(trim(COALESCE(
    v_resources->>'exam_path',
    v_resources->>'examPath',
    v_resources->>'path',
    v_resources->>'id',
    v_exam_id
  )), '');
  v_bundle_path := NULLIF(trim(COALESCE(
    v_resources->>'bundle_path',
    v_resources->>'bundlePath',
    v_resources->>'content_path',
    v_resources->>'contentPath',
    v_exam_path,
    v_exam_id
  )), '');
  v_description := NULLIF(trim(COALESCE(v_resources->>'description', '')), '');
  v_status := NULLIF(trim(COALESCE(v_resources->>'status', 'ongoing')), '');
  v_icon := NULLIF(trim(COALESCE(v_resources->>'icon', 'quiz')), '');
  v_color := NULLIF(trim(COALESCE(v_resources->>'color', '')), '');
  v_document_url := NULLIF(trim(COALESCE(
    v_resources->>'document_url',
    v_resources->>'documentUrl',
    ''
  )), '');

  v_duration_minutes := CASE
    WHEN trim(COALESCE(v_resources->>'time', '')) ~ '^\d+$'
      THEN (v_resources->>'time')::integer
    WHEN trim(COALESCE(v_resources->>'duration_minutes', '')) ~ '^\d+$'
      THEN (v_resources->>'duration_minutes')::integer
    WHEN trim(COALESCE(v_resources->>'durationMinutes', '')) ~ '^\d+$'
      THEN (v_resources->>'durationMinutes')::integer
    ELSE NULL
  END;

  v_question_count := CASE
    WHEN trim(COALESCE(v_resources->>'questions', '')) ~ '^\d+$'
      THEN (v_resources->>'questions')::integer
    WHEN trim(COALESCE(v_resources->>'question_count', '')) ~ '^\d+$'
      THEN (v_resources->>'question_count')::integer
    WHEN trim(COALESCE(v_resources->>'questionCount', '')) ~ '^\d+$'
      THEN (v_resources->>'questionCount')::integer
    ELSE NULL
  END;

  SELECT COALESCE(array_agg(value ORDER BY lower(value), value), ARRAY[]::text[])
    INTO v_legacy_exam_ids
  FROM (
    SELECT DISTINCT value
    FROM (
      SELECT trim(COALESCE(v_resources->>'legacy_exam_id', '')) AS value
      UNION ALL
      SELECT trim(value)
      FROM jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(v_resources->'legacy_exam_ids') = 'array' THEN v_resources->'legacy_exam_ids'
          ELSE '[]'::jsonb
        END
      ) AS legacy_exam_ids(value)
      UNION ALL
      SELECT trim(value)
      FROM jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(v_resources->'legacyExamIds') = 'array' THEN v_resources->'legacyExamIds'
          ELSE '[]'::jsonb
        END
      ) AS legacy_exam_ids(value)
    ) AS source_values
    WHERE value <> ''
      AND lower(value) <> lower(v_exam_id)
  ) AS deduped_values;

  SELECT COALESCE(array_agg(value ORDER BY lower(value), value), ARRAY[]::text[])
    INTO v_legacy_exam_paths
  FROM (
    SELECT DISTINCT value
    FROM (
      SELECT trim(COALESCE(v_resources->>'legacy_exam_path', '')) AS value
      UNION ALL
      SELECT trim(value)
      FROM jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(v_resources->'legacy_exam_paths') = 'array' THEN v_resources->'legacy_exam_paths'
          ELSE '[]'::jsonb
        END
      ) AS legacy_exam_paths(value)
      UNION ALL
      SELECT trim(value)
      FROM jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(v_resources->'legacyExamPaths') = 'array' THEN v_resources->'legacyExamPaths'
          ELSE '[]'::jsonb
        END
      ) AS legacy_exam_paths(value)
    ) AS source_values
    WHERE value <> ''
      AND (v_exam_path IS NULL OR lower(value) <> lower(v_exam_path))
  ) AS deduped_values;

  RETURN jsonb_strip_nulls(jsonb_build_object(
    'exam_id', v_exam_id,
    'title', v_title,
    'subject_folder', v_subject_folder,
    'exam_path', v_exam_path,
    'bundle_path', v_bundle_path,
    'description', v_description,
    'time', v_duration_minutes,
    'duration_minutes', v_duration_minutes,
    'questions', v_question_count,
    'question_count', v_question_count,
    'status', v_status,
    'icon', v_icon,
    'color', v_color,
    'document_url', v_document_url,
    'legacy_exam_id', CASE WHEN COALESCE(array_length(v_legacy_exam_ids, 1), 0) > 0 THEN v_legacy_exam_ids[1] ELSE NULL END,
    'legacy_exam_ids', to_jsonb(v_legacy_exam_ids),
    'legacy_exam_path', CASE WHEN COALESCE(array_length(v_legacy_exam_paths, 1), 0) > 0 THEN v_legacy_exam_paths[1] ELSE NULL END,
    'legacy_exam_paths', to_jsonb(v_legacy_exam_paths),
    'updated_at', v_updated_at
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.public_get_exam_resources(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_get_exam_resources(text) TO anon;
GRANT EXECUTE ON FUNCTION public.public_get_exam_resources(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_get_exam_resources(text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_update_exam_identity(
  p_current_exam_id text,
  p_next_exam_id text DEFAULT NULL,
  p_subject_folder text DEFAULT NULL,
  p_next_exam_path text DEFAULT NULL,
  p_bundle_path text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_input_current_exam_id text := trim(COALESCE(p_current_exam_id, ''));
  v_requested_next_exam_id text := trim(COALESCE(p_next_exam_id, ''));
  v_current_exam_id text;
  v_current_answer_key jsonb := '{}'::jsonb;
  v_current_resources jsonb := '{}'::jsonb;
  v_current_exam_path text;
  v_next_exam_id text;
  v_next_exam_path text;
  v_bundle_path text;
  v_subject_folder text;
  v_target_conflict_exam_id text;
  v_legacy_exam_ids text[] := ARRAY[]::text[];
  v_legacy_exam_paths text[] := ARRAY[]::text[];
  v_row public.exam_keys%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  IF v_input_current_exam_id = '' THEN
    RAISE EXCEPTION 'current exam_id is required';
  END IF;

  SELECT
    r.exam_id,
    public.normalize_exam_answer_payload(COALESCE(r.answer_key, '{}'::jsonb)),
    COALESCE(r.resources, '{}'::jsonb)
  INTO
    v_current_exam_id,
    v_current_answer_key,
    v_current_resources
  FROM public.resolve_exam_key_lookup(v_input_current_exam_id) r
  LIMIT 1;

  IF v_current_exam_id IS NULL THEN
    RAISE EXCEPTION 'Exam key bundle not found for: %', v_input_current_exam_id;
  END IF;

  DELETE FROM public.exam_keys
  WHERE lower(exam_id) = lower(v_current_exam_id)
    AND exam_id <> v_current_exam_id;

  v_next_exam_id := COALESCE(NULLIF(v_requested_next_exam_id, ''), v_current_exam_id);
  v_subject_folder := NULLIF(lower(trim(COALESCE(
    p_subject_folder,
    v_current_resources->>'subject_folder',
    v_current_resources->>'subjectFolder',
    v_current_resources->>'subject',
    ''
  ))), '');
  v_current_exam_path := trim(COALESCE(
    v_current_resources->>'exam_path',
    v_current_resources->>'examPath',
    v_current_resources->>'path',
    v_current_resources->>'id',
    v_current_exam_id
  ));
  v_next_exam_path := trim(COALESCE(
    NULLIF(p_next_exam_path, ''),
    v_current_resources->>'exam_path',
    v_current_resources->>'examPath',
    v_current_resources->>'path',
    v_current_resources->>'id',
    v_next_exam_id
  ));
  v_bundle_path := trim(COALESCE(
    NULLIF(p_bundle_path, ''),
    v_current_resources->>'bundle_path',
    v_current_resources->>'bundlePath',
    v_current_resources->>'content_path',
    v_current_resources->>'contentPath',
    v_current_exam_path,
    v_current_exam_id
  ));

  IF v_next_exam_id = '' THEN
    RAISE EXCEPTION 'next exam_id is required';
  END IF;

  IF v_next_exam_path = '' THEN
    v_next_exam_path := v_next_exam_id;
  END IF;

  IF v_bundle_path = '' THEN
    v_bundle_path := v_current_exam_path;
  END IF;

  SELECT ek.exam_id
  INTO v_target_conflict_exam_id
  FROM public.exam_keys ek
  WHERE lower(ek.exam_id) = lower(v_next_exam_id)
    AND lower(ek.exam_id) <> lower(v_current_exam_id)
  ORDER BY COALESCE(ek.last_synced_at, ek.created_at) DESC, ek.exam_id ASC
  LIMIT 1;

  IF v_target_conflict_exam_id IS NOT NULL THEN
    RAISE EXCEPTION 'Target exam_id already exists: %', v_target_conflict_exam_id;
  END IF;

  SELECT COALESCE(array_agg(value ORDER BY lower(value), value), ARRAY[]::text[])
    INTO v_legacy_exam_ids
  FROM (
    SELECT DISTINCT value
    FROM (
      SELECT trim(COALESCE(v_current_resources->>'legacy_exam_id', '')) AS value
      UNION ALL
      SELECT trim(value)
      FROM jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(v_current_resources->'legacy_exam_ids') = 'array' THEN v_current_resources->'legacy_exam_ids'
          ELSE '[]'::jsonb
        END
      ) AS legacy_exam_ids(value)
      UNION ALL
      SELECT trim(value)
      FROM jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(v_current_resources->'legacyExamIds') = 'array' THEN v_current_resources->'legacyExamIds'
          ELSE '[]'::jsonb
        END
      ) AS legacy_exam_ids(value)
      UNION ALL
      SELECT v_current_exam_id
      WHERE lower(v_current_exam_id) <> lower(v_next_exam_id)
    ) AS source_values
    WHERE value <> ''
      AND lower(value) <> lower(v_next_exam_id)
  ) AS deduped_values;

  SELECT COALESCE(array_agg(value ORDER BY lower(value), value), ARRAY[]::text[])
    INTO v_legacy_exam_paths
  FROM (
    SELECT DISTINCT value
    FROM (
      SELECT trim(COALESCE(v_current_resources->>'legacy_exam_path', '')) AS value
      UNION ALL
      SELECT trim(value)
      FROM jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(v_current_resources->'legacy_exam_paths') = 'array' THEN v_current_resources->'legacy_exam_paths'
          ELSE '[]'::jsonb
        END
      ) AS legacy_exam_paths(value)
      UNION ALL
      SELECT trim(value)
      FROM jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(v_current_resources->'legacyExamPaths') = 'array' THEN v_current_resources->'legacyExamPaths'
          ELSE '[]'::jsonb
        END
      ) AS legacy_exam_paths(value)
      UNION ALL
      SELECT v_current_exam_path
      WHERE lower(v_current_exam_path) <> lower(v_next_exam_path)
    ) AS source_values
    WHERE value <> ''
      AND lower(value) <> lower(v_next_exam_path)
  ) AS deduped_values;

  v_current_resources := COALESCE(v_current_resources, '{}'::jsonb)
    - 'legacy_exam_id'
    - 'legacy_exam_ids'
    - 'legacyExamIds'
    - 'legacy_exam_path'
    - 'legacy_exam_paths'
    - 'legacyExamPaths';

  v_current_resources := v_current_resources || jsonb_strip_nulls(jsonb_build_object(
    'exam_id', v_next_exam_id,
    'examId', v_next_exam_id,
    'id', v_next_exam_path,
    'exam_path', v_next_exam_path,
    'examPath', v_next_exam_path,
    'path', v_next_exam_path,
    'bundle_path', v_bundle_path,
    'bundlePath', v_bundle_path,
    'content_path', v_bundle_path,
    'contentPath', v_bundle_path,
    'subject_folder', v_subject_folder,
    'subjectFolder', v_subject_folder,
    'subject', v_subject_folder,
    'legacy_exam_id', CASE WHEN COALESCE(array_length(v_legacy_exam_ids, 1), 0) > 0 THEN v_legacy_exam_ids[1] ELSE NULL END,
    'legacy_exam_ids', to_jsonb(v_legacy_exam_ids),
    'legacyExamIds', to_jsonb(v_legacy_exam_ids),
    'legacy_exam_path', CASE WHEN COALESCE(array_length(v_legacy_exam_paths, 1), 0) > 0 THEN v_legacy_exam_paths[1] ELSE NULL END,
    'legacy_exam_paths', to_jsonb(v_legacy_exam_paths),
    'legacyExamPaths', to_jsonb(v_legacy_exam_paths)
  ));

  UPDATE public.exam_results
  SET
    exam_id = v_next_exam_id,
    subject_folder = COALESCE(v_subject_folder, subject_folder)
  WHERE lower(exam_id) = lower(v_current_exam_id)
     OR lower(exam_id) = lower(v_input_current_exam_id);

  UPDATE public.exam_progress
  SET
    exam_id = v_next_exam_id,
    subject_folder = COALESCE(v_subject_folder, subject_folder),
    updated_at = now()
  WHERE lower(exam_id) = lower(v_current_exam_id)
     OR lower(exam_id) = lower(v_input_current_exam_id);

  UPDATE public.user_access_log
  SET exam_id = v_next_exam_id
  WHERE lower(exam_id) = lower(v_current_exam_id)
     OR lower(exam_id) = lower(v_input_current_exam_id);

  UPDATE public.sync_logs
  SET exam_id = v_next_exam_id
  WHERE lower(exam_id) = lower(v_current_exam_id)
     OR lower(exam_id) = lower(v_input_current_exam_id);

  IF v_subject_folder IS NOT NULL AND v_next_exam_path <> '' THEN
    DELETE FROM public.deleted_exam_tombstones
    WHERE identity_key = lower(v_subject_folder) || ':' || lower(v_next_exam_path);
  END IF;

  UPDATE public.exam_keys
  SET
    exam_id = v_next_exam_id,
    answer_key = v_current_answer_key,
    resources = v_current_resources,
    last_synced_at = now()
  WHERE exam_id = v_current_exam_id
  RETURNING *
  INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to update exam identity for: %', v_current_exam_id;
  END IF;

  RETURN jsonb_build_object(
    'exam_id', v_row.exam_id,
    'exam_path', v_next_exam_path,
    'bundle_path', v_bundle_path,
    'legacy_exam_ids', to_jsonb(v_legacy_exam_ids),
    'legacy_exam_paths', to_jsonb(v_legacy_exam_paths),
    'resources', v_row.resources,
    'last_synced_at', v_row.last_synced_at,
    'created_at', v_row.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_exam_identity(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_exam_identity(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_exam_identity(text, text, text, text, text) TO service_role;
