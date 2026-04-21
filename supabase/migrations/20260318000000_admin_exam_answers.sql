-- Migration for Admin Exam Answers feature

-- 1. RPC: admin_list_exam_answer_status
CREATE OR REPLACE FUNCTION public.admin_list_exam_answer_status()
RETURNS TABLE (
    exam_id text,
    answer_file_url text,
    answer_file_name text,
    has_answer boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;

    RETURN QUERY
    SELECT 
        e.exam_id,
        (e.resources->>'answer_file_url')::text AS answer_file_url,
        (e.resources->>'answer_file_name')::text AS answer_file_name,
        (e.resources ? 'answer_file_url') AS has_answer
    FROM 
        public.exam_keys e;
END;
$$;

-- 2. RPC: admin_upsert_exam_answer_resource
CREATE OR REPLACE FUNCTION public.admin_upsert_exam_answer_resource(
    p_exam_id text,
    p_answer_file_url text,
    p_answer_file_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_resources jsonb;
BEGIN
    -- Check if user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;

    -- Validate input
    IF p_exam_id IS NULL OR p_exam_id = '' THEN
        RAISE EXCEPTION 'exam_id is required';
    END IF;

    IF p_answer_file_url IS NULL OR p_answer_file_url = '' THEN
        RAISE EXCEPTION 'answer_file_url is required';
    END IF;

    -- Update or Insert
    INSERT INTO public.exam_keys (exam_id, answer_key, resources, created_at)
    VALUES (
        p_exam_id, 
        '{}'::jsonb, 
        jsonb_build_object('answer_file_url', p_answer_file_url, 'answer_file_name', COALESCE(p_answer_file_name, 'Đáp án')), 
        now()
    )
    ON CONFLICT (exam_id) DO UPDATE
    SET resources = jsonb_set(
            jsonb_set(
                public.exam_keys.resources, 
                '{answer_file_url}', 
                to_jsonb(p_answer_file_url)
            ),
            '{answer_file_name}',
            to_jsonb(COALESCE(p_answer_file_name, public.exam_keys.resources->>'answer_file_name', 'Đáp án'))
        )
    RETURNING resources INTO v_updated_resources;

    RETURN v_updated_resources;
END;
$$;

-- 3. Grants
REVOKE ALL ON FUNCTION public.admin_list_exam_answer_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_exam_answer_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_exam_answer_status() TO service_role;

REVOKE ALL ON FUNCTION public.admin_upsert_exam_answer_resource(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_upsert_exam_answer_resource(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_exam_answer_resource(text, text, text) TO service_role;
