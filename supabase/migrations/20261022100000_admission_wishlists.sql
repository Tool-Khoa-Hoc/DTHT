/*
  Admission wishlists — danh sách nguyện vọng của thí sinh (Tìm trường v2)
  --------------------------------------------------------------------------
  GOAL: lưu nguyện vọng đã chuẩn bị ở trang Tìm trường (SchoolFinder) lên
  server thay vì chỉ nằm ở localStorage của 1 thiết bị. Mỗi dòng là 1
  nguyện vọng: 1 trường x 1 ngành x 1 phương thức, kèm thứ hạng (rank) do
  thí sinh tự sắp xếp và estimate_snapshot (xác suất/band/margin tại thời
  điểm lưu) để sau này đối chiếu khi dữ liệu điểm chuẩn thay đổi.

  Client hiện tại (tháng 10/2026) dùng localStorage 'admission_wishlist'
  làm nguồn chính và đồng bộ best-effort lên bảng này khi đã đăng nhập;
  bảng chưa tồn tại thì đồng bộ thất bại lặng lẽ, không ảnh hưởng UX.

  Migration này CHỈ thêm bảng mới + RLS, không đụng profiles /
  admission_scores (JSONB) hiện có.

  SECURITY: RLS bật; thí sinh chỉ SELECT/INSERT/UPDATE/DELETE được dòng
  của chính mình ((select auth.uid()) = user_id — mẫu initplan như các
  migration harden RLS trước đây của dự án).
*/

-- 1. Bảng nguyện vọng -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admission_wishlists (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_code       text NOT NULL,
  major_name        text NOT NULL,
  method            text NOT NULL,
  rank              integer NOT NULL DEFAULT 1 CHECK (rank >= 1),
  estimate_snapshot jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admission_wishlists_unique_wish
    UNIQUE (user_id, school_code, major_name, method)
);

CREATE INDEX IF NOT EXISTS idx_admission_wishlists_user_rank
  ON public.admission_wishlists (user_id, rank);

COMMENT ON TABLE public.admission_wishlists IS 'Nguyện vọng xét tuyển thí sinh chuẩn bị ở module Tìm trường: trường x ngành x phương thức + thứ hạng + snapshot ước tính lúc lưu.';
COMMENT ON COLUMN public.admission_wishlists.method IS 'Mã phương thức theo registry src/lib/admission/exams.js (thpt, hocba, hsa, vact, tsa, spt, hsca, bca, vsat, combined...).';
COMMENT ON COLUMN public.admission_wishlists.estimate_snapshot IS 'Ước tính tại thời điểm lưu: { probability, band, bandLabel, marginNative, forecastNative, viaMethod, savedAt } — để cảnh báo khi xác suất thay đổi ở lần tính lại.';

-- 2. RLS: chỉ chủ sở hữu ------------------------------------------------------
ALTER TABLE public.admission_wishlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admission_wishlists_select_own" ON public.admission_wishlists;
CREATE POLICY "admission_wishlists_select_own" ON public.admission_wishlists
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "admission_wishlists_insert_own" ON public.admission_wishlists;
CREATE POLICY "admission_wishlists_insert_own" ON public.admission_wishlists
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "admission_wishlists_update_own" ON public.admission_wishlists;
CREATE POLICY "admission_wishlists_update_own" ON public.admission_wishlists
  FOR UPDATE USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "admission_wishlists_delete_own" ON public.admission_wishlists;
CREATE POLICY "admission_wishlists_delete_own" ON public.admission_wishlists
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.admission_wishlists FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admission_wishlists TO authenticated;
