-- Migration: Create Exam Composer Tables
-- Description: Adds tables for the Exam Composer workflow (drafts, revisions, import jobs)

CREATE TABLE IF NOT EXISTS public.exam_drafts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    subject text NOT NULL,
    duration_min integer NOT NULL DEFAULT 50,
    status text NOT NULL CHECK (status IN ('draft', 'published')) DEFAULT 'draft',
    content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    answer_key_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    raw_source_text text,
    created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    published_at timestamptz
);

-- Ensure the trigger for updated_at exists on exam_drafts
DROP TRIGGER IF EXISTS trg_exam_drafts_updated_at ON public.exam_drafts;
CREATE TRIGGER trg_exam_drafts_updated_at
BEFORE UPDATE ON public.exam_drafts
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.exam_draft_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id uuid NOT NULL REFERENCES public.exam_drafts(id) ON DELETE CASCADE,
    revision_no integer NOT NULL,
    content_json jsonb NOT NULL,
    answer_key_json jsonb NOT NULL,
    raw_source_text text,
    created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(draft_id, revision_no)
);

CREATE TABLE IF NOT EXISTS public.exam_import_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    filename text,
    status text,
    parse_error text,
    preview_json jsonb,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Ensure the trigger for updated_at exists on exam_import_jobs
DROP TRIGGER IF EXISTS trg_exam_import_jobs_updated_at ON public.exam_import_jobs;
CREATE TRIGGER trg_exam_import_jobs_updated_at
BEFORE UPDATE ON public.exam_import_jobs
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_exam_drafts_status_updated ON public.exam_drafts(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_drafts_created_by_updated ON public.exam_drafts(created_by, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_draft_revisions_draft_id ON public.exam_draft_revisions(draft_id);
