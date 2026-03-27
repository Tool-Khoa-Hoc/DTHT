const API_TEMPLATE_URL = 'https://thueapibank.vn/historyapivcbv3/password/sotaikhoan/token';
const DEFAULT_API_TOKEN = 'd5259d1f01433a8068f98b935d2b48aa';
const DEFAULT_API_PASSWORD = 'password';
const VCB_BANK_CODE = 'vietcombank';

const toPositiveInteger = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.round(parsed);
};

const pickFirstDefined = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');

const getApiToken = () => import.meta.env.VITE_PAYMENT_API_TOKEN || DEFAULT_API_TOKEN;
const getApiPassword = () => import.meta.env.VITE_PAYMENT_API_PASSWORD || DEFAULT_API_PASSWORD;
const getApiTemplateUrl = () => import.meta.env.VITE_PAYMENT_API_URL || API_TEMPLATE_URL;

const resolveApiUrl = (accountNo) => {
  const password = getApiPassword();
  const token = getApiToken();

  return getApiTemplateUrl()
    .replace(/\/password(?=\/|$)/i, `/${encodeURIComponent(password)}`)
    .replace(/\/sotaikhoan(?=\/|$)/i, `/${encodeURIComponent(accountNo)}`)
    .replace(/\/token(?=\/|$)/i, `/${encodeURIComponent(token)}`);
};

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
  const base = `https://img.vietqr.io/image/${VCB_BANK_CODE}-${accountNo}-compact2.png`;
  return query ? `${base}?${query}` : base;
}

const extractAmount = (data) => toPositiveInteger(
  pickFirstDefined(
    data?.amount,
    data?.money,
    data?.total_amount,
    data?.totalAmount,
    data?.value,
    data?.creditAmount,
    data?.credit_amount
  )
);

const extractAccountNo = (data, fallbackAccountNo) => String(
  pickFirstDefined(
    data?.account_no,
    data?.accountNo,
    data?.sotaikhoan,
    data?.stk,
    fallbackAccountNo
  ) || ''
);

const extractQrUrl = (data) => pickFirstDefined(
  data?.qr_url,
  data?.qrUrl,
  data?.qr,
  data?.qr_code,
  data?.qrCode,
  data?.payment_qr,
  data?.paymentQr
);

const getBestTransactionCandidate = (payload, orderId) => {
  const list = [];

  if (Array.isArray(payload)) list.push(...payload);
  if (Array.isArray(payload?.data)) list.push(...payload.data);
  if (Array.isArray(payload?.transactions)) list.push(...payload.transactions);
  if (Array.isArray(payload?.result)) list.push(...payload.result);

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
      item?.transactionContent
    ].filter(Boolean).join(' ').toLowerCase();

    return content.includes(normalizedOrderId);
  });

  return matched || list[0];
};

const normalizePaymentInfo = (payload, { orderId, amount, accountNo, transferContent }) => {
  const transaction = getBestTransactionCandidate(payload, orderId);
  const primary = transaction || payload?.data || payload?.result || payload;

  const normalizedAmount = extractAmount(primary) || extractAmount(payload) || toPositiveInteger(amount);
  const normalizedAccountNo = extractAccountNo(primary, accountNo);
  const qrFromApi = extractQrUrl(primary) || extractQrUrl(payload?.data) || extractQrUrl(payload);

  return {
    qrUrl: qrFromApi || buildVietQrUrl({ accountNo: normalizedAccountNo, amount: normalizedAmount, transferContent }),
    amount: normalizedAmount,
    accountNo: normalizedAccountNo,
  };
};

const buildRequestOptions = (orderId) => {
  const token = getApiToken();
  const payload = JSON.stringify({ order_id: orderId, token });

  return [
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
    },
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: payload,
    },
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ order_id: orderId }),
    },
  ];
};

export async function getPaymentInfo(input) {
  const options = typeof input === 'string' ? { orderId: input } : (input || {});
  const { orderId, amount, accountNo, transferContent } = options;

  const fallback = {
    qrUrl: buildVietQrUrl({ accountNo, amount, transferContent }),
    amount: toPositiveInteger(amount),
    accountNo: String(accountNo || ''),
  };

  if (!accountNo) {
    return fallback;
  }

  const apiUrl = resolveApiUrl(accountNo);
  const requestOptionsList = buildRequestOptions(orderId);

  for (const requestOptions of requestOptionsList) {
    try {
      const response = await fetch(apiUrl, requestOptions);
      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      return normalizePaymentInfo(payload, { orderId, amount, accountNo, transferContent });
    } catch (error) {
      // Continue to next strategy if this one fails (method/CORS/shape mismatch).
      continue;
    }
  }

  return fallback;
}
