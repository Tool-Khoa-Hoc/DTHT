/*
  Fix profiles RLS recursion.

  The 20260614130000 migration locked public.profiles to own-row/admin reads,
  but the existing UPDATE policy still checked admin access by querying
  public.profiles directly from inside a policy on public.profiles. PostgreSQL
  detects that self-reference as infinite recursion.

  Keep the data exposure fix, but route admin checks through the SECURITY
  DEFINER helper so RLS does not recursively evaluate itself.
*/

CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = user_id
      AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) = id
  OR (SELECT public.is_admin((SELECT auth.uid())))
);

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  (SELECT auth.uid()) = id
  OR (SELECT public.is_admin((SELECT auth.uid())))
)
WITH CHECK (
  (SELECT auth.uid()) = id
  OR (SELECT public.is_admin((SELECT auth.uid())))
);
