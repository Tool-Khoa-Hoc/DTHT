-- 1. Create secure table for exam keys AND resources
CREATE TABLE IF NOT EXISTS public.exam_keys (
  exam_id text PRIMARY KEY,
  answer_key jsonb NOT NULL DEFAULT '{}',
  resources jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Only server-side SECURITY DEFINER functions can read this table.
ALTER TABLE public.exam_keys ENABLE ROW LEVEL SECURITY;
-- No policies = no access for anyone (anon/authenticated).

-- 2. Internal: scoring function
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
    v_key text;
    v_expected_ans jsonb;
    v_user_ans jsonb;
    v_stmt_id text;
    v_all_correct_stmt boolean;
BEGIN
    FOR v_key IN SELECT jsonb_object_keys(p_exam_data)
    LOOP
        v_total := v_total + 1;
        v_expected_ans := p_exam_data -> v_key;
        v_user_ans := p_user_answers -> v_key;
        
        IF jsonb_typeof(v_expected_ans) = 'object' THEN
            v_all_correct_stmt := true;
            FOR v_stmt_id IN SELECT jsonb_object_keys(v_expected_ans)
            LOOP
                IF (v_user_ans -> v_stmt_id) IS NULL OR (v_user_ans -> v_stmt_id) != (v_expected_ans -> v_stmt_id) THEN
                    v_all_correct_stmt := false;
                END IF;
            END LOOP;
            IF v_all_correct_stmt THEN v_correct := v_correct + 1; END IF;
        ELSIF jsonb_typeof(v_expected_ans) = 'number' THEN
            IF v_user_ans IS NOT NULL AND v_user_ans = v_expected_ans THEN v_correct := v_correct + 1; END IF;
        ELSIF jsonb_typeof(v_expected_ans) = 'string' THEN
            IF v_user_ans IS NOT NULL AND lower(trim(both '"' from v_user_ans::text)) = lower(trim(both '"' from v_expected_ans::text)) THEN
                v_correct := v_correct + 1;
            END IF;
        ELSE
            IF v_user_ans = v_expected_ans THEN v_correct := v_correct + 1; END IF;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_correct, v_total, round((v_correct::numeric / GREATEST(v_total, 1)::numeric) * 10, 2);
END;
$$;

-- 3. Public RPC: Secure exam submission (tính điểm trên server)
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
    FROM public.calculate_exam_score(v_answer_key, p_answers);

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

-- 4. Public RPC: Lấy resources cho VIP (chỉ VIP/Admin mới nhận được data thật)
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
    IF v_user_id IS NULL THEN RETURN NULL; END IF;

    SELECT (role = 'admin'), is_vip INTO v_is_admin, v_is_vip FROM public.profiles WHERE id = v_user_id;

    -- Chỉ VIP / Admin mới nhận được tài nguyên thật
    IF NOT (COALESCE(v_is_vip, false) OR COALESCE(v_is_admin, false)) THEN
        RETURN NULL;
    END IF;

    SELECT resources INTO v_resources FROM public.exam_keys WHERE exam_id = p_exam_id;
    RETURN v_resources;
END;
$$;
