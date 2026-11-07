# Page Override Spec — Arena, Roadmap & GPA (`design-system/pages/arena-roadmap-gpa.md`)

> **Kế thừa:** [`design-system/MASTER.md`](../MASTER.md) + Playbook [`.agents/skills/ui-ux-pro-max/references/web-dual-theme-vietnamese-ux.md`](../../.agents/skills/ui-ux-pro-max/references/web-dual-theme-vietnamese-ux.md).
> **Phạm vi áp dụng:** Đấu Trường Thi Đấu (`Arena`), Lộ Trình Khoa Bảng (`Roadmap`), Công cụ Tính Điểm / GPA (`GPACalculator`, `AdmissionCalculator`) & Tra cứu Trường (`SchoolFinder`) trên cả `VI` và `EN`.

---

## 1. Quy chuẩn Số liệu Thi đấu, Học thuật & Song Ngữ (`.tabular` Bắt buộc)

- **100% số liệu động và bảng điểm phải gắn lớp `.tabular` (`font-variant-numeric: tabular-nums`) và định dạng theo `locale` (`vi-VN` / `en-US`):**
  - Đồng hồ đếm giờ học / hiệp đấu (`mm:ss`) và tổng giờ học (`formatStudyTime(seconds, lang)` → `"12 giờ 30 phút"` / `"12h 30m"`).
  - Điểm GPA hệ 4.0 / hệ 10.0, số tín chỉ, điểm xét tuyển các kỳ thi (`THPT`, `HSA`, `V-ACT`, `TSA`, `SPT`, `H-SCA`, `BCA`, `V-SAT`, `HCMUT`).
  - Điểm EXP tích luỹ, chuỗi ngày học (`streak`), thứ hạng bảng vàng (`#01`, `#02`, `#03`) và danh hiệu quân hàm (`getRankDisplayName(tier, lang)`).
- **Hệ màu trạng thái học tập theo `MASTER.md`:**
  - **Chu sa (`bg-primary` / `text-on-primary`):** CTA chính, tab đang chọn, ấn triện cấp bậc (`RankSeal` / `.seal-stamp`). Cấm dùng `text-muted` cho chữ chú thích (luôn dùng `text-muted-foreground`).
  - **Vàng kim (`text-accent` / `border-gold`):** Huy hiệu quân hàm cao quý, đường viền nội tiếp đồng tâm `.imperial-frame`.
  - **Ngọc bích (`bg-jade` / `text-jade`):** Thanh tiến độ tích luỹ EXP và chặng lộ trình đang thực hiện.
  - **Hoàn thành (`text-completed`):** Chặng lộ trình đã vượt qua, nguyện vọng an toàn (luôn đi kèm icon + nhãn văn bản song ngữ).

## 2. Bố cục Đáp ứng Đa Thiết bị & Canh chỉnh Viền (`375px` → `1440px`)

- **Đấu Trường (`StudyArena`):**
  - Thanh tab xếp hạng, thẻ Podium Top 3 và danh sách sĩ tử giữ `min-w-0`, tên cắt gọn `truncate`, huy hiệu cấp bậc `whitespace-nowrap` để danh hiệu Tiếng Anh (`Grand Marshal`, `Prime Scholar`) không tràn khung trên màn hình `375px`.
  - Tuyệt đối không dùng emoji (`🔥`) làm biểu tượng hệ thống; sử dụng Material Symbol `local_fire_department` kèm `aria-hidden="true"`.
- **Lộ Trình (`Roadmap`), Tính GPA & Chọn Trường (`SchoolFinder`):**
  - Trên Desktop (`>= 1024px`): Lưới 2–3 cột cân xứng với viền `border-border` / `hover:border-border-strong`.
  - Trên Mobile (`375px`): Hàng bộ lọc phương thức / khu vực / mức độ an toàn bọc `flex flex-wrap gap-2`; bảng điểm nhiều cột chuyển sang thẻ gọn hoặc bọc `overflow-x-auto` mượt mà.
  - Bảo toàn tuyệt đối schema `admission_scores` (`v3`), mã môn (`'toan'`, `'ly'`, ...), mã kỳ thi (`'thpt'`, `'hocba'`, ...) và chế độ `'student' | 'university'` khi chuyển đổi `VI` ⇋ `EN`.

## 3. Tương tác `tram_sv` & Trợ năng Biểu tượng

- **Xoá bỏ triệt để `window.alert()` / `window.confirm()`:** Sử dụng Toast song ngữ và Modal xác nhận (`role="alertdialog"`).
- **Biểu tượng & Nút thao tác:** Mọi `.material-symbols-outlined` trang trí gắn `aria-hidden="true"`; mọi nút icon-only gắn `aria-label` theo ngôn ngữ đang chọn (`VI` / `EN`).
