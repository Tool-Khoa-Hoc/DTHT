# Page Override Spec — Auth & Google OAuth (`design-system/pages/auth.md`)

> **Kế thừa:** [`design-system/MASTER.md`](../MASTER.md) + Playbook [`.agents/skills/ui-ux-pro-max/references/oauth-google-auth-ux.md`](../../.agents/skills/ui-ux-pro-max/references/oauth-google-auth-ux.md).
> **Phạm vi áp dụng:** Trang Đăng nhập (`Login`), Đăng ký (`Register`), Quên/Đặt lại mật khẩu, và Màn hình đón kết quả `/auth/callback` (Supabase PKCE + `tram_sv`).

---

## 1. Bố cục & Thần thái Khoa Bảng

- **Desktop (`>= 1024px`):** Khung trung tâm cân xứng (`max-w-md` cho thẻ đơn hoặc `max-w-4xl` chia 2 cột: cột trái tôn vinh bảng vàng / châm ngôn khoa cử với hoạ tiết `.lattice-divider` và `.hanzi-watermark` `aria-hidden="true"`, cột phải là thẻ biểu mẫu `bg-surface border border-border rounded-2xl p-8 shadow-sm`).
- **Mobile (`375px`–`767px`):** Thu gọn thành 1 cột duy nhất (`px-4 py-6`), đưa biểu mẫu và nút **Tiếp tục với Google** lên ngay trong vùng nhìn đầu tiên (above the fold), kèm nút `ThemeToggle` góc trên bên phải.
- **Tiêu đề biểu mẫu:** Dùng font `Spectral` (`font-display text-2xl sm:text-3xl font-bold leading-snug text-foreground`) đảm bảo không cắt dấu tiếng Việt (`Đăng Nhập Khoa Trường`, `Ghi Danh Sĩ Tử`).

## 2. Quy chuẩn Nút Google Sign-In & Luồng PKCE

- **Vị trí ưu tiên:** Đặt nút **“Tiếp tục với Google”** ở vị trí nổi bật đầu thẻ xác thực, ngăn cách với biểu mẫu Email/Mật khẩu bằng thanh phân cách tinh tế: `── hoặc dùng tài khoản email ──`.
- **Chuẩn hiển thị Dual-Theme:**
  - Icon SVG **Google `G` 4 màu chuẩn** (`w-5 h-5 shrink-0`, `aria-hidden="true"`).
  - *Thư Phòng Sáng:* `bg-white text-[#1C1917] border border-[#D6CFC2] hover:bg-[#FAF7F0]`.
  - *Mặc Dạ Tối:* `dark:bg-[#1A1714] dark:text-[#F5EFE6] dark:border-[#4A4036] dark:hover:bg-[#2B2521]`.
  - Chiều cao `min-h-11` (`44px+`), `gap-3`, `font-sans font-semibold`, vòng nét tiêu điểm `focus-visible:ring-2 focus-visible:ring-primary`.
- **Tham số OAuth bắt buộc:**
  - Truyền `queryParams: { prompt: 'select_account' }` để luôn mở bảng chọn tài khoản Google.
  - Bảo toàn tham số điều hướng nội bộ an toàn `?next=/...` (chặn tuyệt đối Open Redirect `//...` hoặc domain ngoài).
- **Trạng thái `/auth/callback`:**
  - Đang trao đổi mã PKCE & đồng bộ hồ sơ `tram_sv`: Hiển thị thẻ `bg-surface` trang nhã với vòng xoay mảnh màu Chu sa (`border-primary`) và dòng chữ *“Đang xác thực ấn tín sĩ tử...”*.
  - Khi gặp lỗi hoặc người dùng bấm Huỷ: Hiển thị thông báo tiếng Việt thân thiện trong khối `role="alert"` kèm nút chính **“Thử đăng nhập lại với Google”** và liên kết **“Quay lại Đăng nhập”**.

## 3. Biểu mẫu Email/Mật khẩu & Kiểm định Trợ năng

- Mọi trường nhập có `<label htmlFor>` hiển thị rõ (`text-sm font-medium text-foreground`), hỗ trợ `autoComplete="email"`, `autoComplete="current-password"` / `"new-password"`, không chặn thao tác dán (`paste`).
- Nút mắt ẩn/hiện mật khẩu bắt buộc đặt `type="button"`, kích thước chạm tối thiểu `40×40px` (`p-2`), có `aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}` và `aria-pressed={showPassword}`.
- Báo lỗi xác thực hiển thị trực tiếp bằng khối banner nội tuyến (`role="alert"`) với viền Chu sa nhạt — **tuyệt đối không gọi `window.alert()`**.
