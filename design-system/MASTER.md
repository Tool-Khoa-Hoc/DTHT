# DTHT Design System — "Trung Hoa Cổ Phong & Khoa Bảng" (MASTER)

> Nguồn sự thật về giao diện cho toàn bộ nền tảng **Đấu Trường Học Tập (DTHT)**.
> Được tinh chỉnh theo chuẩn `ui-ux-pro-max` với hệ thống **Dual-Theme Á Đông**:
> - **Thư Phòng Sáng (Rice-Paper Light):** Trang nhã, sáng sủa, tôn vinh tinh thần khoa trường giấy tuyên, đọc ban ngày êm mắt.
> - **Mặc Dạ Tối (Dark Inkstone & Sandalwood Dark):** Nghiên mực Đoan Khê & gỗ Tử Đàn, chữ Bạch Ngọc ánh trăng, bảo vệ thị lực học sinh khi thức khuya luyện thi THPTQG.

## 1. Bản sắc & Triết lý thị giác

- **Hệ Dual-Theme Cân Bằng Á Đông:**
  - **Chế độ Sáng (Thư Phòng Sáng):** Nền giấy tuyên ấm (`#FAF7F0` / `#FDFBF6`), bề mặt thẻ trắng tinh (`#FFFFFF`) hoặc giấy ngà (`#F3EDE2`), mực tàu (`#1C1917`) sắc nét.
  - **Chế độ Tối (Mặc Dạ Tối):** Nền nghiên mực đen trầm ấm (`#12100E`), bề mặt gỗ tử đàn (`#1A1714` / `#221E1A`), chữ bạch ngọc ngà (`#F5EFE6`), mực nhạt (`#BDB4A5`). Tuyệt đối không dùng nền đen OLED chói hay xanh tím than ngoại lai.
- **Điểm nhấn Chu Sa & Vàng Kim:**
  - **Chu sa (Vermilion `#B91C1C` sáng / `#DC2626` tối):** Dùng cho nút hành động chính (CTA), ấn triện (seal stamp), mục điều hướng đang chọn.
  - **Vàng kim (Imperial Gold `#B45309` sáng / `#E5B842` tối):** Bậc quân hàm, huy hiệu thành tích, đường chỉ viền thếp vàng hoàng cung.
  - **Ngọc bích (Jade `#0F766E` sáng / `#14B8A6` tối):** Thanh tiến độ học tập ("Đang tích EXP"), trạng thái hoàn thành.
- **Hoạ tiết Á Đông tiết chế (Sang, không sến):**
  - Ấn triện đỏ (`RankSeal` / `.seal-stamp`) cho cấp bậc & quân hàm.
  - Đường phân cách song cửa / vân mây (`.lattice-divider`) và nét cọ gạch chân tiêu đề (`.brush-underline`).
  - Chữ Hán cổ phong (`.hanzi-watermark`, luôn gắn `aria-hidden="true"`) chỉ làm watermark trang trí mờ.
  - Không dùng gradient neon, không dùng emoji làm icon hệ thống.

## 2. Bảng màu Semantic (`src/index.css` `@theme` & `html.dark`)

| Vai trò Semantic | Token CSS / Tailwind | Sáng (Thư Phòng) | Tối (Mặc Dạ) | Ứng dụng |
|---|---|---|---|---|
| Background | `bg-background` / `--color-background` | `#FAF7F0` | `#12100E` | Nền trang chính |
| Paper | `bg-paper` / `--color-paper` | `#FDFBF6` | `#1A1714` | Sidebar, nền cụm nổi |
| Surface | `bg-surface` / `--color-surface` | `#FFFFFF` | `#221E1A` | Thẻ bài học, bảng điểm, modal |
| Surface Alt | `bg-surface-alt` / `--color-surface-alt` | `#F3EDE2` | `#2B2521` | Ô phụ, thanh tiến độ nền, chip mặc định |
| Foreground | `text-foreground` / `--color-foreground` | `#1C1917` | `#F5EFE6` | Chữ chính (WCAG AAA tương phản cao) |
| Secondary Text | `text-secondary-text` / `--color-secondary-text` | `#57534E` | `#BDB4A5` | Chữ mô tả phụ (tương phản >7:1) |
| Muted Text | `text-muted-foreground` / `--color-muted-foreground` | `#78716C` | `#8C8275` | Chú thích nhỏ, nhãn phụ |
| Primary (Chu sa) | `bg-primary` / `--color-primary` | `#B91C1C` | `#DC2626` | CTA chính, ấn triện, active nav |
| Primary Hover | `bg-primary-hover` / `--color-primary-hover` | `#991B1B` | `#EF4444` | Hover của nút Chu sa |
| Accent (Vàng kim) | `text-accent` / `--color-accent` | `#B45309` | `#E5B842` | Nhãn vàng kim, viền nổi bật |
| Gold | `border-gold` / `--color-gold` | `#C9A227` | `#E5B842` | Viền huy hiệu, khung ấn triện |
| Jade (Ngọc bích) | `bg-jade` / `--color-jade` | `#0F766E` | `#14B8A6` | Tiến độ EXP, trạng thái đang học |
| Completed | `text-completed` / `--color-completed` | `#15803D` | `#22C55E` | Hoàn thành bài/mục tiêu |
| Border | `border-border` / `--color-border` | `#E7E0D2` | `#332B24` | Viền mảnh 1px thanh nhã |

