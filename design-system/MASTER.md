# DTHT Design System — "Trung Hoa Sáng" (MASTER)

> Nguồn sự thật về giao diện cho toàn bộ nền tảng **Đấu Trường Học Tập (DTHT)**.
> Được thiết kế theo phương pháp `ui-ux-pro-max` với định hướng **"Trung Hoa Sáng" (Imperial Scholar / Rice-Paper Light)**: trang nhã, sáng sủa, tôn vinh tinh thần khoa bảng ("Thư viện & Khoa trường"), đọc lâu không mỏi mắt.

## 1. Bản sắc & Triết lý thị giác

- **Tông sáng giấy gạo (Paper-First Light Mode):** Nền giấy tuyên/giấy gạo ấm (`#FAF7F0` / `#FDFBF6`), bề mặt thẻ trắng tinh (`#FFFFFF`) hoặc giấy ngà (`#F3EDE2`), mực tàu (`#1C1917`) rõ nét. Tuyệt đối không dùng dark mode hay nền đen/tím than.
- **Điểm nhấn Chu Sa & Vàng Kim:**
  - **Chu sa (Vermilion `#B91C1C`):** Dùng cho nút hành động chính (CTA), ấn triện (seal stamp), mục điều hướng đang chọn.
  - **Vàng kim (Imperial Gold `#B45309` / `#C9A227`):** Dùng cho bậc quân hàm, huy hiệu thành tích, đường kẻ mảnh trang trí và viền thẻ (`#E7E0D2`).
  - **Ngọc bích (Jade `#0F766E`):** Dùng cho thanh tiến độ học tập ("Đang tích EXP"), trạng thái hoàn thành (`#15803D`).
- **Hoạ tiết Á Đông tiết chế (Sang, không sến):**
  - Ấn triện đỏ (`RankSeal` / `.seal-stamp`) cho cấp bậc & quân hàm.
  - Đường phân cách song cửa / vân mây (`.lattice-divider`) và nét cọ gạch chân tiêu đề (`.brush-underline`).
  - Chữ Hán cổ phong (`.hanzi-watermark`, luôn gắn `aria-hidden="true"`) chỉ làm watermark trang trí mờ, không bao giờ thay thế nhãn tiếng Việt.
  - Không dùng gradient tím/hồng AI, không dùng neon, không dùng emoji làm icon.

## 2. Bảng màu Semantic (`src/index.css` `@theme`)

| Vai trò Semantic | Token CSS / Tailwind | Mã màu | Ứng dụng |
|---|---|---|---|
| Background | `bg-background` / `--color-background` | `#FAF7F0` | Nền trang chính (giấy gạo ấm) |
| Paper | `bg-paper` / `--color-paper` | `#FDFBF6` | Nền khu vực nổi nhẹ |
| Surface | `bg-surface` / `--color-surface` | `#FFFFFF` | Thẻ bài học, bảng điểm, modal |
| Surface Alt | `bg-surface-alt` / `--color-surface-alt` | `#F3EDE2` | Ô phụ, thanh tiến độ nền, chip mặc định |
| Ink / Foreground | `text-foreground` / `--color-foreground` | `#1C1917` | Chữ chính (mực tàu đậm, tương phản >15:1) |
| Secondary Text | `text-secondary-text` / `--color-secondary-text` | `#57534E` | Chữ mô tả phụ (tương phản >7:1) |
| Muted Text | `text-muted-foreground` / `--color-muted-foreground` | `#78716C` | Chú thích nhỏ, nhãn phụ (tương phản ≥4.6:1) |
| Primary (Chu sa) | `bg-primary` / `--color-primary` | `#B91C1C` | CTA chính, ấn triện, trạng thái active |
| Primary Hover | `bg-primary-hover` / `--color-primary-hover` | `#991B1B` | Hover của nút Chu sa |
| Accent (Vàng kim) | `text-accent` / `--color-accent` | `#B45309` | Nhãn vàng kim trên nền sáng |
| Gold | `border-gold` / `--color-gold` | `#C9A227` | Viền huy hiệu, khung ấn triện |
| Secondary (Ngọc bích) | `bg-jade` / `--color-jade` | `#0F766E` | Tiến độ EXP, trạng thái đang học |
| Completed | `text-completed` / `--color-completed` | `#15803D` | Hoàn thành bài/mục tiêu |
| Border | `border-border` / `--color-border` | `#E7E0D2` | Viền mảnh 1px ánh vàng giấy |

## 3. Typography (Tự host qua `@fontsource`, chuẩn dấu tiếng Việt)

- **Display / Heading (`--font-display`):** `Baloo 2` (weights 600, 700, 800, subset `vietnamese` + `latin`). Tạo cảm giác năng động, gamification nhưng vẫn tròn trịa, rõ dấu tiếng Việt.
- **Body / UI (`--font-sans`):** `Be Vietnam Pro` (weights 400, 500, 600, 700, subset `vietnamese` + `latin`). Tối ưu cho đọc tài liệu dài, bảng điểm chuẩn, công thức.
- **Số liệu (`.tabular`):** `font-variant-numeric: tabular-nums` bắt buộc cho điểm số, GPA, EXP, đồng hồ đếm giờ.

## 4. Hệ thống Component (`src/components/ui/`)

- `Button` (`ArenaButton`): `primary` (chu sa `#B91C1C`), `secondary` (giấy `#FFFFFF` + viền `#E7E0D2`), `gold` (vàng kim), `jade` (ngọc bích), `ghost`. Chiều cao tối thiểu `44px–48px`.
- `Card`: Nền giấy trắng `#FFFFFF`, viền `#E7E0D2` 1px, bo góc `14px–16px`, bóng đổ ấm mềm.
- `RankSeal`: Ấn triện vuông/bo nhẹ mô phỏng triện son khoa bảng cho cấp bậc & quân hàm.
- `SectionHeading`: Eyebrow + tiêu đề `Baloo 2` + gạch chân nét cọ + chữ Hán trang trí mờ (`aria-hidden="true"`).
- `Chip`: Huy hiệu trạng thái/môn học, luôn đi kèm icon hoặc ký hiệu chữ rõ ràng (không chỉ dựa vào màu sắc).
- `ProgressBar`: Duy nhất một nơi sử dụng `style={{ width: `${pct}%` }}` cho thanh tiến độ động, có đầy đủ thuộc tính ARIA `role="progressbar"`.
- `SubjectCard`, `TeacherCard`, `SessionBar`, `Skeleton`, `LazyHeavyComponent`, `OptimizedImage`, `ToastProvider`.
