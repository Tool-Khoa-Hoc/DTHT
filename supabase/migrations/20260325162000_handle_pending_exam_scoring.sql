-- Allow exam submission even when answer key is missing.
-- Add pending scoring state and auto-rescore when answer key is uploaded.

ALTER TABLE public.exam_results
  ADD COLUMN IF NOT EXISTS is_scored boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS scored_at timestamptz;

UPDATE public.exam_results
SET scored_at = COALESCE(scored_at, submitted_at)
WHERE is_scored = true
  AND scored_at IS NULL;

CREATE OR REPLACE FUNCTION public._rescore_exam_results_for_exam(
    p_exam_id text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_answer_key jsonb;
    v_has_answer_key boolean := false;
    v_updated_count integer := 0;
BEGIN
    IF p_exam_id IS NULL OR btrim(p_exam_id) = '' THEN
        RETURN 0;
    END IF;

    SELECT answer_key INTO v_answer_key
    FROM public.exam_keys
    WHERE exam_id = p_exam_id;

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
        WHERE r.exam_id = p_exam_id
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

CREATE OR REPLACE FUNCTION public.rescore_exam_results_for_exam(
    p_exam_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_updated integer := 0;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = v_user_id
          AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;

    v_updated := public._rescore_exam_results_for_exam(p_exam_id);

    RETURN jsonb_build_object(
        'exam_id', p_exam_id,
        'rescored', v_updated
    );
END;
$$;

CREATE OR REPLACE FUNCTION public._trg_rescore_exam_results_on_exam_keys()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public._rescore_exam_results_for_exam(NEW.exam_id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rescore_exam_results_on_exam_keys ON public.exam_keys;
CREATE TRIGGER trg_rescore_exam_results_on_exam_keys
AFTER INSERT OR UPDATE OF answer_key ON public.exam_keys
FOR EACH ROW
EXECUTE FUNCTION public._trg_rescore_exam_results_on_exam_keys();

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
    v_has_answer_key boolean := false;
    v_correct_count int := 0;
    v_total_questions int := 0;
    v_calculated_score numeric := 0;
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
    v_has_answer_key := (
        v_answer_key IS NOT NULL
        AND jsonb_typeof(v_answer_key) = 'object'
        AND v_answer_key <> '{}'::jsonb
    );

    IF v_has_answer_key THEN
        SELECT correct_count, total_questions, score INTO v_correct_count, v_total_questions, v_calculated_score
        FROM public.calculate_exam_score(v_answer_key, COALESCE(p_answers, '{}'::jsonb), p_subject_folder);
    ELSE
        v_correct_count := 0;
        v_total_questions := 0;
        v_calculated_score := 0;
    END IF;

    INSERT INTO public.exam_results (
        user_id, exam_id, subject_folder, exam_title, score, max_score, correct_count, total_questions, answers_snapshot, is_scored, scored_at
    ) VALUES (
        v_user_id,
        p_exam_id,
        p_subject_folder,
        p_exam_title,
        v_calculated_score,
        10,
        v_correct_count,
        v_total_questions,
        COALESCE(p_answers, '{}'::jsonb),
        v_has_answer_key,
        CASE WHEN v_has_answer_key THEN now() ELSE NULL END
    ) RETURNING id INTO v_result_id;

    UPDATE public.exam_progress SET status = 'submitted', updated_at = now()
    WHERE user_id = v_user_id AND exam_id = p_exam_id AND status = 'in_progress';

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

    SELECT answer_key INTO v_answer_key
    FROM public.exam_keys
    WHERE exam_id = v_exam_id;

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

REVOKE ALL ON FUNCTION public.rescore_exam_results_for_exam(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rescore_exam_results_for_exam(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rescore_exam_results_for_exam(text) TO service_role;
