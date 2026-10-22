// Định dạng hiển thị dùng chung cho phần tính điểm/tìm trường.
export function fmt(n, digits = 2) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('vi-VN', {
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
