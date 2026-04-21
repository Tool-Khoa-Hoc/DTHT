-- Normalize legacy answer-key payload formats and make exam-key lookup resilient.
-- Fixes cases where uploaded keys exist in DB but cannot be matched to submitted answers.

CREATE OR REPLACE FUNCTION public.normalize_exam_answer_payload(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO ''
AS $$
DECLARE
    v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
    v_result jsonb := '{}'::jsonb;
    v_entry record;
    v_key text;
    v_value jsonb;
    v_nested jsonb;
    v_nested_entry record;
    v_nested_key text;
BEGIN
    IF jsonb_typeof(v_payload) <> 'object' THEN
        RETURN '{}'::jsonb;
    END IF;

    FOR v_entry IN SELECT key, value FROM jsonb_each(v_payload)
    LOOP
        v_key := lower(trim(COALESCE(v_entry.key, '')));
        IF v_key = '' THEN
            CONTINUE;
        END IF;

        -- Legacy:
        -- part1.q1, part1.1, part-1.q1, part_1:q1
        -- Canonical:
        -- part-1.1
        IF v_key ~ '^part[_-]?[123][.:-]?(q)?[0-9]+$' THEN
            v_key := regexp_replace(v_key, '^part[_-]?([123])[.:-]?(?:q)?([0-9]+)$', 'part-\1.\2');
        END IF;

        v_value := v_entry.value;

        -- Normalize true/false statement ids:
        -- q1a -> a, 1a -> a, stmt-a -> a
        IF jsonb_typeof(v_value) = 'object' AND v_key ~ '^part-2\.[0-9]+$' THEN
            v_nested := '{}'::jsonb;

            FOR v_nested_entry IN SELECT key, value FROM jsonb_each(v_value)
            LOOP
                v_nested_key := lower(trim(COALESCE(v_nested_entry.key, '')));
                IF v_nested_key = '' THEN
                    CONTINUE;
                END IF;

                IF v_nested_key ~ '^q[0-9]+([a-z])$' THEN
                    v_nested_key := regexp_replace(v_nested_key, '^q[0-9]+([a-z])$', '\1');
                ELSIF v_nested_key ~ '^[0-9]+([a-z])$' THEN
                    v_nested_key := regexp_replace(v_nested_key, '^[0-9]+([a-z])$', '\1');
                ELSIF v_nested_key ~ '^stmt[_-]?([a-z])$' THEN
                    v_nested_key := regexp_replace(v_nested_key, '^stmt[_-]?([a-z])$', '\1');
                END IF;

                v_nested := jsonb_set(v_nested, ARRAY[v_nested_key], v_nested_entry.value, true);
            END LOOP;

            v_value := v_nested;
        END IF;

        v_result := jsonb_set(v_result, ARRAY[v_key], v_value, true);
    END LOOP;

    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_exam_score(
    p_exam_data jsonb,
    p_user_answers jsonb,
    p_subject_folder text
)
RETURNS TABLE(correct_count int, total_questions int, score numeric)
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
    v_exam_data jsonb := public.normalize_exam_answer_payload(p_exam_data);
    v_user_answers jsonb := public.normalize_exam_answer_payload(p_user_answers);
    v_correct int := 0;
    v_total int := 0;
    v_score numeric := 0;
    v_key text;
    v_expected_ans jsonb;
    v_user_ans jsonb;
    v_stmt_id text;
    v_matched_count int;
    v_expected_bool_count int;
    v_expected_type text;
    v_user_type text;
    v_bucket text;
    v_expected_numeric numeric;
    v_user_numeric numeric;
    v_expected_text text;
    v_user_text text;
    v_subject text := lower(trim(coalesce(p_subject_folder, '')));
    v_part3_points numeric := CASE WHEN v_subject IN ('toan', 'math') THEN 0.5 ELSE 0.25 END;
BEGIN
    FOR v_key IN SELECT jsonb_object_keys(COALESCE(v_exam_data, '{}'::jsonb))
    LOOP
        v_total := v_total + 1;
        v_expected_ans := v_exam_data -> v_key;
        v_user_ans := COALESCE(v_user_answers, '{}'::jsonb) -> v_key;
        v_expected_type := COALESCE(jsonb_typeof(v_expected_ans), 'null');
        v_user_type := COALESCE(jsonb_typeof(v_user_ans), 'null');
        v_user_text := lower(replace(trim(both '"' from COALESCE(v_user_ans::text, '')), ',', '.'));

        v_bucket := NULL;
        IF v_key ~* '^part[_-]?1[.:-]' THEN
            v_bucket := 'single_choice';
        ELSIF v_key ~* '^part[_-]?2[.:-]' THEN
            v_bucket := 'true_false';
        ELSIF v_key ~* '^part[_-]?3[.:-]' THEN
            v_bucket := 'short_answer';
        END IF;

        IF v_bucket IS NULL THEN
            IF v_expected_type = 'object' THEN
                v_bucket := 'true_false';
            ELSIF v_expected_type IN ('string', 'array') THEN
                v_bucket := 'short_answer';
            ELSIF v_expected_type = 'number' THEN
                IF v_user_type = 'string' THEN
                    v_bucket := 'short_answer';
                ELSE
                    v_expected_numeric := (v_expected_ans::text)::numeric;
                    IF mod(v_expected_numeric, 1) = 0 AND v_expected_numeric BETWEEN 0 AND 3 THEN
                        v_bucket := 'single_choice';
                    ELSE
                        v_bucket := 'short_answer';
                    END IF;
                END IF;
            ELSE
                v_bucket := 'single_choice';
            END IF;
        END IF;

        IF v_bucket = 'true_false' THEN
            v_matched_count := 0;
            v_expected_bool_count := 0;
            IF v_expected_type = 'object' THEN
                FOR v_stmt_id IN SELECT jsonb_object_keys(v_expected_ans)
                LOOP
                    IF (v_expected_ans -> v_stmt_id) IN ('true'::jsonb, 'false'::jsonb) THEN
                        v_expected_bool_count := v_expected_bool_count + 1;
                        IF (v_user_ans -> v_stmt_id) IS NOT NULL
                           AND (v_user_ans -> v_stmt_id) = (v_expected_ans -> v_stmt_id) THEN
                            v_matched_count := v_matched_count + 1;
                        END IF;
                    END IF;
                END LOOP;
            END IF;
            IF v_matched_count = 1 THEN v_score := v_score + 0.1;
            ELSIF v_matched_count = 2 THEN v_score := v_score + 0.25;
            ELSIF v_matched_count = 3 THEN v_score := v_score + 0.5;
            ELSIF v_matched_count >= 4 THEN v_score := v_score + 1.0;
            END IF;
            IF v_expected_bool_count > 0 AND v_matched_count = v_expected_bool_count THEN
                v_correct := v_correct + 1;
            END IF;

        ELSIF v_bucket = 'single_choice' THEN
            v_expected_numeric := NULL;
            v_user_numeric := NULL;
            IF v_expected_type = 'number' THEN
                v_expected_numeric := (v_expected_ans::text)::numeric;
            ELSIF v_expected_type = 'string' THEN
                v_expected_text := upper(trim(both '"' from v_expected_ans::text));
                IF v_expected_text = 'A' THEN v_expected_numeric := 0;
                ELSIF v_expected_text = 'B' THEN v_expected_numeric := 1;
                ELSIF v_expected_text = 'C' THEN v_expected_numeric := 2;
                ELSIF v_expected_text = 'D' THEN v_expected_numeric := 3;
                ELSIF v_expected_text ~ '^[0-3]$' THEN v_expected_numeric := v_expected_text::numeric;
                END IF;
            END IF;
            IF v_user_type = 'number' THEN
                v_user_numeric := (v_user_ans::text)::numeric;
            ELSIF v_user_type = 'string' THEN
                v_user_text := upper(trim(both '"' from v_user_ans::text));
                IF v_user_text = 'A' THEN v_user_numeric := 0;
                ELSIF v_user_text = 'B' THEN v_user_numeric := 1;
                ELSIF v_user_text = 'C' THEN v_user_numeric := 2;
                ELSIF v_user_text = 'D' THEN v_user_numeric := 3;
                ELSIF v_user_text ~ '^[0-3]$' THEN v_user_numeric := v_user_text::numeric;
                END IF;
            END IF;
            IF v_expected_numeric IS NOT NULL AND mod(v_expected_numeric, 1) = 0
               AND v_expected_numeric BETWEEN 0 AND 3
               AND v_user_numeric IS NOT NULL AND mod(v_user_numeric, 1) = 0
               AND v_user_numeric = v_expected_numeric THEN
                v_score := v_score + 0.25;
                v_correct := v_correct + 1;
            END IF;

        ELSIF v_expected_type = 'array' THEN
            IF v_user_text <> '' AND EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(v_expected_ans) AS candidate(value)
                WHERE lower(replace(trim(candidate.value), ',', '.')) = v_user_text
            ) THEN
                v_score := v_score + v_part3_points;
                v_correct := v_correct + 1;
            END IF;

        ELSIF v_expected_type IN ('string', 'number') THEN
            v_expected_text := lower(replace(trim(both '"' from v_expected_ans::text), ',', '.'));
            IF v_user_text <> '' AND v_user_text = v_expected_text THEN
                v_score := v_score + v_part3_points;
                v_correct := v_correct + 1;
            END IF;

        ELSE
            IF v_user_ans IS NOT NULL AND v_user_ans = v_expected_ans THEN
                v_score := v_score + 0.25;
                v_correct := v_correct + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_correct, v_total, round(v_score, 2);
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
    FROM public.exam_keys ek
   WHERE lower(ek.exam_id) = lower(v_exam_id)
   ORDER BY (ek.exam_id = v_exam_id) DESC, COALESCE(ek.last_synced_at, ek.created_at) DESC
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
  v_normalized_answer_key jsonb := public.normalize_exam_answer_payload(COALESCE(p_answer_key, '{}'::jsonb));
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
    v_normalized_answer_key,
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
        ek.exam_id,
        public.normalize_exam_answer_payload(ek.answer_key)
    INTO
        v_resolved_exam_id,
        v_answer_key
    FROM public.exam_keys ek
    WHERE lower(ek.exam_id) = lower(v_exam_id_input)
    ORDER BY (ek.exam_id = v_exam_id_input) DESC, COALESCE(ek.last_synced_at, ek.created_at) DESC
    LIMIT 1;

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

    SELECT (role = 'admin'), is_vip INTO v_is_admin, v_is_vip
    FROM public.profiles
    WHERE id = v_user_id;

    SELECT
        ek.exam_id,
        public.normalize_exam_answer_payload(ek.answer_key)
    INTO
        v_resolved_exam_id,
        v_answer_key
    FROM public.exam_keys ek
    WHERE lower(ek.exam_id) = lower(v_exam_id_input)
    ORDER BY (ek.exam_id = v_exam_id_input) DESC, COALESCE(ek.last_synced_at, ek.created_at) DESC
    LIMIT 1;

    v_resolved_exam_id := COALESCE(NULLIF(v_resolved_exam_id, ''), v_exam_id_input);

    IF NOT (COALESCE(v_is_admin, false) OR COALESCE(v_is_vip, false)) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.user_access_log
            WHERE user_id = v_user_id
              AND lower(exam_id) = lower(v_resolved_exam_id)
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
      AND lower(exam_id) = lower(v_resolved_exam_id)
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

    SELECT public.normalize_exam_answer_payload(ek.answer_key)
    INTO v_answer_key
    FROM public.exam_keys ek
    WHERE lower(ek.exam_id) = lower(v_exam_id)
    ORDER BY (ek.exam_id = v_exam_id) DESC, COALESCE(ek.last_synced_at, ek.created_at) DESC
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

-- Backfill existing answer keys to canonical key format.
UPDATE public.exam_keys ek
SET
    answer_key = public.normalize_exam_answer_payload(ek.answer_key),
    last_synced_at = now()
WHERE COALESCE(ek.answer_key, '{}'::jsonb) <> public.normalize_exam_answer_payload(ek.answer_key);
