/*
  Security hardening + index cleanup — June 2026
  --------------------------------------------------------------------------
  PROBLEM (data exposure): the `profiles` SELECT policies were USING(true),
  and every column is granted to anon/authenticated. Anyone — including
  logged-out visitors — could read EVERY user's email, full_name,
  admission_scores, roadmap_data and VIP billing status.

  FIX (no functional regression):
  1. `public_profile_view` becomes SECURITY DEFINER (security_invoker=false)
     so it bypasses RLS and exposes ONLY safe, already-public columns. Grants
     tightened to SELECT. This is the single sanctioned path for reading other
     users' public info (UserProfile page + StudyArena leaderboard).
  2. The `profiles` TABLE is locked to own-row + admin for SELECT. Owners keep
     full access to their own row (auth/profile pages); admins keep full
     access; nobody else can read the table directly. Sensitive columns are
     now unreachable cross-user.
  3. Drop two genuinely-unused school_scores indexes (idx_scan=0) to cut
     write overhead. Verified via pg_stat_user_indexes.

  App change shipped alongside: StudyArena.jsx reads other users' public info
  from public_profile_view instead of embedding the profiles table.
*/

-- 1. Safe public view (definer, safe columns only) --------------------------
DROP VIEW IF EXISTS public.public_profile_view;
CREATE VIEW public.public_profile_view
WITH (security_invoker = false) AS
SELECT
  id,
  display_name,
  avatar_url,
  role,
  university,
  user_mode,
  target_gpa,
  target_thpt,
  target_dgnl,
  current_gpa,
  is_approved_bang_chu
FROM public.profiles;

REVOKE ALL ON public.public_profile_view FROM anon, authenticated;
GRANT SELECT ON public.public_profile_view TO anon, authenticated;

-- 2. Lock the profiles table: own row or admin only -------------------------
DROP POLICY IF EXISTS "profiles_select_anon_limited" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles FOR SELECT
USING (
  (SELECT auth.uid()) = id
  OR (SELECT public.is_admin((SELECT auth.uid())))
);

-- 3. Drop unused indexes on school_scores -----------------------------------
DROP INDEX IF EXISTS public.idx_school_scores_method_year;
DROP INDEX IF EXISTS public.idx_school_scores_year;
