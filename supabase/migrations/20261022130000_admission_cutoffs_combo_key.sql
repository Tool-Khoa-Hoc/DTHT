-- Migration: thêm combo vào khóa duy nhất của admission_cutoffs
-- Ngày tạo: 2026-10-22
--
-- Lý do: cùng 1 trường/ngành/phương thức/năm có thể có điểm chuẩn KHÁC NHAU
-- theo từng tổ hợp xét tuyển. Ví dụ thật từ dữ liệu đã nạp:
--   TDTU 2025 học bạ — Ngôn ngữ Anh:        D01 = 36,85 | D11 = 37,10
--   TDTU 2025 học bạ — Ngôn ngữ Trung Quốc: D01 = 36,24 | D11 = 36,49
-- Khóa cũ (không có combo) khiến 2 hàng D11 bị bỏ qua lặng lẽ khi nạp seed
-- (ON CONFLICT DO NOTHING) — DB chỉ có D01, thiếu D11.
-- Trong khi file JSON fallback public/data/admissions/cutoffs.json vẫn đủ cả 4 hàng
-- → cùng 1 web nhưng dữ liệu khác nhau tùy nguồn đọc được.
--
-- Thư viện runtime (src/lib/admission/cutoffs.js) đã gom theo
-- (schoolCode, majorCode, combo, method, segment) nên không cần sửa code,
-- chỉ cần schema cho phép 2 combo cùng tồn tại.
--
-- An toàn: khóa mới là siêu tập của khóa cũ (thêm cột) nên dữ liệu hiện có
-- KHÔNG thể vi phạm — migration chỉ nới chứ không siết.
--
-- Sau khi áp migration: chạy lại 2 dòng seed D11 đã có sẵn trong
-- supabase/seed_admission_cutoffs.sql (dòng 812 và 814).

ALTER TABLE public.admission_cutoffs
  DROP CONSTRAINT admission_cutoffs_unique_point;

ALTER TABLE public.admission_cutoffs
  ADD CONSTRAINT admission_cutoffs_unique_point
    UNIQUE NULLS NOT DISTINCT (school_code, major_code, major_name, combo, method, year, segment);
