// ─── Constants ─────────────────────────────────────────────────────────────
// VietQR image generation uses the public VietQR CDN — no credentials needed.
const VCB_BANK_CODE = 'vietcombank';

// Supabase Edge Function endpoint (reads credentials server-side from env secrets).
const VERIFY_PAYMENT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-payment`;
const SUPABASE_ANON_KEY   = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─── Utility helpers ────────────────────────────────────────────────────────

const toPositiveInteger = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.round(parsed);
};

const pickFirstDefined = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== '');

// ─── Public: VietQR URL builder ─────────────────────────────────────────────

export function buildVietQrUrl({ accountNo, amount, transferContent }) {
  if (!accountNo) {
    return '';
  }

  const params = new URLSearchParams();
  const normalizedAmount = toPositiveInteger(amount);

  if (normalizedAmount) {
    params.set('amount', String(normalizedAmount));
  }
  if (transferContent) {
    params.set('addInfo', transferContent);
  }

  const query = params.toString();
  const base  = `https://img.vietqr.io/image/${VCB_BANK_CODE}-${accountNo}-compact2.png`;
  return query ? `${base}?${query}` : base;
}

// ─── Internal: payload normalisation ────────────────────────────────────────

const extractAmount = (data) =>
  toPositiveInteger(
    pickFirstDefined(
      data?.amount,
      data?.money,
      data?.total_amount,
      data?.totalAmount,
      data?.value,
      data?.creditAmount,
      data?.credit_amount,
    ),
  );

const extractAccountNo = (data, fallbackAccountNo) =>
  String(
    pickFirstDefined(
      data?.account_no,
      data?.accountNo,
      data?.sotaikhoan,
      data?.stk,
      fallbackAccountNo,
    ) || '',
  );

const extractQrUrl = (data) =>
  pickFirstDefined(
    data?.qr_url,
    data?.qrUrl,
    data?.qr,
    data?.qr_code,
    data?.qrCode,
    data?.payment_qr,
    data?.paymentQr,
  );

const getBestTransactionCandidate = (payload, orderId) => {
  const list = [];

  if (Array.isArray(payload))              list.push(...payload);
  if (Array.isArray(payload?.data))        list.push(...payload.data);
  if (Array.isArray(payload?.transactions)) list.push(...payload.transactions);
  if (Array.isArray(payload?.result))      list.push(...payload.result);

  if (!list.length) {
    return null;
  }

  if (!orderId) {
    return list[0];
  }

  const normalizedOrderId = String(orderId).toLowerCase();
  const matched = list.find((item) => {
    const content = [
      item?.description,
      item?.content,
      item?.note,
      item?.memo,
      item?.addInfo,
      item?.transaction_content,
      item?.transactionContent,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return content.includes(normalizedOrderId);
  });

  return matched || list[0];
};

const normalizePaymentInfo = (payload, { orderId, amount, accountNo, transferContent }) => {
  const transaction = getBestTransactionCandidate(payload, orderId);
  const primary     = transaction || payload?.data || payload?.result || payload;

  const normalizedAmount    = extractAmount(primary) || extractAmount(payload) || toPositiveInteger(amount);
  const normalizedAccountNo = extractAccountNo(primary, accountNo);
  const qrFromApi           = extractQrUrl(primary) || extractQrUrl(payload?.data) || extractQrUrl(payload);

  return {
    qrUrl:     qrFromApi || buildVietQrUrl({ accountNo: normalizedAccountNo, amount: normalizedAmount, transferContent }),
    amount:    normalizedAmount,
    accountNo: normalizedAccountNo,
  };
};

// ─── Public: main entry point ────────────────────────────────────────────────

/**
 * Fetches payment / transaction information for the given account number by
 * proxying through the Supabase Edge Function `verify-payment`.  Credentials
 * for thueapibank.vn are stored exclusively as Supabase secrets (server-side)
 * and are never exposed to the browser.
 *
 * @param {string | Object} input  Either an orderId string or an options object
 *   { orderId, amount, accountNo, transferContent }.
 * @returns {Promise<{ qrUrl: string, amount: number|null, accountNo: string }>}
 */
export async function getPaymentInfo(input) {
  const options = typeof input === 'string' ? { orderId: input } : (input || {});
  const { orderId, amount, accountNo, transferContent } = options;

  const fallback = {
    qrUrl:     buildVietQrUrl({ accountNo, amount, transferContent }),
    amount:    toPositiveInteger(amount),
    accountNo: String(accountNo || ''),
  };

  if (!accountNo) {
    return fallback;
  }

  try {
    const response = await fetch(VERIFY_PAYMENT_URL, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        // The anon key authenticates the request to Supabase; the function
        // itself is configured with verify_jwt = false for simplicity, but
        // including the key is harmless and follows best practice.
        'apikey':        SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ accountNo }),
    });

    if (!response.ok) {
      console.warn(`[paymentApi] verify-payment returned ${response.status}`);
      return fallback;
    }

    const payload = await response.json();
    return normalizePaymentInfo(payload, { orderId, amount, accountNo, transferContent });
  } catch (error) {
    console.warn('[paymentApi] Failed to call verify-payment edge function:', error);
    return fallback;
  }
}
