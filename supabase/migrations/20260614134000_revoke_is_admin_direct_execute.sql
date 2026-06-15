/*
  Prevent direct API execution of the SECURITY DEFINER admin helper.

  RLS policies still need authenticated users to have EXECUTE on
  public.is_admin(...), but logged-out clients should not be able to call it
  through /rest/v1/rpc/is_admin.
*/

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO service_role;
