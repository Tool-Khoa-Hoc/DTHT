CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.order_transfer_code_from_uuid(p_id uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'DH' || upper(substr(replace(p_id::text, '-', ''), 1, 12));
$$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS transfer_code text;

UPDATE public.orders
SET transfer_code = public.order_transfer_code_from_uuid(id)
WHERE transfer_code IS NULL OR btrim(transfer_code) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_transfer_code_unique
  ON public.orders (transfer_code);

CREATE OR REPLACE FUNCTION public.set_order_transfer_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;

  IF NEW.transfer_code IS NULL OR btrim(NEW.transfer_code) = '' THEN
    NEW.transfer_code := public.order_transfer_code_from_uuid(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_set_transfer_code ON public.orders;
CREATE TRIGGER trg_orders_set_transfer_code
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_order_transfer_code();

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'http extension unavailable: %', SQLERRM;
END
$$;

CREATE OR REPLACE FUNCTION public.parse_money_to_bigint(p_value text)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_clean text;
BEGIN
  IF p_value IS NULL THEN
    RETURN NULL;
  END IF;

  v_clean := regexp_replace(p_value, '[^0-9\-]', '', 'g');
  IF v_clean = '' OR v_clean = '-' THEN
    RETURN NULL;
  END IF;

  RETURN v_clean::bigint;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.allow_protected_profile_update', true) = 'on' THEN
    RETURN NEW;
  END IF;

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

CREATE OR REPLACE FUNCTION public.reconcile_vip_payment(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_is_admin boolean := false;

  v_order public.orders%ROWTYPE;
  v_profile_expiry timestamptz;
  v_base_expiry timestamptz;
  v_new_expiry timestamptz;

  v_account_no text := '9356026163';
  v_api_password text := 'password';
  v_api_token text := 'd5259d1f01433a8068f98b935d2b48aa';
  v_api_url text;

  v_http_status integer;
  v_http_content text;
  v_payload jsonb;
  v_transactions jsonb := '[]'::jsonb;

  v_item jsonb;
  v_matched jsonb := NULL;
  v_desc text;
  v_amount bigint;
  v_transfer_code text;
  v_transaction_code text;
  v_existing_order_id uuid;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_is_admin := public.is_admin(v_actor_id);

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND (user_id = v_actor_id OR v_is_admin)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'status', 'not_found',
      'message', 'Order not found'
    );
  END IF;

  IF v_order.transfer_code IS NULL OR btrim(v_order.transfer_code) = '' THEN
    v_transfer_code := public.order_transfer_code_from_uuid(v_order.id);
    UPDATE public.orders
    SET transfer_code = v_transfer_code
    WHERE id = v_order.id;
    v_order.transfer_code := v_transfer_code;
  END IF;

  IF v_order.status = 'paid' THEN
    SELECT vip_expired_at
    INTO v_profile_expiry
    FROM public.profiles
    WHERE id = v_order.user_id;

    RETURN jsonb_build_object(
      'ok', true,
      'status', 'already_paid',
      'order_id', v_order.id,
      'transfer_code', v_order.transfer_code,
      'vip_expired_at', v_profile_expiry
    );
  END IF;

  v_api_url := format(
    'https://thueapibank.vn/historyapivcbv3/%s/%s/%s',
    v_api_password,
    v_account_no,
    v_api_token
  );

  BEGIN
    BEGIN
      EXECUTE 'SELECT r.status::int, r.content::text FROM extensions.http_get($1) AS r'
        INTO v_http_status, v_http_content
        USING v_api_url;
    EXCEPTION
      WHEN undefined_function OR invalid_schema_name THEN
        EXECUTE 'SELECT r.status::int, r.content::text FROM http_get($1) AS r'
          INTO v_http_status, v_http_content
          USING v_api_url;
    END;
  EXCEPTION
    WHEN undefined_function OR invalid_schema_name THEN
      RETURN jsonb_build_object(
        'ok', false,
        'status', 'config_error',
        'message', 'Missing http_get. Enable the http extension first.'
      );
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'ok', false,
        'status', 'provider_unreachable',
        'message', SQLERRM
      );
  END;

  IF COALESCE(v_http_status, 0) < 200 OR COALESCE(v_http_status, 0) >= 300 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'status', 'provider_error',
      'http_status', v_http_status,
      'message', 'Payment provider returned a non-success status'
    );
  END IF;

  BEGIN
    v_payload := COALESCE(NULLIF(trim(v_http_content), ''), '{}')::jsonb;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'ok', false,
        'status', 'provider_payload_invalid',
        'message', 'Provider payload is not valid JSON'
      );
  END;

  IF jsonb_typeof(v_payload) = 'array' THEN
    v_transactions := v_payload;
  ELSIF jsonb_typeof(v_payload -> 'data') = 'array' THEN
    v_transactions := v_payload -> 'data';
  ELSIF jsonb_typeof(v_payload -> 'transactions') = 'array' THEN
    v_transactions := v_payload -> 'transactions';
  ELSIF jsonb_typeof(v_payload -> 'result') = 'array' THEN
    v_transactions := v_payload -> 'result';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_transactions)
  LOOP
    v_desc := lower(
      concat_ws(
        ' ',
        COALESCE(v_item ->> 'description', ''),
        COALESCE(v_item ->> 'content', ''),
        COALESCE(v_item ->> 'note', ''),
        COALESCE(v_item ->> 'memo', ''),
        COALESCE(v_item ->> 'addInfo', ''),
        COALESCE(v_item ->> 'transaction_content', ''),
        COALESCE(v_item ->> 'transactionContent', '')
      )
    );

    v_amount := COALESCE(
      public.parse_money_to_bigint(v_item ->> 'amount'),
      public.parse_money_to_bigint(v_item ->> 'money'),
      public.parse_money_to_bigint(v_item ->> 'total_amount'),
      public.parse_money_to_bigint(v_item ->> 'totalAmount'),
      public.parse_money_to_bigint(v_item ->> 'value'),
      public.parse_money_to_bigint(v_item ->> 'creditAmount'),
      public.parse_money_to_bigint(v_item ->> 'credit_amount')
    );

    IF v_amount = v_order.amount
      AND position(lower(v_order.transfer_code) IN v_desc) > 0
    THEN
      v_matched := v_item;
      EXIT;
    END IF;
  END LOOP;

  IF v_matched IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'status', 'pending',
      'order_id', v_order.id,
      'transfer_code', v_order.transfer_code,
      'message', 'No matched transaction found yet'
    );
  END IF;

  v_transaction_code := COALESCE(
    NULLIF(v_matched ->> 'transaction_code', ''),
    NULLIF(v_matched ->> 'transactionCode', ''),
    NULLIF(v_matched ->> 'code', ''),
    NULLIF(v_matched ->> 'reference', ''),
    NULLIF(v_matched ->> 'id', ''),
    NULLIF(v_matched ->> 'trans_id', ''),
    NULLIF(v_matched ->> 'transId', ''),
    NULLIF(v_matched ->> 'transactionID', '')
  );

  IF v_transaction_code IS NULL THEN
    v_transaction_code := 'AUTO_' || substr(md5(v_matched::text), 1, 24);
  END IF;

  SELECT order_id
  INTO v_existing_order_id
  FROM public.transactions
  WHERE transaction_code = v_transaction_code
  LIMIT 1;

  IF v_existing_order_id IS NOT NULL AND v_existing_order_id <> v_order.id THEN
    RETURN jsonb_build_object(
      'ok', false,
      'status', 'transaction_already_used',
      'order_id', v_order.id,
      'transfer_code', v_order.transfer_code,
      'transaction_code', v_transaction_code,
      'message', 'Matched transaction already assigned to another order'
    );
  END IF;

  IF v_existing_order_id IS NULL THEN
    INSERT INTO public.transactions (
      order_id,
      user_id,
      transaction_code,
      amount,
      raw_data
    )
    VALUES (
      v_order.id,
      v_order.user_id,
      v_transaction_code,
      v_order.amount,
      v_matched
    );
  END IF;

  INSERT INTO public.payment_logs (
    order_id,
    user_id,
    amount,
    provider,
    payload
  )
  VALUES (
    v_order.id,
    v_order.user_id,
    v_order.amount,
    'thueapibank_vcb_v3',
    jsonb_build_object(
      'transfer_code', v_order.transfer_code,
      'transaction_code', v_transaction_code,
      'matched_transaction', v_matched
    )
  );

  UPDATE public.orders
  SET status = 'paid',
      updated_at = now()
  WHERE id = v_order.id;

  SELECT vip_expired_at
  INTO v_profile_expiry
  FROM public.profiles
  WHERE id = v_order.user_id
  FOR UPDATE;

  v_base_expiry := CASE
    WHEN v_profile_expiry IS NOT NULL AND v_profile_expiry > now() THEN v_profile_expiry
    ELSE now()
  END;

  v_new_expiry := v_base_expiry + make_interval(days => GREATEST(COALESCE(v_order.vip_days, 0), 0));

  PERFORM set_config('app.allow_protected_profile_update', 'on', true);

  UPDATE public.profiles
  SET is_vip = true,
      vip_expired_at = v_new_expiry
  WHERE id = v_order.user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'paid',
    'order_id', v_order.id,
    'transfer_code', v_order.transfer_code,
    'transaction_code', v_transaction_code,
    'vip_expired_at', v_new_expiry
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_vip_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_vip_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_vip_payment(uuid) TO service_role;
