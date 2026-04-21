ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS uploaded_at timestamptz;

UPDATE public.documents
SET uploaded_at = COALESCE(uploaded_at, created_at, now())
WHERE uploaded_at IS NULL;

ALTER TABLE public.documents
  ALTER COLUMN uploaded_at SET DEFAULT now();

ALTER TABLE public.documents
  ALTER COLUMN uploaded_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by_uploaded_at
  ON public.documents (uploaded_by, uploaded_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_public_category_uploaded_at
  ON public.documents (is_public, education_level, category, uploaded_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_public_major_uploaded_at
  ON public.documents (is_public, education_level, major, uploaded_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_featured_uploaded_at
  ON public.documents (is_featured, education_level, publish_date DESC, uploaded_at DESC, created_at DESC);