## 3. Typography (Tự host qua `@fontsource`, đồng nhất & chuẩn dấu tiếng Việt)

- **Display / Heading (`--font-display`, `--font-arena`):** `Spectral` (weights 500, 600, 700, 800, subset `vietnamese` + `latin`). Font chữ serif kinh viện, sắc sảo, truyền tải thần thái khoa trường và tinh thần học thuật cao quý. Thay thế hoàn toàn phông Baloo 2 hoạt hình trẻ con.
- **Body / UI Controls (`--font-sans`):** `Be Vietnam Pro` (weights 400, 500, 600, 700, subset `vietnamese` + `latin`). Tối ưu tuyệt đối cho đọc văn bản dài, công thức, thẻ bài, bảng điểm và hệ thống nút bấm hành động.
- **Hán tự cổ phong (`--font-han`):** `Noto Serif SC`, `Songti SC`, `SimSun`, serif.
- **Số liệu (`.tabular`):** `font-variant-numeric: tabular-nums` bắt buộc cho điểm số, GPA, EXP, đồng hồ đếm giờ.

## 4. Hệ thống Chuyển Đổi Giao Diện (`ThemeToggle`)

- Tích hợp `ThemeProvider` + hook `useTheme()` lưu trạng thái vào `localStorage('dtht_theme')`.
- Tự động nhận diện thiết lập hệ điều hành (`prefers-color-scheme`).
- Chống FOUC (Flash of Unstyled Content) qua critical inline script trong `<head>`.
- Nút chuyển theme linh hoạt:
  - **Desktop:** Đặt tại chân thanh điều hướng bên trái (Sidebar).
  - **Mobile:** Nút biểu tượng tinh gọn tại Header trên cùng & hàng tuỳ chọn trong Drawer Menu.

## 5. Chuẩn Xác Thực & Google OAuth (`Auth & Google Sign-In UX`)

- **Nút Google Sign-In chuẩn nhận diện chính hãng:**
  - Sử dụng biểu tượng vector **Google `G` 4 màu chính thức** (`#4285F4`, `#34A853`, `#FBBC05`, `#EA4335`) kích thước `20×20px` (`w-5 h-5 shrink-0`, gắn `aria-hidden="true"`). Tuyệt đối không tô đơn sắc, không dùng chữ `"G"` thường hoặc emoji.
  - **Tương phản cao trên cả hai chế độ:**
    - *Thư Phòng Sáng:* Nền trắng tinh (`#FFFFFF`), viền `#D6CFC2` (`border-border`), chữ `#1C1917`, hover `#F8F5EE`.
    - *Mặc Dạ Tối:* Nền nổi phân tách rõ khỏi thẻ (`#1A1714` hoặc `#2B2521`), viền `#4A4036`, chữ Bạch Ngọc (`#F5EFE6`), hover `#332B24`.
  - Chiều cao tối thiểu `44px` (`min-h-11` / `h-12`), nhãn tiếng Việt chuẩn mực: **“Tiếp tục với Google”** hoặc **“Đăng nhập bằng Google”**.
- **Trải nghiệm chọn tài khoản & Luồng PKCE Callback:**
  - Luôn truyền `queryParams: { prompt: 'select_account' }` khi gọi `supabase.auth.signInWithOAuth` để học sinh dùng máy tính phòng tin học / thư viện luôn chọn đúng tài khoản cá nhân.
  - Khoá nút bấm (`disabled`, `aria-busy="true"`, hiển thị trạng thái *“Đang kết nối Google...”*) ngay khi kích hoạt để chống nhấp đúp làm lệch mã PKCE verifier.
  - Màn hình `/auth/callback` hiển thị thẻ chờ trang nhã (*“Đang xác thực ấn tín khoa trường...”*); nếu người dùng huỷ (`access_denied`), hết hạn mã code hoặc lỗi mạng, hiển thị thông báo tiếng Việt rõ ràng kèm nút **“Thử đăng nhập lại với Google”** và lối quay về Đăng nhập Email — tuyệt đối không để màn hình trắng.
