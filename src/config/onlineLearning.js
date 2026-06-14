// Cấu hình tab "Học online" — nhúng Google Sheet COMBO HS12 2027.
// Khi sheet thêm/đổi tab, cập nhật danh sách ONLINE_SHEET_TABS bên dưới.
export const ONLINE_SHEET_ID = '13KsuJCOh2oxz7Olv6shcs1rAsZlZZio_DuCqibdYYos';

export const ONLINE_SHEET_TITLE =
  'COMBO HS12 2027 2k9 — Lộ Trình Xuất Phát Sớm';

export const ONLINE_SHEET_TABS = [
  { gid: '1914158245', title: 'HS12 XPS 2K9' },
  { gid: '901945532', title: 'BONUS HS12 2K8' },
  { gid: '1052649703', title: 'Ebook' },
  { gid: '325181356', title: 'ĐÔI LỜI NHẮN NHỦ' },
  { gid: '1217873399', title: 'HƯỚNG DẪN HỌC TRÊN DRIVE' },
];

// Khung view nhúng trong web (read-only). Sheet để PRIVATE → Google tự enforce:
// chỉ tài khoản Google đã được chia sẻ trên sheet mới xem được nội dung.
// Lưu ý: phải có thêm fragment "#gid=" thì Google Sheets mới mở đúng tab khi nhúng;
// chỉ "?gid=" đôi khi vẫn rơi về tab đầu tiên.
export const embedUrl = (gid) =>
  `https://docs.google.com/spreadsheets/d/${ONLINE_SHEET_ID}/preview?gid=${gid}&widget=true&headers=false#gid=${gid}`;

// Fallback first-party (ổn định trên điện thoại): mở thẳng Google Sheets ở tab mới.
export const openUrl = (gid) =>
  `https://docs.google.com/spreadsheets/d/${ONLINE_SHEET_ID}/edit?gid=${gid}#gid=${gid}`;
