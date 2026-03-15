CREATE OR REPLACE FUNCTION public.admin_user_directory(
  p_search text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_ids uuid[] DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  email text,
  display_name text,
  full_name text,
  avatar_url text,
  role text,
  is_vip boolean,
  vip_expired_at timestamptz,
  is_approved_bang_chu boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_search text := NULLIF(trim(COALESCE(p_search, '')), '');
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 200);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    u.email,
    p.display_name,
    COALESCE(
      u.raw_user_meta_data ->> 'full_name',
      u.raw_user_meta_data ->> 'name'
    ) AS full_name,
    COALESCE(
      p.avatar_url,
      u.raw_user_meta_data ->> 'avatar_url',
      u.raw_user_meta_data ->> 'picture'
    ) AS avatar_url,
    p.role,
    p.is_vip,
    p.vip_expired_at,
    p.is_approved_bang_chu
  FROM public.profiles AS p
  LEFT JOIN auth.users AS u
    ON u.id = p.id
  WHERE
    (p_role IS NULL OR p.role = p_role)
    AND (p_ids IS NULL OR p.id = ANY (p_ids))
    AND (
      v_search IS NULL
      OR COALESCE(u.email, '') ILIKE '%' || v_search || '%'
      OR COALESCE(p.display_name, '') ILIKE '%' || v_search || '%'
      OR COALESCE(
        u.raw_user_meta_data ->> 'full_name',
        u.raw_user_meta_data ->> 'name',
        ''
      ) ILIKE '%' || v_search || '%'
    )
  ORDER BY
    CASE
      WHEN v_search IS NULL THEN 1
      WHEN lower(COALESCE(u.email, '')) = lower(v_search) THEN 0
      WHEN lower(COALESCE(u.email, '')) LIKE lower(v_search) || '%' THEN 1
      ELSE 2
    END,
    p.is_vip DESC,
    COALESCE(p.display_name, u.email, p.id::text)
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_directory(text, text, uuid[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_user_directory(text, text, uuid[], integer) TO authenticated;
