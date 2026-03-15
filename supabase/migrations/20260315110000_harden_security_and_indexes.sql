/* global auth */

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  reported_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

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

DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles',
        'documents',
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

ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.document_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exam_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles
FOR SELECT
USING (auth.uid() = id OR public.is_admin(auth.uid()));

CREATE POLICY "profiles_update_own_or_admin"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id OR public.is_admin(auth.uid()))
WITH CHECK (auth.uid() = id OR public.is_admin(auth.uid()));

CREATE POLICY "profiles_insert_self_or_admin"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF auth.uid() <> OLD.id AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'You can only update your own profile';
  END IF;

  IF NOT public.is_admin(auth.uid()) THEN
    IF NEW.role IS DISTINCT FROM OLD.role
      OR NEW.is_vip IS DISTINCT FROM OLD.is_vip
      OR NEW.vip_expired_at IS DISTINCT FROM OLD.vip_expired_at
      OR NEW.is_approved_bang_chu IS DISTINCT FROM OLD.is_approved_bang_chu THEN
      RAISE EXCEPTION 'Not allowed to update protected profile fields';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_fields();

CREATE OR REPLACE VIEW public.public_profile_view
WITH (security_invoker = true) AS
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

GRANT SELECT ON public.public_profile_view TO anon, authenticated;

CREATE POLICY "documents_public_read_or_owner_or_admin"
ON public.documents
FOR SELECT
USING (
  COALESCE(is_public, false) = true
  OR uploaded_by = auth.uid()
  OR public.is_admin(auth.uid())
);

CREATE POLICY "documents_insert_staff_only"
ON public.documents
FOR INSERT
WITH CHECK (
  public.is_staff(auth.uid())
  AND uploaded_by = auth.uid()
);

CREATE POLICY "documents_update_owner_or_admin"
ON public.documents
FOR UPDATE
USING (uploaded_by = auth.uid() OR public.is_admin(auth.uid()))
WITH CHECK (uploaded_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "documents_delete_owner_or_admin"
ON public.documents
FOR DELETE
USING (uploaded_by = auth.uid() OR public.is_admin(auth.uid()));

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
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
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

CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by_created_at
  ON public.documents (uploaded_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_public_filters
  ON public.documents (is_public, education_level, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON public.notifications (user_id, is_read);

CREATE UNIQUE INDEX IF NOT EXISTS idx_follows_unique_pair
  ON public.follows (follower_id, following_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_reports_unique_pair
  ON public.document_reports (document_id, reported_by);

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
