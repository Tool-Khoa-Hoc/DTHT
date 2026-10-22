-- Migration: bảng dữ liệu điểm chuẩn tuyển sinh (score-v3)
-- Ngày tạo: 2026-10-22
-- Mục đích: chuyển dữ liệu điểm chuẩn từ file JSON tĩnh (52 bản ghi) sang
-- Supabase với 1.249 bản ghi đã kiểm chứng nguồn, tiếng Việt có dấu, gồm:
--   public.admission_schools               — danh mục trường (thay hardcode khu vực trong trang)
--   public.admission_cutoffs               — điểm chuẩn theo trường/ngành/phương thức/năm/phân đoạn
--   public.admission_conversion_anchors    — neo quy đổi bách phân vị (dữ liệu hạng nhất, không chôn trong ghi chú)
--   public.admission_score_distributions   — phổ điểm theo kỳ thi/năm/đợt
-- Đây là dữ liệu CÔNG KHAI: mọi người đọc được, chỉ quản trị viên mới ghi
-- (kiểm tra bằng public.is_admin(auth.uid()) — cùng cơ chế của dự án, xem
-- migration 20260315110000_harden_security_and_indexes.sql).
-- Migration chỉ THÊM bảng mới, không sửa/xoá dữ liệu hiện có.
-- Nạp dữ liệu: node scripts/ingest-admissions-supabase.mjs --apply
-- (đọc public/data/admissions/cutoffs.json, upsert theo khoá duy nhất).