- **Bảo toàn đường dẫn đích (`next` Redirect) & Trợ năng biểu mẫu (WCAG 2.2 AA — 3.3.8):**
  - Lưu giữ và kiểm duyệt đường dẫn nội bộ an toàn (`next.startsWith('/') && !next.startsWith('//')`) để đưa sĩ tử về đúng trang Đấu Trường / Lộ Trình sau khi đăng nhập.
  - Mọi ô nhập có `<label htmlFor>` tường minh, hỗ trợ đầy đủ `autoComplete` (`email`, `current-password`, `new-password`) và dán mật khẩu (`paste`), nút ẩn/hiện mật khẩu có `type="button"` và `aria-label`, báo lỗi inline qua `role="alert"` thay vì `window.alert()`.

## 6. Chuẩn Trạng Thái Dữ Liệu Supabase `tram_sv` (Data State & Feedback UX)

Mọi truy vấn và thao tác ghi dữ liệu trên schema Supabase **`tram_sv`** (hồ sơ sĩ tử, lộ trình, điểm GPA, ghi chú, bảng xếp hạng, quản trị) bắt buộc tuân thủ 4 trạng thái chuẩn:

1. **Skeleton Loading đồng bộ bố cục (Chống giật trang CLS):**
   - Hiển thị khung xương `bg-surface-alt animate-pulse` khớp đúng kích thước thẻ bài học, hàng bảng điểm hoặc danh sách ghi chú trong lúc chờ `tram_sv` phản hồi; tôn trọng `prefers-reduced-motion`.
2. **Empty State mang tinh thần Khoa Bảng & có CTA dẫn dắt:**
   - Khi bảng/danh sách rỗng (chưa có ghi chú, chưa có môn học tính GPA, chưa có nhiệm vụ lộ trình), hiển thị thẻ `bg-surface border-dashed border-border` với lời dẫn khích lệ ngắn gọn và nút hành động chính (`bg-primary`) giúp sĩ tử khởi tạo dữ liệu đầu tiên.
3. **Phản hồi Toast & Hộp thoại Xác nhận (Cấm tuyệt đối Blocking Dialogs):**
   - **Cấm dùng `window.alert()`, `window.confirm()`, `window.prompt()`** trong toàn bộ giao diện React.
   - Thao tác lưu/cập nhật thành công hoặc lỗi API dùng **Toast không chặn luồng** (`role="status"` / `aria-live="polite"`, tự đóng sau 3.5–5 giây, có nút đóng thủ công).
   - Thao tác xoá dữ liệu hoặc cấp/thu hồi quyền trên `tram_sv` bắt buộc dùng **Modal Xác Nhận** (`role="alertdialog"`, `aria-modal="true"`, bẫy tiêu điểm bàn phím, đóng bằng phím `Escape`, nút huỷ rõ ràng đứng cạnh nút hành động Chu sa).
4. **Xử lý Mất mạng & Giới hạn quyền RLS (`Offline / RLS Graceful Fallback`):**
   - Khi người dùng chưa đăng nhập hoặc không đủ quyền RLS (`Admin` / `CTV` / `Thống Soái`), ẩn hoặc vô hiệu hoá nút ghi dữ liệu kèm chú thích quyền hạn lịch sự ngay trên giao diện, không để người dùng bấm rồi nhận lỗi thô từ cơ sở dữ liệu.
   - Khi mất kết nối mạng hoặc truy vấn `tram_sv` lỗi, giữ nguyên dữ liệu đã nhập trong form (không làm mất bài viết/ghi chú đang gõ) và cung cấp nút **“Thử tải lại”** ngay tại khối bị lỗi.

## 7. Hồ sơ Ghi đè Theo Trang (`design-system/pages/`) & Kiểm định Tự động

Khi xây dựng hoặc nâng cấp từng phân khu, đọc `MASTER.md` kết hợp file đặc tả tương ứng trong `design-system/pages/` và kiểm tra bằng công cụ tĩnh trước khi bàn giao:

- [`design-system/pages/auth.md`](pages/auth.md) — Đăng nhập, Đăng ký, Khôi phục mật khẩu & Google OAuth PKCE Callback.
- [`design-system/pages/arena-roadmap-gpa.md`](pages/arena-roadmap-gpa.md) — Đấu Trường, Lộ Trình Khoa Bảng & Công cụ Tính điểm / GPA.
- [`design-system/pages/library-admin.md`](pages/library-admin.md) — Tàng Kinh Các, Ghi Chú, Học Trực Tuyến & Quản Trị (`Admin` / `CTV`).
- **Lệnh kiểm định bắt buộc (Argon 4 + DeepSeek V4.1 Flash Gate):**
  ```bash
  python .agents/skills/ui-ux-pro-max/scripts/audit_ui_ux.py src --strict
  ```
