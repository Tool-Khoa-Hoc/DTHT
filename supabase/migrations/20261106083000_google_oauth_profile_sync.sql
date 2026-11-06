-- Migration: đồng bộ tự động hồ sơ Google OAuth vào public.profiles
-- Ngày tạo: 2026-11-06
-- Mục đích:
--   1. Mở rộng public.handle_new_user() để trích xuất đầy đủ metadata từ Google OAuth
--      (display_name / full_name / name, avatar_url / picture, email).
--   2. Sử dụng ON CONFLICT (id) DO UPDATE kèm cờ app.allow_protected_profile_update = 'on'
--      để không bao giờ lỗi khi hồ sơ đã tồn tại hoặc khi người dùng liên kết thêm Google.
--   3. Bổ sung trigger on_auth_user_updated trên auth.users để tự động bổ sung ảnh đại diện
--      và tên hiển thị khi tài khoản cũ đăng nhập bằng Google.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
  v_avatar text;
BEGIN
  PERFORM set_config('app.allow_protected_profile_update', 'on', true);

  v_name := COALESCE(
    NULLIF(btrim(new.raw_user_meta_data->>'display_name'), ''),
    NULLIF(btrim(new.raw_user_meta_data->>'full_name'), ''),
    NULLIF(btrim(new.raw_user_meta_data->>'name'), ''),
    NULLIF(split_part(COALESCE(new.email, ''), '@', 1), ''),
    'Sĩ tử'
  );

  v_avatar := COALESCE(
    NULLIF(btrim(new.raw_user_meta_data->>'avatar_url'), ''),
    NULLIF(btrim(new.raw_user_meta_data->>'picture'), '')
  );

  INSERT INTO public.profiles (id, display_name, full_name, avatar_url, email)
  VALUES (new.id, v_name, v_name, v_avatar, new.email)
  ON CONFLICT (id) DO UPDATE
  SET
    display_name = COALESCE(NULLIF(btrim(public.profiles.display_name), ''), EXCLUDED.display_name),
    full_name    = COALESCE(NULLIF(btrim(public.profiles.full_name), ''), EXCLUDED.full_name),
    avatar_url   = COALESCE(NULLIF(btrim(public.profiles.avatar_url), ''), EXCLUDED.avatar_url),
    email        = COALESCE(NULLIF(btrim(public.profiles.email), ''), EXCLUDED.email);

  RETURN new;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND tgname = 'on_auth_user_updated'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER on_auth_user_updated
      AFTER UPDATE OF raw_user_meta_data, email ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;
