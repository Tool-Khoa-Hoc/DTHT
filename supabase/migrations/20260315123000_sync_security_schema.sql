CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.is_admin(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_uid AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_uid AND role IN ('admin', 'collaborator')
  );
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_order_package_catalog()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  CASE NEW.package_id
    WHEN '1m' THEN
      NEW.amount := 39000;
      NEW.vip_days := 30;
    WHEN '3m' THEN
      NEW.amount := 79000;
      NEW.vip_days := 90;
    WHEN '1y' THEN
      NEW.amount := 149000;
      NEW.vip_days := 365;
    ELSE
      RAISE EXCEPTION 'Unsupported package_id: %', NEW.package_id;
  END CASE;

  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS link text,
  ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.follows
  ADD COLUMN IF NOT EXISTS follower_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS following_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.document_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  reported_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_reports
  ADD COLUMN IF NOT EXISTS document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reported_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.user_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_access_log
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS exam_id text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.exam_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id text NOT NULL,
  subject_folder text,
  answers_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'in_progress'
);

ALTER TABLE public.exam_progress
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS exam_id text,
  ADD COLUMN IF NOT EXISTS subject_folder text,
  ADD COLUMN IF NOT EXISTS answers_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'in_progress';

CREATE TABLE IF NOT EXISTS public.exam_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id text NOT NULL,
  subject_folder text NOT NULL,
  exam_title text,
  answers_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  score numeric(5, 2) NOT NULL DEFAULT 0,
  max_score numeric(5, 2) NOT NULL DEFAULT 10,
  correct_count integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_results
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS exam_id text,
  ADD COLUMN IF NOT EXISTS subject_folder text,
  ADD COLUMN IF NOT EXISTS exam_title text,
  ADD COLUMN IF NOT EXISTS answers_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS score numeric(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_score numeric(5, 2) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS correct_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_questions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id text NOT NULL,
  amount integer NOT NULL,
  vip_days integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS package_id text,
  ADD COLUMN IF NOT EXISTS amount integer,
  ADD COLUMN IF NOT EXISTS vip_days integer,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.payment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount integer,
  provider text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_logs
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS amount integer,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  transaction_code text,
  amount integer,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transaction_code text,
  ADD COLUMN IF NOT EXISTS amount integer,
  ADD COLUMN IF NOT EXISTS raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_exam_progress_updated_at ON public.exam_progress;
CREATE TRIGGER trg_exam_progress_updated_at
BEFORE UPDATE ON public.exam_progress
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_enforce_package_catalog ON public.orders;
CREATE TRIGGER trg_orders_enforce_package_catalog
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_order_package_catalog();

DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'document_reports',
        'notifications',
        'follows',
        'user_access_log',
        'exam_progress',
        'exam_results',
        'orders',
        'payment_logs',
        'transactions'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_row.policyname, policy_row.tablename);
  END LOOP;
END $$;

ALTER TABLE public.document_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_reports_select_own_or_admin"
ON public.document_reports
FOR SELECT
USING (reported_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "document_reports_insert_own_only"
ON public.document_reports
FOR INSERT
WITH CHECK (
  reported_by = auth.uid()
  AND NOT EXISTS (
    SELECT 1
    FROM public.documents
    WHERE documents.id = document_id
      AND documents.uploaded_by = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.notify_document_owner_on_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  doc_owner uuid;
  doc_title text;
BEGIN
  SELECT uploaded_by, title
  INTO doc_owner, doc_title
  FROM public.documents
  WHERE id = NEW.document_id;

  IF doc_owner IS NOT NULL AND doc_owner <> NEW.reported_by THEN
    INSERT INTO public.notifications (user_id, title, message, link)
    VALUES (
      doc_owner,
      'Tài liệu bị báo cáo',
      format('Tài liệu "%s" vừa bị báo cáo với lý do: %s', COALESCE(doc_title, 'Không rõ tiêu đề'), COALESCE(NEW.reason, 'Không rõ')),
      '/library'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_document_owner_on_report ON public.document_reports;
CREATE TRIGGER trg_notify_document_owner_on_report
AFTER INSERT ON public.document_reports
FOR EACH ROW
EXECUTE FUNCTION public.notify_document_owner_on_report();

CREATE POLICY "notifications_select_own_only"
ON public.notifications
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own_only"
ON public.notifications
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications_insert_admin_only"
ON public.notifications
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "follows_read_authenticated"
ON public.follows
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "follows_insert_self_only"
ON public.follows
FOR INSERT
WITH CHECK (follower_id = auth.uid() AND follower_id <> following_id);

CREATE POLICY "follows_delete_self_only"
ON public.follows
FOR DELETE
USING (follower_id = auth.uid());

CREATE POLICY "user_access_log_own_all"
ON public.user_access_log
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "exam_progress_own_all"
ON public.exam_progress
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "exam_results_own_select_insert"
ON public.exam_results
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "exam_results_insert_own_only"
ON public.exam_results
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "orders_select_own_or_admin"
ON public.orders
FOR SELECT
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "orders_insert_own_only"
ON public.orders
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "orders_update_admin_only"
ON public.orders
FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "payment_logs_admin_only"
ON public.payment_logs
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "payment_logs_insert_admin_only"
ON public.payment_logs
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "transactions_admin_only"
ON public.transactions
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "transactions_insert_admin_only"
ON public.transactions
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_reports_unique_pair
  ON public.document_reports (document_id, reported_by);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON public.notifications (user_id, is_read);

CREATE UNIQUE INDEX IF NOT EXISTS idx_follows_unique_pair
  ON public.follows (follower_id, following_id);

CREATE INDEX IF NOT EXISTS idx_user_access_log_user_exam
  ON public.user_access_log (user_id, exam_id);

CREATE INDEX IF NOT EXISTS idx_user_access_log_user_created_at
  ON public.user_access_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_exam_progress_user_exam_status
  ON public.exam_progress (user_id, exam_id, status);

CREATE INDEX IF NOT EXISTS idx_exam_results_user_submitted_at
  ON public.exam_results (user_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_exam_results_user_exam
  ON public.exam_results (user_id, exam_id);

CREATE INDEX IF NOT EXISTS idx_orders_user_status_created_at
  ON public.orders (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_logs_created_at
  ON public.payment_logs (created_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'public_profile_view'
  ) THEN
    EXECUTE 'GRANT SELECT ON public.public_profile_view TO anon, authenticated';
  END IF;
END $$;
