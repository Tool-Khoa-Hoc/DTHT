-- Kịch bản cài đặt cho tính năng Quản lý Đề thi trong Admin

-- 1. Tạo Table exam_keys nếu chưa có
CREATE TABLE IF NOT EXISTS public.exam_keys (
  exam_id TEXT PRIMARY KEY,
  answer_key JSONB,
  resources JSONB,
  last_synced_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Bật Row Level Security cho exam_keys
ALTER TABLE public.exam_keys ENABLE ROW LEVEL SECURITY;

-- 2. Hàm kiểm tra quyền Admin
-- Chú ý: Cần đặt SECURITY DEFINER để tránh lỗi bị đệ quy khi RLS từ public.profiles gọi hàm này
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'admin'
    FROM auth.users
    JOIN public.profiles ON auth.users.id = profiles.id
    WHERE auth.uid() = profiles.id
  );
EXCEPTION WHEN OTHERS THEN 
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Cập nhật Policy của exam_keys
-- Chỉ Admin mới có quyền tất cả (thêm, sửa, xóa)
DROP POLICY IF EXISTS "Admin can manage exam keys" ON public.exam_keys;
CREATE POLICY "Admin can manage exam keys" 
ON public.exam_keys 
FOR ALL 
TO authenticated 
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Mọi người đều có thể đọc dữ liệu
DROP POLICY IF EXISTS "Anyone can read exam keys" ON public.exam_keys;
CREATE POLICY "Anyone can read exam keys" 
ON public.exam_keys 
FOR SELECT 
USING (true);

-- 4. Bảng exams (Metadata) phải được cho phép Admin upsert
-- Điều này cần policy update hoặc insert cho Admin
DROP POLICY IF EXISTS "Admin can manage exams" ON public.exams;
CREATE POLICY "Admin can manage exams" 
ON public.exams 
FOR ALL 
TO authenticated 
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- (Nếu bảng exams chưa tồn tại)
CREATE TABLE IF NOT EXISTS public.exams (
  id TEXT PRIMARY KEY,
  title TEXT,
  subject TEXT,
  solution_url TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read exams" ON public.exams;
CREATE POLICY "Anyone can read exams" 
ON public.exams 
FOR SELECT 
USING (true);
