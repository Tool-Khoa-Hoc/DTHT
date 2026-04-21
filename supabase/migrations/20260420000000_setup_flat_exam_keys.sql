-- =============================================================
-- Migration: setup_flat_exam_keys_architecture
-- Mục tiêu: Chuẩn hóa bảng exam_keys cho kiến trúc PDF + Flat JSON
-- =============================================================

-- 1. Thêm cột subject_folder vào exam_keys (backfill từ resources)
ALTER TABLE public.exam_keys
    ADD COLUMN IF NOT EXISTS subject_folder text;

-- Backfill từ resources JSONB (field subject_folder hoặc subject)
UPDATE public.exam_keys
SET subject_folder = lower(trim(
    COALESCE(
        resources->>'subject_folder',
        resources->>'subjectFolder',
        resources->>'subject',
        ''
    )
))
WHERE subject_folder IS NULL OR subject_folder = '';

COMMENT ON COLUMN public.exam_keys.subject_folder IS
    'Môn học của đề thi (hoa, toan, sinh, ...). Backfill từ resources JSONB.';

-- 2. Đổi tên cột answer_key → correct_answers (alias view để giữ BC)
--    Vì đã có code dùng answer_key, ta KHÔNG đổi tên cột, chỉ thêm alias.
--    correct_answers sẽ là generated column / view. 
--    → Giữ nguyên tên answer_key trong schema thực, nhưng đặt comment rõ.
COMMENT ON COLUMN public.exam_keys.answer_key IS
    'Đáp án chuẩn. Khi scoring_format=flat: {"1":"A","2":"B",...}.
     Khi scoring_format=legacy: {"part-1.1":0,"part-2.1":{...},...}.';

-- 3. Đảm bảo RLS bật
ALTER TABLE public.exam_keys ENABLE ROW LEVEL SECURITY;

-- Xóa policy cũ nếu có rồi tạo lại đúng
DROP POLICY IF EXISTS "exam_keys_admin_all"           ON public.exam_keys;
DROP POLICY IF EXISTS "exam_keys_service_role_all"    ON public.exam_keys;
DROP POLICY IF EXISTS "exam_keys_users_no_read"       ON public.exam_keys;
DROP POLICY IF EXISTS "Admins can manage exam keys"   ON public.exam_keys;
DROP POLICY IF EXISTS "Service role bypass"           ON public.exam_keys;

-- 3a. Admin (role = 'admin' trong profiles) được phép đọc/ghi
CREATE POLICY "exam_keys_admin_all" ON public.exam_keys
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 3b. User thường: DENY hoàn toàn (không có policy → mặc định bị chặn)
--     Không cần tạo thêm policy deny vì RLS mặc định block tất cả
--     khi không có policy nào match.

-- 3c. Tuy nhiên, SECURITY DEFINER functions (submit_exam_securely)
--     cần đọc exam_keys → chúng chạy dưới quyền postgres (owner), bypass RLS tự động.
--     Không cần policy cho functions.

-- 4. Index cho lookup nhanh theo subject_folder
CREATE INDEX IF NOT EXISTS idx_exam_keys_subject_folder
    ON public.exam_keys(subject_folder)
    WHERE subject_folder IS NOT NULL AND subject_folder <> '';

-- 5. Xác nhận scoring_format CHECK constraint đã đúng
-- (đã tồn tại từ migration trước, chỉ kiểm tra idempotently)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_schema = 'public'
          AND constraint_name LIKE '%scoring_format%'
    ) THEN
        ALTER TABLE public.exam_keys
            ADD CONSTRAINT exam_keys_scoring_format_check
            CHECK (scoring_format IN ('flat', 'legacy'));
    END IF;
END;
$$;
