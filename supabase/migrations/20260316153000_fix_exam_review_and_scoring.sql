CREATE OR REPLACE FUNCTION public.calculate_exam_score(
    p_exam_data jsonb,
    p_user_answers jsonb
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
BEGIN
    FOR v_key IN SELECT jsonb_object_keys(COALESCE(p_exam_data, '{}'::jsonb))
    LOOP
        v_total := v_total + 1;
        v_expected_ans := p_exam_data -> v_key;
        v_user_ans := COALESCE(p_user_answers, '{}'::jsonb) -> v_key;

        IF v_key LIKE 'part2.%' AND jsonb_typeof(v_expected_ans) = 'object' THEN
            v_matched_count := 0;

            FOR v_stmt_id IN SELECT jsonb_object_keys(v_expected_ans)
            LOOP
                IF (v_user_ans -> v_stmt_id) IS NOT NULL AND (v_user_ans -> v_stmt_id) = (v_expected_ans -> v_stmt_id) THEN
                    v_matched_count := v_matched_count + 1;
                END IF;
            END LOOP;

            IF v_matched_count = 1 THEN
                v_score := v_score + 0.1;
            ELSIF v_matched_count = 2 THEN
                v_score := v_score + 0.25;
            ELSIF v_matched_count = 3 THEN
                v_score := v_score + 0.5;
            ELSIF v_matched_count >= 4 THEN
                v_score := v_score + 1.0;
                v_correct := v_correct + 1;
            END IF;
        ELSIF v_key LIKE 'part3.%' THEN
            IF v_user_ans IS NOT NULL
               AND lower(trim(both '"' from v_user_ans::text)) = lower(trim(both '"' from v_expected_ans::text)) THEN
                v_score := v_score + 0.5;
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
        total_questions
    INTO
        v_exam_id,
        v_subject_folder,
        v_answers_snapshot,
        v_score,
        v_correct_count,
        v_total_questions
    FROM public.exam_results
    WHERE id = p_result_id
      AND user_id = v_user_id
    LIMIT 1;

    IF v_exam_id IS NULL THEN
        RAISE EXCEPTION 'Result not found';
    END IF;

    SELECT answer_key INTO v_answer_key
    FROM public.exam_keys
    WHERE exam_id = v_exam_id;

    RETURN jsonb_build_object(
        'result_id', p_result_id,
        'exam_id', v_exam_id,
        'subject_folder', v_subject_folder,
        'answers_snapshot', COALESCE(v_answers_snapshot, '{}'::jsonb),
        'score', COALESCE(v_score, 0),
        'correct_count', COALESCE(v_correct_count, 0),
        'total_questions', COALESCE(v_total_questions, 0),
        'answer_key', COALESCE(v_answer_key, '{}'::jsonb)
    );
END;
$$;
