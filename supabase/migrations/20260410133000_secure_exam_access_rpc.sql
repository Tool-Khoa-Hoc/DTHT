-- =============================================================================
-- Migration: Secure Exam Access RPC
-- Chuyển toàn bộ logic nhạy cảm về thời gian xuống DB để chống bypass client-side.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- FUNCTION 1: is_active_vip(p_user_id uuid) → boolean
--   Kiểm tra VIP hợp lệ bằng thời gian server (now()), KHÔNG tin tưởng client.
--   Dùng SECURITY DEFINER để đọc bảng profiles mà không cần RLS trực tiếp.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_vip(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
      AND is_vip = true
      AND vip_expired_at IS NOT NULL
      AND vip_expired_at > now()
  );
$$;

COMMENT ON FUNCTION public.is_active_vip(uuid) IS
  'Kiểm tra xem user có VIP còn hạn hay không bằng thời gian server (now()). '
  'Không bao giờ nhận tham số thời gian từ client.';

-- Chỉ cho phép user đã xác thực gọi hàm này
REVOKE ALL ON FUNCTION public.is_active_vip(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_vip(uuid) TO authenticated;


-- -----------------------------------------------------------------------------
-- FUNCTION 2: check_and_log_exam_access(p_user_id uuid, p_exam_id text)
--   Trả về JSON: { "allowed": bool, "isRevisit": bool, "reason": text | null }
--   Toàn bộ logic tính ngày dùng CURRENT_DATE (PostgreSQL server), tuyệt đối
--   không nhận tham số ngày từ client.
--
--   Thứ tự ưu tiên:
--   1. Admin  → allowed (không log giới hạn)
--   2. VIP còn hạn (is_active_vip) → allowed (không log giới hạn)
--   3. Đã có log từ trước (isRevisit) → allowed
--   4. Đề mới + count hôm nay < 3 → insert log + allowed
--   5. Đề mới + count hôm nay >= 3 → denied (daily_limit)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_and_log_exam_access(
  p_user_id uuid,
  p_exam_id  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role         text;
  v_daily_count  int;
  FREE_LIMIT     constant int := 3;
BEGIN
  -- Bước 0: Lấy role của user
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = p_user_id;

  -- Bước 1: Admin → cho phép ngay, không ghi log giới hạn
  IF v_role = 'admin' THEN
    RETURN jsonb_build_object('allowed', true, 'isRevisit', false, 'reason', null);
  END IF;

  -- Bước 2: VIP còn hạn → cho phép ngay, không ghi log giới hạn
  IF public.is_active_vip(p_user_id) THEN
    RETURN jsonb_build_object('allowed', true, 'isRevisit', false, 'reason', null);
  END IF;

  -- Bước 3: Đề đã truy cập trước đây (revisit) → cho phép tự do
  IF EXISTS (
    SELECT 1 FROM public.user_access_log
    WHERE user_id = p_user_id AND exam_id = p_exam_id
  ) THEN
    RETURN jsonb_build_object('allowed', true, 'isRevisit', true, 'reason', null);
  END IF;

  -- Bước 4 & 5: Đề MỚI – đếm bằng CURRENT_DATE của PostgreSQL server
  -- CURRENT_DATE là ngày theo timezone server (UTC), không tin tưởng client
  SELECT COUNT(*) INTO v_daily_count
  FROM public.user_access_log
  WHERE user_id    = p_user_id
    AND created_at >= CURRENT_DATE::timestamptz
    AND created_at <  (CURRENT_DATE + 1)::timestamptz;

  IF v_daily_count >= FREE_LIMIT THEN
    -- Đã đạt giới hạn ngày
    RETURN jsonb_build_object('allowed', false, 'isRevisit', false, 'reason', 'daily_limit');
  END IF;

  -- Bước 5: Còn slot → ghi log và cho phép
  INSERT INTO public.user_access_log (user_id, exam_id)
  VALUES (p_user_id, p_exam_id)
  ON CONFLICT DO NOTHING;  -- Bảo vệ RACE CONDITION: nếu gọi concurrent, chỉ insert 1 lần

  RETURN jsonb_build_object('allowed', true, 'isRevisit', false, 'reason', null);

EXCEPTION
  WHEN OTHERS THEN
    -- Không bao giờ crash ứng dụng vì lỗi log; fail-open nhưng ghi lại lỗi
    RAISE WARNING '[check_and_log_exam_access] Unexpected error for user=% exam=%: %', p_user_id, p_exam_id, SQLERRM;
    RETURN jsonb_build_object('allowed', false, 'isRevisit', false, 'reason', 'error');
END;
$$;

COMMENT ON FUNCTION public.check_and_log_exam_access(uuid, text) IS
  'Kiểm tra và ghi log quyền truy cập đề thi cho user. '
  'Dùng CURRENT_DATE của PostgreSQL (server-side), không nhận tham số ngày từ client. '
  'Trả về JSON: { allowed, isRevisit, reason }.';

-- Chỉ cho phép user đã xác thực (authenticated) gọi RPC này
REVOKE ALL ON FUNCTION public.check_and_log_exam_access(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_log_exam_access(uuid, text) TO authenticated;


-- -----------------------------------------------------------------------------
-- INDEX BỔ SUNG: Tối ưu truy vấn đếm log theo range thời gian và lookup theo exam
-- Dùng BTree index thông thường trên (user_id, created_at) để tối ưu RANGE filter theo ngày.
-- Không thể dùng expression index với ::date vì PostgreSQL yêu cầu IMMUTABLE.
CREATE INDEX IF NOT EXISTS idx_user_access_log_user_created
  ON public.user_access_log (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_user_access_log_user_exam
  ON public.user_access_log (user_id, exam_id);
