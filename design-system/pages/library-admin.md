# Page Override Spec — Library, Notes & Admin (`design-system/pages/library-admin.md`)

> **Kế thừa:** [`design-system/MASTER.md`](../MASTER.md) + Playbook [`.agents/skills/ui-ux-pro-max/references/hybrid-agent-team-argon4-deepseek-flash.md`](../../.agents/skills/ui-ux-pro-max/references/hybrid-agent-team-argon4-deepseek-flash.md).
> **Phạm vi áp dụng:** Tàng Kinh Các / Kho Tài Liệu (`Library`), Sổ Tay Ghi Chú (`Notes`), Học Trực Tuyến (`OnlineLearning`), và Đài Quản Trị (`Admin` / `CTV`).

---

## 1. Sổ Tay Ghi Chú & Học Trực Tuyến (`Notes` & `OnlineLearning`)

- **Trải nghiệm đọc & soạn thảo êm mắt hai chế độ:**
  - Vùng đọc bài giảng và nội dung ghi chú dùng `Be Vietnam Pro` cỡ `15px–16px`, giãn dòng `leading-relaxed` (`1.65+`), bề rộng dòng tối ưu `max-w-[70ch]` trên nền `bg-surface` (Sáng `#FFFFFF` / Tối `#221E1A`).
  - Bảo toàn bản nháp đang gõ khi mất mạng hoặc lỗi lưu `tram_sv`; thông báo kết quả lưu/ghim bằng **Toast nhẹ góc màn hình** thay vì `alert()`.
- **Chuẩn trợ năng bắt buộc cho nút thao tác thẻ Ghi chú & Khoá học:**
  - Mọi nút chỉ hiển thị biểu tượng trên thẻ ghi chú (Ghim ghi chú, Xoá ghi chú, Đóng trình soạn thảo) **bắt buộc có `aria-label` tiếng Việt cụ thể** (ví dụ: `aria-label={note.is_pinned ? "Bỏ ghim ghi chú" : "Ghim ghi chú"}`, `aria-label="Xóa ghi chú"`) và `aria-pressed` cho nút trạng thái ghim.
  - Mọi thẻ `<span className="material-symbols-outlined">` trang trí trong danh sách bài học (`OnlineLearning`, thanh điều hướng, thẻ tài liệu) **bắt buộc gắn `aria-hidden="true"`**.

## 2. Đài Quản Trị & Điều Phối Quyền (`Admin` & `CTV` trên `tram_sv`)

- **Mật độ hiển thị cao nhưng thoáng mắt (`High-Density Scholarly Console`):**
  - Bảng danh sách sĩ tử, đơn đăng ký CTV và nhật ký điểm thưởng dùng nền `bg-surface`, tiêu đề cột `bg-surface-alt text-secondary-text text-xs font-semibold uppercase tracking-[0.08em]`, đường kẻ ngang mảnh `border-border`, chữ số EXP/thời gian dùng `.tabular`.
  - Huy hiệu phân quyền (`Admin`, `CTV`, `Thống Soái`, `Sĩ Tử`) có cả **nhãn chữ rõ ràng + viền/nền semantic** đảm bảo độ tương phản `>= 4.5:1` ở cả Thư Phòng Sáng và Mặc Dạ Tối.
- **Thay thế hoàn toàn `alert` / `window.confirm` / `window.prompt` trong Quản trị:**
  - **Cấp/thu hồi quyền (`Admin`, `CTV`, `Thống Soái`) hoặc duyệt/từ chối đơn:** Mở **Modal Xác Nhận / Nhập Ghi Chú (`role="dialog"` hoặc `role="alertdialog"`)** hiển thị rõ tên/email chiến binh chịu tác động, ô `<textarea>` nhập lý do (thay cho `window.prompt`), nút *“Huỷ bỏ”* và nút xác nhận có trạng thái chờ `disabled` khi đang ghi vào `tram_sv`.
  - **Cộng/trừ điểm EXP thủ công:** Dùng biểu mẫu inline hoặc Modal có `<input type="number" className="tabular">` kiểm tra hợp lệ trực tiếp thay cho `window.prompt`.
  - Mọi thông báo thành công / lỗi quyền hạn trả về qua **Toast chuẩn** hoặc banner `role="alert"` ngay trên đầu phân khu.

## 3. Cổng Kiểm Định Bắt Buộc Trước Bàn Giao

Chạy kiểm tra tự động cho toàn bộ phân khu trước khi đóng Baton:

```bash
python .agents/skills/ui-ux-pro-max/scripts/audit_ui_ux.py src/pages/Admin.jsx --strict
python .agents/skills/ui-ux-pro-max/scripts/audit_ui_ux.py src/pages/Notes.jsx --strict
python .agents/skills/ui-ux-pro-max/scripts/audit_ui_ux.py src/pages/OnlineLearning.jsx --strict
```
