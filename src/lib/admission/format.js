// Định dạng hiển thị dùng chung cho phần tính điểm/tìm trường.
export function fmt(n, digits = 2, locale = 'vi-VN') {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const resolvedLocale = locale === 'en' ? 'en-US' : locale === 'vi' ? 'vi-VN' : locale;
  return Number(n).toLocaleString(resolvedLocale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

// Số chữ số thập phân theo thang: thang 1200/450 hiển thị 0 số lẻ cho điểm
// nguyên của thí sinh; thang 30/100/150 hiển thị 2 số lẻ.
export function digitsForScale(scale) {
  if (scale === 1200 || scale === 450) return 0;
  return 2;
}
