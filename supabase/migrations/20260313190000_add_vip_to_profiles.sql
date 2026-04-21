-- Add VIP columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vip_expired_at timestamptz;

COMMENT ON COLUMN public.profiles.is_vip IS 'True nếu user đang có gói VIP còn hạn';
COMMENT ON COLUMN public.profiles.vip_expired_at IS 'Thời điểm hết hạn VIP. NULL = chưa từng là VIP';
