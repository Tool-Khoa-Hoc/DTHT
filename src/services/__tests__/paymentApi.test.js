// src/services/__tests__/paymentApi.test.js
import { buildVietQrUrl, getPaymentInfo } from '../../services/paymentApi';

// Mock fetch globally
global.fetch = jest.fn();

describe('getPaymentInfo', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  it('should return payment info on successful response', async () => {
    const mockResponse = {
      qr_url: 'https://example.com/qr.png',
      amount: 39000,
      account_no: '9356026163',
    };
    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await getPaymentInfo({
      orderId: 'order123',
      amount: 39000,
      accountNo: '9356026163',
      transferContent: 'Mo khoa tai lieu hoc',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://thueapibank.vn/historyapivcbv3/password/9356026163/d5259d1f01433a8068f98b935d2b48aa',
      expect.objectContaining({
        method: 'GET',
      })
    );
    expect(result).toEqual({
      qrUrl: mockResponse.qr_url,
      amount: mockResponse.amount,
      accountNo: mockResponse.account_no,
    });
  });

  it('should return fallback QR on fetch error', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500 });
    const result = await getPaymentInfo({
      orderId: 'order123',
      amount: 39000,
      accountNo: '9356026163',
      transferContent: 'Mo khoa tai lieu hoc',
    });

    expect(result).toEqual({
      qrUrl: buildVietQrUrl({
        accountNo: '9356026163',
        amount: 39000,
        transferContent: 'Mo khoa tai lieu hoc',
      }),
      amount: 39000,
      accountNo: '9356026163',
    });
  });
});
