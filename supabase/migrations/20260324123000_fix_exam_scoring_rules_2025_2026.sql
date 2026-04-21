-- Fix scoring rules for THPT 2025-2026:
-- Part 1: single choice = 0.25/question
-- Part 2: true/false by matched statements = [0.1, 0.25, 0.5, 1.0]
-- Part 3: short answer = 0.5 for Toan, 0.25 for other subjects
-- Also make scoring robust for non-standard part keys (e.g. part_2, part_3).

CREATE OR REPLACE FUNCTION public.calculate_exam_score(
    p_exam_data jsonb,
    p_user_answers jsonb,
    p_subject_folder text
)
RETURNS TABLE (correct_count int, total_questions int, score numeric)
LANGUAGE plpgsql
AS $$
DECLARE
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
    FOR v_key IN SELECT jsonb_object_keys(COALESCE(p_exam_data, '{}'::jsonb))
    LOOP
        v_total := v_total + 1;
        v_expected_ans := p_exam_data -> v_key;
        v_user_ans := COALESCE(p_user_answers, '{}'::jsonb) -> v_key;
        v_expected_type := COALESCE(jsonb_typeof(v_expected_ans), 'null');
        v_user_type := COALESCE(jsonb_typeof(v_user_ans), 'null');
        v_user_text := lower(replace(trim(both '"' from COALESCE(v_user_ans::text, '')), ',', '.'));

        -- Bucket inference: prefer key pattern, fallback to value/user types.
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
                -- If user answer comes from text input, treat as short_answer.
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
            -- True/false question map (statement_id -> boolean)
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

            IF v_matched_count = 1 THEN
                v_score := v_score + 0.1;
            ELSIF v_matched_count = 2 THEN
                v_score := v_score + 0.25;
            ELSIF v_matched_count = 3 THEN
                v_score := v_score + 0.5;
            ELSIF v_matched_count >= 4 THEN
                v_score := v_score + 1.0;
            END IF;

            IF v_expected_bool_count > 0
               AND v_matched_count = v_expected_bool_count THEN
                v_correct := v_correct + 1;
            END IF;

        ELSIF v_bucket = 'single_choice' THEN
            -- Accept expected/user value in either form: A/B/C/D or 0..3.
            v_expected_numeric := NULL;
            v_user_numeric := NULL;

            IF v_expected_type = 'number' THEN
                v_expected_numeric := (v_expected_ans::text)::numeric;
            ELSIF v_expected_type = 'string' THEN
                v_expected_text := upper(trim(both '"' from v_expected_ans::text));
                IF v_expected_text = 'A' THEN
                    v_expected_numeric := 0;
                ELSIF v_expected_text = 'B' THEN
                    v_expected_numeric := 1;
                ELSIF v_expected_text = 'C' THEN
                    v_expected_numeric := 2;
                ELSIF v_expected_text = 'D' THEN
                    v_expected_numeric := 3;
                ELSIF v_expected_text ~ '^[0-3]$' THEN
                    v_expected_numeric := v_expected_text::numeric;
                END IF;
            END IF;

            IF v_user_type = 'number' THEN
                v_user_numeric := (v_user_ans::text)::numeric;
            ELSIF v_user_type = 'string' THEN
                v_user_text := upper(trim(both '"' from v_user_ans::text));
                IF v_user_text = 'A' THEN
                    v_user_numeric := 0;
                ELSIF v_user_text = 'B' THEN
                    v_user_numeric := 1;
                ELSIF v_user_text = 'C' THEN
                    v_user_numeric := 2;
                ELSIF v_user_text = 'D' THEN
                    v_user_numeric := 3;
                ELSIF v_user_text ~ '^[0-3]$' THEN
                    v_user_numeric := v_user_text::numeric;
                END IF;
            END IF;

            IF v_expected_numeric IS NOT NULL
               AND mod(v_expected_numeric, 1) = 0
               AND v_expected_numeric BETWEEN 0 AND 3
               AND v_user_numeric IS NOT NULL
               AND mod(v_user_numeric, 1) = 0
               AND v_user_numeric = v_expected_numeric THEN
                v_score := v_score + 0.25;
                v_correct := v_correct + 1;
            END IF;

        ELSIF v_expected_type = 'array' THEN
            -- Accepted answers for short-answer question.
            IF v_user_text <> '' AND EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(v_expected_ans) AS candidate(value)
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
            -- Fallback for legacy entries.
            IF v_user_ans IS NOT NULL AND v_user_ans = v_expected_ans THEN
                v_score := v_score + 0.25;
                v_correct := v_correct + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_correct, v_total, round(v_score, 2);
END;
$$;

-- Backward-compatible 2-argument signature.
CREATE OR REPLACE FUNCTION public.calculate_exam_score(
    p_exam_data jsonb,
    p_user_answers jsonb
)
RETURNS TABLE (correct_count int, total_questions int, score numeric)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.calculate_exam_score(p_exam_data, p_user_answers, NULL);
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
    v_is_vip boolean;
    v_is_admin boolean;
    v_daily_count int;
    v_answer_key jsonb;
    v_correct_count int;
    v_total_questions int;
    v_calculated_score numeric;
    v_result_id uuid;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

    SELECT (role = 'admin'), is_vip INTO v_is_admin, v_is_vip FROM public.profiles WHERE id = v_user_id;

    IF NOT (COALESCE(v_is_admin, false) OR COALESCE(v_is_vip, false)) THEN
        IF NOT EXISTS (SELECT 1 FROM public.user_access_log WHERE user_id = v_user_id AND exam_id = p_exam_id) THEN
            SELECT count(*) INTO v_daily_count FROM public.user_access_log WHERE user_id = v_user_id AND created_at >= CURRENT_DATE;
            IF v_daily_count >= 3 THEN RAISE EXCEPTION 'Daily limit reached'; END IF;
            INSERT INTO public.user_access_log (user_id, exam_id) VALUES (v_user_id, p_exam_id);
        END IF;
    END IF;

    SELECT answer_key INTO v_answer_key FROM public.exam_keys WHERE exam_id = p_exam_id;
    IF v_answer_key IS NULL THEN RAISE EXCEPTION 'Exam key not found. Please sync keys first.'; END IF;

    SELECT correct_count, total_questions, score INTO v_correct_count, v_total_questions, v_calculated_score
    FROM public.calculate_exam_score(v_answer_key, p_answers, p_subject_folder);

    INSERT INTO public.exam_results (
        user_id, exam_id, subject_folder, exam_title, score, max_score, correct_count, total_questions, answers_snapshot
    ) VALUES (
        v_user_id, p_exam_id, p_subject_folder, p_exam_title, v_calculated_score, 10, v_correct_count, v_total_questions, p_answers
    ) RETURNING id INTO v_result_id;

    UPDATE public.exam_progress SET status = 'submitted', updated_at = now()
    WHERE user_id = v_user_id AND exam_id = p_exam_id AND status = 'in_progress';

    RETURN jsonb_build_object('result_id', v_result_id, 'score', v_calculated_score, 'correct', v_correct_count, 'total', v_total_questions);
END;
$$;
