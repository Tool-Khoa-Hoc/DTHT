# Page Override Spec — Library, Notes & Admin (`design-system/pages/library-admin.md`)

> **Kế thừa:** [`design-system/MASTER.md`](../MASTER.md) + Playbook [`.agents/skills/ui-ux-pro-max/references/hybrid-agent-team-argon4-deepseek-flash.md`](../../.agents/skills/ui-ux-pro-max/references/hybrid-agent-team-argon4-deepseek-flash.md).
> **Phạm vi áp dụng:** Tàng Kinh Các / Kho Tài Liệu (`Library`), Sổ Tay Ghi Chú (`Notes`), Học Trực Tuyến (`OnlineLearning`), và Đài Quản Trị (`Admin` / `Collaborator`) trên cả `VI` và `EN`.

---

## 1. Sổ Tay Ghi Chú & Học Trực Tuyến (`Notes` & `OnlineLearning`)

- **Trải nghiệm đọc & soạn thảo êm mắt hai chế độ & song ngữ:**
  - Vùng đọc bài giảng và nội dung ghi chú dùng `Be Vietnam Pro` cỡ `15px–16px`, giãn dòng `leading-relaxed` (`1.65+`), trên nền `bg-surface` (Sáng `#FFFFFF` / Tối `#221E1A`), hỗ trợ đầy đủ lớp `dark:*` nhờ `@custom-variant dark` trong `src/index.css`.
  - Bảo toàn nguyên vẹn giá trị danh mục lưu trong CSDL / `localStorage` (`'Công thức'`, `'Đề cương'`, `'Ghi chép'`, `'Kế hoạch'`, `'Khác'`, `'toan'`, `'thpt'`, ...) và chỉ ánh xạ nhãn hiển thị sang Tiếng Anh khi `lang === 'en'`.
- **Chuẩn trợ năng bắt buộc cho nút thao tác thẻ Ghi chú & Khoá học:**
  - Mọi nút chỉ hiển thị biểu tượng (Ghim ghi chú, Xoá ghi chú, Toàn màn hình, Đóng trình soạn thảo, Điểm danh Pomodoro) **bắt buộc có `aria-label` theo ngôn ngữ hiện hành (`VI` / `EN`)**.
  - Mọi thẻ `<span className="material-symbols-outlined">` trang trí trong danh sách bài học (`OnlineLearning`, `SessionBar`, thẻ tài liệu) **bắt buộc gắn `aria-hidden="true"`**.

## 2. Đài Quản Trị & Điều Phối Quyền (`Admin` & `Collaborator` trên `tram_sv`)

- **Mật độ hiển thị cao nhưng thoáng mắt (`High-Density Scholarly Console`):**
  - Bảng danh sách sĩ tử, kho tài liệu, Truyền Đạo Sư (`Curator`) và duyệt Thống Soái (`Grand Marshal`) bọc trong `overflow-x-auto rounded-2xl border border-border bg-surface`, tiêu đề cột `bg-surface-alt text-secondary-text text-xs font-semibold uppercase tracking-[0.08em]`, đường kẻ ngang `divide-y divide-border`, chữ số EXP/thời gian dùng `.tabular`.
  - Huy hiệu phân quyền (`Admin`, `Truyền Đạo Sư / Curator`, `Thống Soái / Grand Marshal`, `Sĩ Tử / Scholar`) giữ `whitespace-nowrap` với viền/nền semantic tương phản `>= 4.5:1` ở cả Thư Phòng Sáng và Mặc Dạ Tối.
- **Thay thế hoàn toàn `alert` / `window.confirm` / `window.prompt` trong Quản trị:**
  - Sử dụng Modal xác nhận (`role="dialog"` / `role="alertdialog"`) và Toast thông báo song ngữ.

## 3. Cổng Kiểm Định Bắt Buộc Trước Bàn Giao

Chạy kiểm tra tự động cho toàn bộ mã nguồn trước khi bàn giao:

```bash
python .agents/skills/ui-ux-pro-max/scripts/audit_ui_ux.py src --strict
```
