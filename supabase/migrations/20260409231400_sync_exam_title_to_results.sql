-- Cập nhật hàm admin_upsert_exam_key_bundle để đồng bộ tên đề thi (exam_title) sang bảng exam_results

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

  -- Bổ sung logic: Cập nhật luôn exam_title và subject_folder cho bảng exam_results
  -- để đảm bảo tính nhất quán mỗi khi đổi tên đề thi (exam_title)
  IF p_resources ? 'title' OR p_resources ? 'exam_title' OR p_resources ? 'subject_folder' OR p_resources ? 'subjectFolder' OR p_resources ? 'subject' THEN
    UPDATE public.exam_results
    SET 
        exam_title = COALESCE(p_resources->>'title', p_resources->>'exam_title', exam_title),
        subject_folder = COALESCE(p_resources->>'subject_folder', p_resources->>'subjectFolder', p_resources->>'subject', subject_folder)
    WHERE lower(exam_id) = lower(v_exam_id);
  END IF;

  RETURN jsonb_build_object(
    'exam_id', v_row.exam_id,
    'answer_key', v_row.answer_key,
    'resources', v_row.resources,
    'last_synced_at', v_row.last_synced_at,
    'created_at', v_row.created_at
  );
END;
$$;
