# DTHT Design System — "Arena Bento" (MASTER)

> Nguồn sự thật về giao diện cho toàn web Đấu Trường Học Tập. Phương pháp theo
> `ui-ux-pro-max-skill` (nhóm Education / E-learning / LMS), hiệu chỉnh cho học sinh Việt Nam
> và cho **bản sắc sẵn có của DTHT** (xem mục 1 — quyết định chốt 22/10/2026).
> Khi làm 1 trang: đọc file này trước; trang nào có `design-system/pages/<page>.md` thì
> phần trong đó thắng MASTER ở đúng mục nó ghi.

## 1. Phong cách & bản sắc (ĐÃ CHỐT — không đổi sang light/indigo)

- **Bản sắc gốc giữ nguyên và tiến hoá, không thay mới:** "đấu trường về đêm" —
  nền **plum đen (ink)**, năng lượng **ember** (hồng thương hiệu), **gold** cho huy hiệu /
  thứ bậc / streak, **jade** cho tiến độ và trạng thái học tập, **violet** cho các bậc cao.
  Đây là thế giới hình ảnh học viên đã quen; mọi redesign phải trông như cùng một sản phẩm.
- **Dark mode là mặc định và là bản sắc chính** (`index.html` giữ `class="dark"`).
  **Light mode để phase sau** — khi làm phải kiểm contrast riêng từng cặp token,
  không suy từ dark. (Bản thảo cũ từng đề xuất light + indigo làm mặc định — đã huỷ.)
- **Indigo không phải màu primary của site.** Indigo/violet chỉ xuất hiện đúng hai chỗ:
  màu môn trong dữ liệu có sẵn (vd Vật Lí `#6366F1` trong `src/config/onlineLearning.js`)
  và accent cho rank bậc rất cao. **Primary toàn site = ember.**
- **Arena Bento áp ở CẤU TRÚC, không đổi bản sắc màu:** Bento Box Grid cho đầu trang /
  dashboard (các ô tile bo lớn, kích thước đa dạng, gap đều) + card bo 16–24px +
  soft-press khi bấm + Vibrant & Block-based ở năng lượng trình bày + Flat cho
  trang bài học / bảng dữ liệu (đọc lâu không mệt).

## 2. Màu (semantic roles → token thật trong `src/index.css` @theme)

Code dùng token Tailwind sẵn có (`ink/ember/gold/jade/violet`) và biến `--arena-*`;
**không hardcode hex trong component** (ngoại lệ duy nhất: màu môn lấy từ dữ liệu).

| Vai trò semantic | Token | Giá trị | Dùng cho |
|---|---|---|---|
| Background | `ink-950` | `#120A0D` | Nền trang |
| Surface / Card | `ink-900` / `ink-850` | `#190E12` / `#201216` | Nền thẻ, header, tile bento |
| Surface raised | `ink-800` / `ink-700` | `#2B1621` / `#3A1F2C` | Ô lồi, viền đậm, hover |
| **Primary (brand + CTA chính)** | `ember-500` (gradient 400→600) | `#E36488` | Nút "Vào học" / "Mở sheet", nav active, điểm nhấn thương hiệu |
| On primary | white | `#FFFFFF` | Chữ trên ember |
| **Progress / trạng thái học** | `jade-400` / `jade-500` | `#5FCFA6` / `#33B488` | Thanh tiến độ EXP, chip "Đang tích EXP", trạng thái đang học |
| **Reward** | `gold-400` / `gold-500` | `#F2C159` / `#DDA23A` | Huy chương, hạng 1, streak, lên cấp |
| Rank cao | `violet-400` / `violet-500` | `#A78BFA` / `#8B5CF6` | Cấp bậc rất cao (theo `levelHelper.getLevelAccent`) |
| Foreground | slate-100 | `#F1F5F9` | Chữ chính trên nền ink |
| Muted foreground | slate-400 | `#94A3B8` | Chữ phụ (đã kiểm contrast trên ink) |
| Border | white/10 hoặc `ink-700` | — | Viền thẻ / divider, phải nhìn thấy rõ |
| Destructive | red-400 | `#F87171` | Lỗi / nguy hiểm trên nền tối |

