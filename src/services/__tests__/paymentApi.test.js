import { buildVietQrUrl } from '../../services/paymentApi';

describe('buildVietQrUrl', () => {
  it('builds a VietQR URL with amount and transfer content', () => {
    expect(buildVietQrUrl({
      accountNo: '0123456789',
      amount: 39000,
      transferContent: 'Mo khoa tai lieu hoc',
    })).toBe(
      'https://img.vietqr.io/image/vietcombank-0123456789-compact2.png?amount=39000&addInfo=Mo+khoa+tai+lieu+hoc',
    );
  });

  it('returns an empty string when account number is missing', () => {
    expect(buildVietQrUrl({
      accountNo: '',
      amount: 39000,
      transferContent: 'Mo khoa tai lieu hoc',
    })).toBe('');
  });
});