-- 1. Danh mục trường ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admission_schools (
  code     text PRIMARY KEY,                       -- mã trường, ví dụ 'HUST'
  name_vi  text NOT NULL,                          -- tên tiếng Việt CÓ DẤU
  name_en  text,                                   -- tên tiếng Anh (nếu có)
  region   text CHECK (region IN ('bac', 'trung', 'nam')), -- miền: bac/trung/nam
  province text,                                   -- tỉnh/thành phố
  website  text,                                   -- trang web chính thức
  type     text,                                   -- loại hình: đại học / học viện / trường
  note     text,                                   -- ghi chú tiếng Việt có dấu
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.admission_schools IS 'Danh mục trường tuyển sinh — tên tiếng Việt có dấu, khu vực thay cho bảng hardcode trong trang Tìm trường.';

-- 2. Điểm chuẩn ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admission_cutoffs (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_code text NOT NULL REFERENCES public.admission_schools(code),
  major_code  text,                                -- mã ngành/chương trình (có thể chưa có trong nguồn)
  major_name  text NOT NULL,                       -- tên ngành tiếng Việt CÓ DẤU
  combo       text[],                              -- mảng tổ hợp áp dụng, ví dụ {A00,A01,K01}
  method      text NOT NULL CHECK (method IN
    ('thpt','hocba','hsa','vact','tsa','spt','hsca','bca','vsat','combined','direct','other')),
  scale       numeric NOT NULL,                    -- thang của CHÍNH bản ghi này (30/100/150/1200/450...)
  cutoff      numeric(6,2),                        -- điểm chuẩn; NULL = chưa kiểm chứng được, không dùng ước tính
  year        smallint NOT NULL CHECK (year BETWEEN 2020 AND 2030),
  quota       integer CHECK (quota >= 0),          -- chỉ tiêu của ngành × phương thức (nếu công bố)
  segment     text NOT NULL DEFAULT 'chung',       -- phân đoạn: chung / nu / nam / vung-1... (bắt buộc tách với BCA)
  verified    boolean NOT NULL DEFAULT false,      -- đã kiểm chứng với nguồn
  reliability text NOT NULL DEFAULT 'C' CHECK (reliability IN ('A','B','C')), -- A chính thức, B báo lớn, C thứ cấp
  source_url  text NOT NULL,                       -- nguồn của chính bản ghi này (bắt buộc)
  source_date date,                                -- ngày nguồn công bố
  note        text,                                -- ghi chú tiếng Việt có dấu; CẤM chứa dữ liệu máy-đọc (neo/khoảng)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admission_cutoffs_unique_point
    UNIQUE NULLS NOT DISTINCT (school_code, major_code, major_name, method, year, segment)
);
COMMENT ON TABLE public.admission_cutoffs IS 'Điểm chuẩn tuyển sinh theo trường/ngành/phương thức/năm — dữ liệu công khai, chỉ quản trị viên được ghi.';

CREATE INDEX IF NOT EXISTS idx_admission_cutoffs_lookup
  ON public.admission_cutoffs (school_code, method, year DESC);
CREATE INDEX IF NOT EXISTS idx_admission_cutoffs_major_search
  ON public.admission_cutoffs USING gin (to_tsvector('simple', major_name || ' ' || school_code));
CREATE INDEX IF NOT EXISTS idx_admission_cutoffs_year_method
  ON public.admission_cutoffs (year DESC, method) WHERE cutoff IS NOT NULL;

-- 3. Neo quy đổi bách phân vị ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admission_conversion_anchors (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  from_exam   text NOT NULL,                       -- kỳ thi nguồn, ví dụ 'hsa'
  to_exam     text NOT NULL,                       -- thang đích, ví dụ 'thpt'
  combo       text,                                -- tổ hợp đích; NULL = áp mọi tổ hợp (hiếm)
  year        smallint NOT NULL,                   -- năm của khung quy đổi — CẤM dùng chéo năm
  framework   text NOT NULL,                       -- ví dụ 'bo-gddt-2025'
  scope       text NOT NULL DEFAULT 'national' CHECK (scope IN ('national','school')),
  school_code text REFERENCES public.admission_schools(code), -- bắt buộc khi scope='school'
  src         numeric NOT NULL,                    -- điểm nguồn
  dst         numeric NOT NULL,                    -- điểm đích tương đương
  top_pct     numeric,                             -- bách phân vị tương ứng (nếu văn bản gốc cho)
  source_url  text NOT NULL,
  source_date date,
  reliability text NOT NULL DEFAULT 'C' CHECK (reliability IN ('A','B','C')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admission_conversion_anchors_unique_point
    UNIQUE NULLS NOT DISTINCT (from_exam, to_exam, combo, year, framework, scope, school_code, src)
);
COMMENT ON TABLE public.admission_conversion_anchors IS 'Neo quy đổi điểm giữa các kỳ thi theo bách phân vị — mỗi hàng là một mốc neo, chỉ dùng đúng năm của khung quy đổi.';
CREATE INDEX IF NOT EXISTS idx_admission_conversion_anchors_lookup
  ON public.admission_conversion_anchors (from_exam, to_exam, combo, year);

-- 4. Phổ điểm -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admission_score_distributions (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  exam          text NOT NULL,                     -- mã kỳ thi theo registry
  year          smallint NOT NULL,
  session       text NOT NULL DEFAULT 'chung',     -- đợt thi; V-ACT hai đợt KHÔNG gộp thô
  scale         numeric,
  mean          numeric,                           -- điểm trung bình
  median        numeric,                           -- trung vị
  sd            numeric,                           -- độ lệch chuẩn
  max_score     numeric,                           -- điểm cao nhất
  subject_stats jsonb,                             -- thống kê theo môn (phổ THPT)
  combos_mean   jsonb,                             -- trung bình theo tổ hợp
  percentiles   jsonb,                             -- các mốc bách phân vị
  source_url    text NOT NULL,
  source_date   date,
  reliability   text NOT NULL DEFAULT 'C' CHECK (reliability IN ('A','B','C')),
  note          text,                              -- ghi chú tiếng Việt có dấu
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admission_score_distributions_unique_point UNIQUE (exam, year, session)
);
COMMENT ON TABLE public.admission_score_distributions IS 'Phổ điểm theo kỳ thi × năm × đợt — phục vụ tính phân vị của thí sinh và độ tin cậy của ước tính.';
CREATE INDEX IF NOT EXISTS idx_admission_score_distributions_lookup
  ON public.admission_score_distributions (exam, year DESC);

-- 5. Bảo mật mức hàng (RLS): công khai đọc, quản trị ghi -------------------------
ALTER TABLE public.admission_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admission_cutoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admission_conversion_anchors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admission_score_distributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admission_schools_select_public" ON public.admission_schools;
CREATE POLICY "admission_schools_select_public"
  ON public.admission_schools FOR SELECT USING (true);
DROP POLICY IF EXISTS "admission_schools_write_admin" ON public.admission_schools;
CREATE POLICY "admission_schools_write_admin"
  ON public.admission_schools FOR ALL
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "admission_cutoffs_select_public" ON public.admission_cutoffs;
CREATE POLICY "admission_cutoffs_select_public"
  ON public.admission_cutoffs FOR SELECT USING (true);
DROP POLICY IF EXISTS "admission_cutoffs_insert_admin" ON public.admission_cutoffs;
CREATE POLICY "admission_cutoffs_insert_admin"
  ON public.admission_cutoffs FOR INSERT WITH CHECK (public.is_admin((SELECT auth.uid())));
DROP POLICY IF EXISTS "admission_cutoffs_update_admin" ON public.admission_cutoffs;
CREATE POLICY "admission_cutoffs_update_admin"
  ON public.admission_cutoffs FOR UPDATE
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));
DROP POLICY IF EXISTS "admission_cutoffs_delete_admin" ON public.admission_cutoffs;
CREATE POLICY "admission_cutoffs_delete_admin"
  ON public.admission_cutoffs FOR DELETE USING (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "admission_conversion_anchors_select_public" ON public.admission_conversion_anchors;
CREATE POLICY "admission_conversion_anchors_select_public"
  ON public.admission_conversion_anchors FOR SELECT USING (true);
DROP POLICY IF EXISTS "admission_conversion_anchors_write_admin" ON public.admission_conversion_anchors;
CREATE POLICY "admission_conversion_anchors_write_admin"
  ON public.admission_conversion_anchors FOR ALL
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "admission_score_distributions_select_public" ON public.admission_score_distributions;
CREATE POLICY "admission_score_distributions_select_public"
  ON public.admission_score_distributions FOR SELECT USING (true);
DROP POLICY IF EXISTS "admission_score_distributions_write_admin" ON public.admission_score_distributions;
CREATE POLICY "admission_score_distributions_write_admin"
  ON public.admission_score_distributions FOR ALL
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));

REVOKE ALL ON public.admission_schools, public.admission_cutoffs,
  public.admission_conversion_anchors, public.admission_score_distributions
  FROM anon, authenticated;
GRANT SELECT ON public.admission_schools, public.admission_cutoffs,
  public.admission_conversion_anchors, public.admission_score_distributions
  TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.admission_schools, public.admission_cutoffs,
  public.admission_conversion_anchors, public.admission_score_distributions
  TO authenticated; -- vẫn bị RLS quản trị chặn với người dùng thường
