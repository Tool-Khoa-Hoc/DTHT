-- Drop remaining exam-only RPCs/functions that survived the main exam-system drop.
--
-- These functions no longer have backing tables after 20260613000000_drop_exam_system.sql
-- and are no longer referenced by the frontend.

DO $$
DECLARE
  fn regprocedure;
  target_name text;
BEGIN
  FOREACH target_name IN ARRAY ARRAY[
    'calculate_exam_score',
    'get_exam_resources',
    'normalize_exam_answer_payload',
    'public_get_exam_resources',
    'public_list_deleted_exam_tombstones',
    'public_list_exam_index',
    'rescore_exam_results_for_exam',
    'submit_exam_securely'
  ]
  LOOP
    FOR fn IN
      SELECT p.oid::regprocedure
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = target_name
    LOOP
      EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', fn);
    END LOOP;
  END LOOP;
END;
$$;
