-- Resolve exam keys robustly by exam_id OR resource exam_path/id aliases.
-- Prevents "submit xong khong cham diem" when local route id differs from canonical exam_keys.exam_id.

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
        CASE WHEN lower(COALESCE(ek.resources->>'exam_path', '')) = iv.normalized_lookup THEN 90 ELSE 0 END +
        CASE WHEN lower(COALESCE(ek.resources->>'examPath', '')) = iv.normalized_lookup THEN 90 ELSE 0 END +
        CASE WHEN lower(COALESCE(ek.resources->>'path', '')) = iv.normalized_lookup THEN 80 ELSE 0 END +
        CASE WHEN lower(COALESCE(ek.resources->>'id', '')) = iv.normalized_lookup THEN 70 ELSE 0 END +
        CASE WHEN lower(COALESCE(ek.resources->>'legacy_exam_id', '')) = iv.normalized_lookup THEN 60 ELSE 0 END
      ) AS match_score,
      iv.raw_lookup
    FROM public.exam_keys ek
    CROSS JOIN input_value iv
    WHERE iv.normalized_lookup <> ''
      AND (
        lower(ek.exam_id) = iv.normalized_lookup
        OR lower(COALESCE(ek.resources->>'exam_path', '')) = iv.normalized_lookup
        OR lower(COALESCE(ek.resources->>'examPath', '')) = iv.normalized_lookup
        OR lower(COALESCE(ek.resources->>'path', '')) = iv.normalized_lookup
        OR lower(COALESCE(ek.resources->>'id', '')) = iv.normalized_lookup
        OR lower(COALESCE(ek.resources->>'legacy_exam_id', '')) = iv.normalized_lookup
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
    (r.exam_id = r.raw_lookup) DESC,
    COALESCE(r.last_synced_at, r.created_at) DESC,
    r.exam_id ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_exam_key_lookup(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_exam_key_lookup(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_exam_key_lookup(text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_get_exam_key(p_exam_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam_id text := trim(COALESCE(p_exam_id, ''));
  v_row public.exam_keys%ROWTYPE;
  v_resolved_exam_id text;
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

  SELECT r.exam_id
    INTO v_resolved_exam_id
    FROM public.resolve_exam_key_lookup(v_exam_id) r
   LIMIT 1;

  IF v_resolved_exam_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT *
    INTO v_row
    FROM public.exam_keys ek
   WHERE ek.exam_id = v_resolved_exam_id
   ORDER BY COALESCE(ek.last_synced_at, ek.created_at) DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'exam_id', v_row.exam_id,
    'answer_key', public.normalize_exam_answer_payload(v_row.answer_key),
    'resources', v_row.resources,
    'last_synced_at', v_row.last_synced_at,
    'created_at', v_row.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._rescore_exam_results_for_exam(
    p_exam_id text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_exam_id_input text := trim(COALESCE(p_exam_id, ''));
    v_resolved_exam_id text;
    v_answer_key jsonb;
    v_has_answer_key boolean := false;
    v_updated_count integer := 0;
BEGIN
    IF v_exam_id_input = '' THEN
        RETURN 0;
    END IF;

    SELECT
        r.exam_id,
        public.normalize_exam_answer_payload(r.answer_key)
    INTO
        v_resolved_exam_id,
        v_answer_key
    FROM public.resolve_exam_key_lookup(v_exam_id_input) r
    LIMIT 1;

    v_resolved_exam_id := COALESCE(NULLIF(v_resolved_exam_id, ''), v_exam_id_input);

    v_has_answer_key := (
        v_answer_key IS NOT NULL
        AND jsonb_typeof(v_answer_key) = 'object'
        AND v_answer_key <> '{}'::jsonb
    );

    IF NOT v_has_answer_key THEN
        RETURN 0;
    END IF;

    WITH pending AS (
        SELECT
            r.id,
            COALESCE(r.answers_snapshot, '{}'::jsonb) AS answers_snapshot,
            r.subject_folder
        FROM public.exam_results r
        WHERE lower(r.exam_id) = lower(v_resolved_exam_id)
          AND COALESCE(r.is_scored, false) = false
    ),
    scored AS (
        SELECT
            p.id,
            s.correct_count,
            s.total_questions,
            s.score
        FROM pending p
        CROSS JOIN LATERAL public.calculate_exam_score(v_answer_key, p.answers_snapshot, p.subject_folder) s
    )
    UPDATE public.exam_results r
    SET
        score = scored.score,
        correct_count = scored.correct_count,
        total_questions = scored.total_questions,
        is_scored = true,
        scored_at = now()
    FROM scored
    WHERE r.id = scored.id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN COALESCE(v_updated_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_exam_securely(
    p_exam_id text,
    p_subject_folder text,
    p_exam_title text,
    p_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_exam_id_input text := trim(COALESCE(p_exam_id, ''));
    v_resolved_exam_id text := trim(COALESCE(p_exam_id, ''));
    v_is_vip boolean;
    v_is_admin boolean;
    v_daily_count int;
    v_answer_key jsonb;
    v_has_answer_key boolean := false;
    v_correct_count int := 0;
    v_total_questions int := 0;
    v_calculated_score numeric := 0;
    v_result_id uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    IF v_exam_id_input = '' THEN
        RAISE EXCEPTION 'exam_id is required';
    END IF;

    SELECT (role = 'admin'), is_vip
    INTO v_is_admin, v_is_vip
    FROM public.profiles
    WHERE id = v_user_id;

    SELECT
        r.exam_id,
        public.normalize_exam_answer_payload(r.answer_key)
    INTO
        v_resolved_exam_id,
        v_answer_key
    FROM public.resolve_exam_key_lookup(v_exam_id_input) r
    LIMIT 1;

    v_resolved_exam_id := COALESCE(NULLIF(v_resolved_exam_id, ''), v_exam_id_input);

    IF NOT (COALESCE(v_is_admin, false) OR COALESCE(v_is_vip, false)) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.user_access_log
            WHERE user_id = v_user_id
              AND (
                lower(exam_id) = lower(v_resolved_exam_id)
                OR lower(exam_id) = lower(v_exam_id_input)
              )
        ) THEN
            SELECT count(*)
            INTO v_daily_count
            FROM public.user_access_log
            WHERE user_id = v_user_id
              AND created_at >= CURRENT_DATE;

            IF v_daily_count >= 3 THEN
                RAISE EXCEPTION 'Daily limit reached';
            END IF;

            INSERT INTO public.user_access_log (user_id, exam_id)
            VALUES (v_user_id, v_resolved_exam_id);
        END IF;
    END IF;

    v_has_answer_key := (
        v_answer_key IS NOT NULL
        AND jsonb_typeof(v_answer_key) = 'object'
        AND v_answer_key <> '{}'::jsonb
    );

    IF v_has_answer_key THEN
        SELECT correct_count, total_questions, score
        INTO v_correct_count, v_total_questions, v_calculated_score
        FROM public.calculate_exam_score(v_answer_key, COALESCE(p_answers, '{}'::jsonb), p_subject_folder);
    END IF;

    INSERT INTO public.exam_results (
        user_id, exam_id, subject_folder, exam_title, score, max_score,
        correct_count, total_questions, answers_snapshot, is_scored, scored_at
    )
    VALUES (
        v_user_id,
        v_resolved_exam_id,
        p_subject_folder,
        p_exam_title,
        v_calculated_score,
        10,
        v_correct_count,
        v_total_questions,
        COALESCE(p_answers, '{}'::jsonb),
        v_has_answer_key,
        CASE WHEN v_has_answer_key THEN now() ELSE NULL END
    )
    RETURNING id INTO v_result_id;

    UPDATE public.exam_progress
    SET status = 'submitted', updated_at = now()
    WHERE user_id = v_user_id
      AND (
        lower(exam_id) = lower(v_resolved_exam_id)
        OR lower(exam_id) = lower(v_exam_id_input)
      )
      AND status = 'in_progress';

    RETURN jsonb_build_object(
        'result_id', v_result_id,
        'score', v_calculated_score,
        'correct', v_correct_count,
        'total', v_total_questions,
        'is_scored', v_has_answer_key,
        'message', CASE WHEN v_has_answer_key THEN 'scored' ELSE 'pending_answer_key' END
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_exam_review_payload(p_result_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_exam_id text;
    v_subject_folder text;
    v_answers_snapshot jsonb;
    v_score numeric;
    v_correct_count int;
    v_total_questions int;
    v_answer_key jsonb;
    v_is_scored boolean := true;
    v_has_answer_key boolean := false;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT
        exam_id,
        subject_folder,
        answers_snapshot,
        score,
        correct_count,
        total_questions,
        COALESCE(is_scored, false)
    INTO
        v_exam_id,
        v_subject_folder,
        v_answers_snapshot,
        v_score,
        v_correct_count,
        v_total_questions,
        v_is_scored
    FROM public.exam_results
    WHERE id = p_result_id
      AND user_id = v_user_id
    LIMIT 1;

    IF v_exam_id IS NULL THEN
        RAISE EXCEPTION 'Result not found';
    END IF;

    SELECT public.normalize_exam_answer_payload(r.answer_key)
    INTO v_answer_key
    FROM public.resolve_exam_key_lookup(v_exam_id) r
    LIMIT 1;

    v_has_answer_key := (
        v_answer_key IS NOT NULL
        AND jsonb_typeof(v_answer_key) = 'object'
        AND v_answer_key <> '{}'::jsonb
    );

    IF COALESCE(v_is_scored, false) = false AND v_has_answer_key THEN
        SELECT
            s.correct_count,
            s.total_questions,
            s.score
        INTO
            v_correct_count,
            v_total_questions,
            v_score
        FROM public.calculate_exam_score(
            v_answer_key,
            COALESCE(v_answers_snapshot, '{}'::jsonb),
            v_subject_folder
        ) s;

        UPDATE public.exam_results
        SET
            score = v_score,
            correct_count = v_correct_count,
            total_questions = v_total_questions,
            is_scored = true,
            scored_at = now()
        WHERE id = p_result_id
          AND user_id = v_user_id;

        v_is_scored := true;
    END IF;

    RETURN jsonb_build_object(
        'result_id', p_result_id,
        'exam_id', v_exam_id,
        'subject_folder', v_subject_folder,
        'answers_snapshot', COALESCE(v_answers_snapshot, '{}'::jsonb),
        'score', COALESCE(v_score, 0),
        'correct_count', COALESCE(v_correct_count, 0),
        'total_questions', COALESCE(v_total_questions, 0),
        'answer_key', COALESCE(v_answer_key, '{}'::jsonb),
        'is_scored', COALESCE(v_is_scored, false),
        'has_answer_key', v_has_answer_key,
        'score_pending', NOT COALESCE(v_is_scored, false)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_exam_resources(p_exam_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_is_vip boolean;
    v_is_admin boolean;
    v_resources jsonb;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT (role = 'admin'), is_vip
    INTO v_is_admin, v_is_vip
    FROM public.profiles
    WHERE id = v_user_id;

    IF NOT (COALESCE(v_is_vip, false) OR COALESCE(v_is_admin, false)) THEN
        RETURN NULL;
    END IF;

    SELECT r.resources
    INTO v_resources
    FROM public.resolve_exam_key_lookup(p_exam_id) r
    LIMIT 1;

    RETURN v_resources;
END;
$$;

