# Page Override Spec — Arena, Roadmap & GPA (`design-system/pages/arena-roadmap-gpa.md`)

> **Kế thừa:** [`design-system/MASTER.md`](../MASTER.md) + Playbook [`.agents/skills/ui-ux-pro-max/references/web-dual-theme-vietnamese-ux.md`](../../.agents/skills/ui-ux-pro-max/references/web-dual-theme-vietnamese-ux.md).
> **Phạm vi áp dụng:** Đấu Trường Thi Đấu (`Arena`), Lộ Trình Khoa Bảng (`Roadmap`), Bảng Xếp Hạng & Công cụ Tính Điểm / GPA (`GPA Calculator`).

---

## 1. Quy chuẩn Số liệu Thi đấu & Học thuật (`.tabular` Bắt buộc)

- **100% số liệu động và bảng điểm phải gắn lớp `.tabular` (`font-variant-numeric: tabular-nums`):**
  - Đồng hồ đếm ngược thời gian làm bài / hiệp đấu (`mm:ss`) — không để chữ số nhảy ngang gây xao nhãng sĩ tử.
  - Điểm GPA hệ 4.0 / hệ 10.0, số tín chỉ, điểm mục tiêu kỳ thi THPTQG.
  - Điểm EXP tích luỹ, chuỗi ngày học (`streak`), thứ hạng bảng vàng (`#01`, `#02`, `#03`) và tỷ lệ hoàn thành lộ trình (`%`).
- **Hệ màu trạng thái học tập theo `MASTER.md`:**
  - **Chu sa (`bg-primary` / `text-primary`):** Nút *“Vào Đấu Trường”*, *“Nộp Bài”*, ấn triện cấp bậc (`RankSeal` / `.seal-stamp`).
  - **Vàng kim (`text-accent` / `border-gold`):** Huy hiệu Tam Khôi (Trạng Nguyên, Bảng Nhãn, Thám Hoa), viền thẻ danh hiệu cao quý.
  - **Ngọc bích (`bg-jade` / `text-jade`):** Thanh tiến độ tích luỹ EXP và chặng lộ trình đang thực hiện.
  - **Hoàn thành (`text-completed`):** Chặng lộ trình đã vượt qua, câu trả lời chính xác (luôn đi kèm biểu tượng dấu kiểm + nhãn văn bản, không chỉ phân biệt bằng màu sắc).

## 2. Bố cục Đáp ứng Đa Thiết bị (`375px` → `1440px`)

- **Đấu Trường (`Arena`):**
  - Thanh trạng thái trận đấu (thời gian còn lại, tiến độ câu hỏi `12/40`) ghim gọn ở đầu vùng nội dung (`sticky top-0 z-10 bg-paper/95 backdrop-blur-xs border-b border-border`), không che khuất tiêu điểm bàn phím khi cuộn.
  - Các phương án lựa chọn (`A`, `B`, `C`, `D`) là thẻ `<button type="button">` toàn chiều rộng, chiều cao chạm `>= 48px`, trạng thái đang chọn thể hiện rõ bằng viền + nền phụ trong cả Sáng lẫn Tối mà không làm xê dịch kích thước khung.
- **Lộ Trình (`Roadmap`) & Tính GPA:**
  - Trên Desktop (`>= 1024px`): Lưới 2–3 cột hoặc bố cục danh sách chặng bên trái + bảng tổng kết tiến độ ghim bên phải.
  - Trên Mobile (`375px`): Chuyển bảng nhập điểm/môn học nhiều cột thành danh sách thẻ gọn theo từng môn hoặc bọc trong vùng `overflow-x-auto` có chỉ dấu cuộn mượt, đảm bảo toàn trang không tràn ngang.

## 3. Tương tác `tram_sv` & Trợ năng Biểu tượng

- **Xoá bỏ triệt để `window.alert()` / `window.confirm()`:**
  - Khi thêm/xoá nhiệm vụ lộ trình hoặc thông báo phân quyền (*“Chỉ Admin hoặc Cộng tác viên mới được thêm nhiệm vụ”*), hiển thị **Toast thông báo** hoặc ẩn nút thêm đối với tài khoản thường; xác nhận xoá nhiệm vụ dùng **Modal Xác Nhận (`role="alertdialog"`)**.
- **Biểu tượng & Thẻ môn học (`SubjectCard`):**
  - Mọi biểu tượng `.material-symbols-outlined` trang trí cạnh tên môn học hoặc nút hành động bắt buộc gắn `aria-hidden="true"`.
  - Mọi nút chỉ có icon (xoá môn, sửa chặng, đặt lại bộ lọc) bắt buộc gắn `aria-label` tiếng Việt rõ nghĩa.
