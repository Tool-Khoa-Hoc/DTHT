-- Drop the entire exam ("phòng thi") subsystem: tables, RPCs, triggers, policies.
--
-- ⚠️ DESTRUCTIVE & IRREVERSIBLE. Back up (export) the listed tables before running.
-- Apply to the project this repo actually uses (VITE_SUPABASE_URL in .env:
-- szvzwnbdjixcvgbgpavf) via `supabase db push` or the dashboard SQL editor.
-- Do NOT run this against any other Supabase project.
--
-- KEEP (not touched): profiles, orders, payment_logs, transactions, campaigns,
-- documents, school_scores, user_notes, roadmap_milestones, notifications, follows,
-- document_reports, subjects; functions is_active_vip, is_admin, admin_user_directory,
-- admin_get_thongsoai_candidates, set_order_transfer_code, order_transfer_code_from_uuid.

-- ---------------------------------------------------------------------------
-- 1. Drop exam-only tables (CASCADE removes their policies/triggers/constraints).
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.attempt_answers          CASCADE;
DROP TABLE IF EXISTS public.exam_attempts            CASCADE;
DROP TABLE IF EXISTS public.exam_assets              CASCADE;
DROP TABLE IF EXISTS public.exam_review_state        CASCADE;
DROP TABLE IF EXISTS public.exam_private_data        CASCADE;
DROP TABLE IF EXISTS public.exam_public_data         CASCADE;
DROP TABLE IF EXISTS public.exams                    CASCADE;
DROP TABLE IF EXISTS public.exam_import_jobs         CASCADE;
DROP TABLE IF EXISTS public.exam_draft_revisions     CASCADE;
DROP TABLE IF EXISTS public.exam_drafts              CASCADE;
DROP TABLE IF EXISTS public.exam_keys                CASCADE;
DROP TABLE IF EXISTS public.exam_results             CASCADE;
DROP TABLE IF EXISTS public.exam_progress            CASCADE;
DROP TABLE IF EXISTS public.user_access_log          CASCADE;
DROP TABLE IF EXISTS public.exam_subjects            CASCADE;
DROP TABLE IF EXISTS public.deleted_exam_tombstones  CASCADE;
DROP TABLE IF EXISTS public.sync_logs                CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Drop exam-only functions/RPCs by name (any overload), if still present.
--    Done in a loop so unknown argument signatures are handled robustly.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fn regprocedure;
  target_name text;
BEGIN
  FOREACH target_name IN ARRAY ARRAY[
    'check_and_log_exam_access',
    'get_exam_review_payload',
    'calculate_flat_score',
    'normalize_answers_to_flat',
    'list_exam_answer_files',
    'resolve_exam_key_lookup',
    '_rescore_exam_results_for_exam',
    '_trg_rescore_exam_results_on_exam_keys',
    'admin_clear_deleted_exam_marker',
    'admin_delete_exam_bundle',
    'admin_delete_exam_key',
    'admin_delete_exam_subject',
    'admin_get_exam_key',
    'admin_list_exam_answer_status',
    'admin_list_exam_keys',
    'admin_list_exam_subjects',
    'admin_mark_exam_deleted',
    'admin_update_exam_identity',
    'admin_upsert_exam_answer_resource',
    'admin_upsert_exam_key_bundle',
    'admin_upsert_exam_subject'
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
