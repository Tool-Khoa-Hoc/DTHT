CREATE TABLE IF NOT EXISTS public.roadmap_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'student',
  sort_order integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'locked',
  progress integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roadmap_milestones
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS mode text DEFAULT 'student',
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS subtitle text DEFAULT '',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'locked',
  ADD COLUMN IF NOT EXISTS progress integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.roadmap_milestones
SET subtitle = ''
WHERE subtitle IS NULL;

UPDATE public.roadmap_milestones
SET status = 'locked'
WHERE status IS NULL OR status = '';

UPDATE public.roadmap_milestones
SET progress = 0
WHERE progress IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'roadmap_milestones_status_check'
  ) THEN
    ALTER TABLE public.roadmap_milestones
      ADD CONSTRAINT roadmap_milestones_status_check
      CHECK (status IN ('done', 'active', 'locked'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'roadmap_milestones_progress_check'
  ) THEN
    ALTER TABLE public.roadmap_milestones
      ADD CONSTRAINT roadmap_milestones_progress_check
      CHECK (progress >= 0 AND progress <= 100);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_roadmap_milestones_updated_at ON public.roadmap_milestones;
CREATE TRIGGER trg_roadmap_milestones_updated_at
BEFORE UPDATE ON public.roadmap_milestones
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.roadmap_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roadmap_milestones_select_own" ON public.roadmap_milestones;
CREATE POLICY "roadmap_milestones_select_own"
ON public.roadmap_milestones
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "roadmap_milestones_insert_own" ON public.roadmap_milestones;
CREATE POLICY "roadmap_milestones_insert_own"
ON public.roadmap_milestones
FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "roadmap_milestones_update_own" ON public.roadmap_milestones;
CREATE POLICY "roadmap_milestones_update_own"
ON public.roadmap_milestones
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "roadmap_milestones_delete_own" ON public.roadmap_milestones;
CREATE POLICY "roadmap_milestones_delete_own"
ON public.roadmap_milestones
FOR DELETE
USING (user_id = auth.uid());

CREATE UNIQUE INDEX IF NOT EXISTS idx_roadmap_milestones_user_mode_sort
  ON public.roadmap_milestones (user_id, mode, sort_order);

CREATE INDEX IF NOT EXISTS idx_roadmap_milestones_user_mode
  ON public.roadmap_milestones (user_id, mode);
