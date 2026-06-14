/*
  Performance — RLS InitPlan optimisation for the two remaining un-optimised
  tables (June 2026).

  Verified against LIVE production state: most tables already wrap auth helpers
  in scalar sub-SELECTs. Only `user_notes` and the `school_scores` admin-write
  policies still call `auth.uid()` / `is_admin(auth.uid())` bare, so Postgres
  re-evaluates them per row. Wrapping them in `(SELECT ...)` makes Postgres run
  the helper ONCE PER QUERY (InitPlan) instead of once per row.

  Zero behaviour change — same predicates, same semantics, exact same policy
  names. The documents/profiles/notifications indexes and policies are already
  optimised in production, so they are intentionally NOT touched here.
*/

-- user_notes ----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own notes" ON public.user_notes;
CREATE POLICY "Users can view their own notes"
ON public.user_notes FOR SELECT
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own notes" ON public.user_notes;
CREATE POLICY "Users can insert their own notes"
ON public.user_notes FOR INSERT
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own notes" ON public.user_notes;
CREATE POLICY "Users can update their own notes"
ON public.user_notes FOR UPDATE
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own notes" ON public.user_notes;
CREATE POLICY "Users can delete their own notes"
ON public.user_notes FOR DELETE
USING ((SELECT auth.uid()) = user_id);

-- school_scores (admin write paths only; public SELECT stays USING(true)) -----
DROP POLICY IF EXISTS "school_scores_insert_admin" ON public.school_scores;
CREATE POLICY "school_scores_insert_admin"
ON public.school_scores FOR INSERT
WITH CHECK ((SELECT public.is_admin((SELECT auth.uid()))));

DROP POLICY IF EXISTS "school_scores_update_admin" ON public.school_scores;
CREATE POLICY "school_scores_update_admin"
ON public.school_scores FOR UPDATE
USING ((SELECT public.is_admin((SELECT auth.uid()))))
WITH CHECK ((SELECT public.is_admin((SELECT auth.uid()))));

DROP POLICY IF EXISTS "school_scores_delete_admin" ON public.school_scores;
CREATE POLICY "school_scores_delete_admin"
ON public.school_scores FOR DELETE
USING ((SELECT public.is_admin((SELECT auth.uid()))));
