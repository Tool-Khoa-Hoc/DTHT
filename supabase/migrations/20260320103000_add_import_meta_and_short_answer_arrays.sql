ALTER TABLE public.exams
ADD COLUMN IF NOT EXISTS import_meta jsonb NOT NULL DEFAULT '{}'::jsonb;

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
    v_user_text text;
BEGIN
    FOR v_key IN SELECT jsonb_object_keys(COALESCE(p_exam_data, '{}'::jsonb))
    LOOP
        v_total := v_total + 1;
        v_expected_ans := p_exam_data -> v_key;
        v_user_ans := COALESCE(p_user_answers, '{}'::jsonb) -> v_key;
        v_user_text := lower(trim(both '"' from COALESCE(v_user_ans::text, '')));

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
            IF jsonb_typeof(v_expected_ans) = 'array' THEN
                IF EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements_text(v_expected_ans) AS candidate(value)
                    WHERE lower(trim(candidate.value)) = v_user_text
                ) THEN
                    v_score := v_score + 0.5;
                    v_correct := v_correct + 1;
                END IF;
            ELSIF v_user_ans IS NOT NULL
               AND lower(trim(both '"' from v_expected_ans::text)) = v_user_text THEN
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