Màu theo môn (luôn kèm icon SVG + nhãn chữ, không dùng màu đơn độc) — lấy theo khai báo
sẵn trong `src/config/onlineLearning.js` để không lệch dữ liệu:
Toán `#0EA5E9` · Vật Lí `#6366F1` · Hoá học `#F59E0B` · Tiếng Anh `#7C3AED` ·
Sinh học `#10B981` · Ngữ Văn `#EC4899` · Lịch Sử `#B45309` · Địa Lí `#14B8A6` ·
ĐGNL `#EF4444` · ĐGTD `#F97316`.

Biến Arena Bento trong `src/index.css`: `--arena-ink`, `--arena-surface`, `--arena-line`,
`--arena-ember`, `--arena-gold`, `--arena-jade`, `--arena-radius`, `--arena-shadow-card`,
`--arena-font-display` + class `.arena-card`, `.arena-chip`, `.btn-arena` (và biến thể),
`.tabular`. Đây là lớp **bổ sung** — token cũ (`ink/ember/gold/jade`, `.font-arena`,
`.arena-sweep`, `.rank-seal`) giữ nguyên cho các trang chưa redesign.

## 3. Typography

- **Display (hero, tiêu đề lớn, số EXP/hạng): Baloo 2** 600–800 — class `.font-arena-display`
  (biến `--arena-font-display`). Có subset vietnamese. Chỉ dùng cho điểm nhấn, không dùng cho đoạn văn dài.
- **Heading/UI đậm kiểu đấu trường:** `--font-arena` hiện tại = **Be Vietnam Pro** 600–800 (class `.font-arena`) — giữ nguyên.
- **Body/UI:** Be Vietnam Pro 400/500/600/700 (tải qua Google Fonts cùng Baloo 2, `display=swap`).
  Body thực tế của app vẫn chạy font sans hệ thống hiện hữu ở các trang chưa redesign.
- ⛔ Không dùng Comic Neue, Fredoka, Poppins cho nội dung tiếng Việt (không có subset vietnamese → gãy dấu).
- Type scale: 12 / 14 / 16 / 18 / 24 / 32, hero 40–48. Body mobile ≥ 16px, line-height 1.5–1.75.
- Số liệu (EXP, điểm, thời gian phiên học, hạng): class `.tabular` (`tabular-nums`), format locale `vi-VN`.

## 4. Spacing / Radius / Shadow

- Spacing: 4 / 8 / 16 / 24 / 32 / 48 / 64 px.
- Radius: card bento 16–24px (`--arena-radius: 20px`), nút 12–14, chip 999, modal 16.
- Shadow trên nền tối: card = bóng đen sâu + viền sáng mảnh trên cùng (inset highlight),
  xem `--arena-shadow-card`. Clay-lite double shadow bản sáng **không** áp nguyên xi lên dark —
  bản dark dùng outer shadow đậm + inset highlight thay cho inner shadow trắng.
- Soft-press: nút/card bấm được `active: scale(.98)`, transition 200ms; hover (desktop) nhấc `translateY(-2px)` tối đa.

## 5. Component chuẩn (`src/components/ui/`)

- `ArenaButton` (`.btn-arena`): min-height 48px (biến thể sm vẫn ≥ 44px), radius 12–14,
  font display, weight 700, soft-press. Biến thể: `primary` (ember — CTA chính, mỗi màn hình 1),
  `jade` (hành động học tập/đang xem), `gold` (phần thưởng/tiếp tục), `ghost` (phụ, viền white/12).
- `SubjectCard`: ô bento chọn môn — icon SVG trong ô màu môn, tên môn (Baloo 2), số sheet GV,
  trạng thái active tô màu môn + chữ trắng, `aria-pressed`.
