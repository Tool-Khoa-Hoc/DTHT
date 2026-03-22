CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  subject text,
  duration_minutes integer,
  status text NOT NULL DEFAULT 'draft_review' CHECK (status IN ('draft_review', 'published')),
  solution_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.exam_public_data (
  exam_id uuid PRIMARY KEY REFERENCES public.exams(id) ON DELETE CASCADE,
  exam_public_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.exam_private_data (
  exam_id uuid PRIMARY KEY REFERENCES public.exams(id) ON DELETE CASCADE,
  exam_private_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  full_raw_markup text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.exam_review_state (
  exam_id uuid PRIMARY KEY REFERENCES public.exams(id) ON DELETE CASCADE,
  validation_report jsonb NOT NULL DEFAULT '{}'::jsonb,
  exam_review_package jsonb NOT NULL DEFAULT '{}'::jsonb,
  warning_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  has_blocking_errors boolean NOT NULL DEFAULT false,
  needs_manual_review boolean NOT NULL DEFAULT true,
  needs_answer_key_setup boolean NOT NULL DEFAULT true,
  can_publish boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_validated_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.exam_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  question_id text,
  asset_type text NOT NULL CHECK (asset_type IN ('image', 'math', 'table', 'other')),
  storage_path text,
  public_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'cancelled')),
  score numeric(8, 2),
  max_score numeric(8, 2),
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attempt_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  answer_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_correct boolean,
  awarded_points numeric(8, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_exams_status_updated_at ON public.exams(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_assets_exam_question ON public.exam_assets(exam_id, question_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_user ON public.exam_attempts(exam_id, user_id);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt_id ON public.attempt_answers(attempt_id);