- `TeacherCard`: avatar seal số thứ tự màu môn · tên GV **wrap tối đa 2 dòng, không truncate cụt** ·
  chip môn + chip "Sheet riêng" · chi tiết khoá (1 dòng) · **1 CTA chính duy nhất** ("Vào học" /
  "Đang xem — tiếp tục học" khi active, ≥ 48px). Trạng thái đang chọn phải rõ bằng viền + nhãn chữ, không chỉ màu.
- `ProgressBar`: fill animate width 200–300ms, luôn kèm số % dạng chữ, `role="progressbar"`.
- `SessionBar`: thanh phiên học dính phía trên khu vực học — trạng thái bằng chữ + icon SVG
  ("Đang tích EXP" / "Tạm dừng — cần xác nhận" / "Chế độ dự phòng"), đồng hồ phiên `.tabular`,
  nút "Kết thúc phiên" và "Tiếp tục học" (chỉ khi cần xác nhận). Mọi nút ≥ 44px.
- Chip lọc: `.arena-chip`, wrap được; trạng thái selected rõ (không chỉ đổi màu).
- Toast +EXP / lên cấp: tự tắt 3–5s, `aria-live="polite"` (giữ cơ chế flash sẵn có của trang).

## 6. Layout từng trang (tóm tắt)

- **Trang chủ**: header dính → hero bento (chào + level + thanh EXP; streak; hạng; CTA "Học tiếp")
  → Học tiếp → Lưới môn học → Podium Top 3 + BXH rút gọn → GV tiêu biểu → Footer. (Phase sau.)
- **Trang Học online (đã redesign đợt 4)**: đầu trang dạng **bento** — tile chính (tiêu đề +
  tổng số GV = `ONLINE_TEACHER_COUNT` + CTA mở sheet/làm mới), tile Cấp độ + ProgressBar EXP,
  tile thống kê (tổng thời gian học · streak · trạng thái tích) → lưới chọn môn bằng `SubjectCard`
  → danh sách GV bằng `TeacherCard` → khu vực Sheet nhúng (giữ nguyên iframe) với
  `SessionBar` dính ngay phía trên khi đang xem 1 GV.
- **Môn học**: breadcrumb ≥3 cấp · tìm kiếm · chip lọc · grid card môn.
- **Bảng xếp hạng**: podium Top 3 + bảng phẳng hạng 4+; hàng của mình có viền + nhãn "Bạn".

## 7. Animation & gamification

- Chỉ animate `transform` / `opacity`. Tối đa 1–2 chuyển động chính/view. Exit nhanh hơn enter (~60–70%).
- Hiệu ứng ăn mừng (lên cấp, mở huy hiệu, streak) phải interruptible; tôn trọng `prefers-reduced-motion`.
- Không dùng emoji làm icon cấu trúc — icon SVG inline, stroke 1.5–2px, nhất quán.
- Animation không bao giờ quyết định đúng/sai của state (điểm số phải đúng kể cả khi animation bị huỷ giữa chừng).

## 8. Pre-delivery checklist (chạy trước mỗi PR UI)

- [ ] Tương phản chữ ≥ 4.5:1 trên nền ink (text lớn/UI ≥ 3:1), kiểm cả hover/disabled
- [ ] Touch target ≥ 44×44px, cách nhau ≥ 8px; `cursor-pointer` cho phần tử click được
- [ ] Không hành động chính nào phụ thuộc hover (mobile dùng được 100%)
- [ ] Focus ring visible 2–4px; icon-only button có `aria-label`
- [ ] Responsive 375 / 768 / 1024 / 1440, không cuộn ngang; `min-h-dvh` thay `100vh`
- [ ] CLS < 0.1 (ảnh khai width/height hoặc aspect-ratio, lazy-load dưới fold)
- [ ] Số liệu dùng `.tabular` + format vi-VN
- [ ] Không emoji làm icon; không hardcode hex ngoài token/màu môn đã khai
