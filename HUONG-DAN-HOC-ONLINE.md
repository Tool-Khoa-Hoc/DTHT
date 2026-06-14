# Hướng dẫn bàn giao: Xóa "Phòng thi" & Thêm tab "Học online"

> File này để guide AI (GPT/Claude) tiếp tục hoặc kiểm tra công việc. Viết self-contained:
> đọc xong là làm được mà không cần ngữ cảnh khác.

---

## 1. Tổng quan dự án

- **Repo:** `tram_hs_sv` (thư mục `E:\DTHT`) — Vite + React 19 + TailwindCSS + React Router 7.
- **Backend:** Supabase (`@supabase/supabase-js`). Auth dùng Supabase, **đã có sẵn đăng nhập Google**
  (`supabase.auth.signInWithOAuth({ provider: 'google' })` trong `src/pages/AuthScreen.jsx`).
- **Project Supabase thật của repo:** `szvzwnbdjixcvgbgpavf` (xem `VITE_SUPABASE_URL` trong `.env`).
- App là LMS "Đấu Trường Học Tập": Home, Tính điểm (GPA), Thư viện, Lộ trình, Trường phù hợp,
  Đấu trường, Ghi chú, VIP/Thanh toán, Admin… và (trước đây) **hệ thống đề thi/phòng thi**.

### Mục tiêu
1. **Xóa sạch hệ thống đề thi** (frontend + server + database).
2. **Đã gỡ bỏ hoàn toàn VIP + trang thanh toán** (Pricing/Payment, nav "Nâng cấp VIP",
   tab VIP trong Admin, mục VIP ở Profile). Quyền học **chỉ** do Google quản qua việc share sheet.
3. Thêm tab **"Học online"** nhúng Google Sheet COMBO HS12 2027 vào web.
4. **Kiểm soát quyền bằng nhúng iframe** — Google tự enforce: chỉ tài khoản Google đã được
   *chia sẻ* trên sheet mới xem được. Học sinh đăng nhập Google.
5. Bấm **tab sheet** → giữ khung view (iframe) trong web. Bấm **link học trong ô** → mở tab mới.
6. Xem ổn định trên **cả điện thoại và máy tính** (có fallback "Mở trong Google Sheets").

### Google Sheet nguồn
- ID: `13KsuJCOh2oxz7Olv6shcs1rAsZlZZio_DuCqibdYYos`
- Tên: "COMBO HS12 2027 2k9 - Lộ Trình Xuất Phát Sớm…"
- 5 tab (gid):
  - `1914158245` — HS12 XPS 2K9
  - `901945532` — BONUS HS12 2K8
  - `1052649703` — Ebook
  - `325181356` — ĐÔI LỜI NHẮN NHỦ
  - `1217873399` — HƯỚNG DẪN HỌC TRÊN DRIVE
- Mỗi dòng = 1 khóa học; trong ô có hyperlink ("SHEET", "INFO", "Truy cập DRIVE") trỏ tới tài liệu.

---

## 2. ✅ Đã hoàn thành (frontend + server)

> Build đã chạy sạch: `npm run build` ✓. Không còn tham chiếu đề thi nào trong `src/`.

### Đã XÓA
- `src/components/exam/` (toàn bộ: AnswerSheet2025, ExamRightPanel, ExamTakingHeader,
  RichTextRenderer, DocumentRenderer, SecurePdfViewer)
- `src/pages/`: ExamTaking.jsx, ExamResult.jsx, AzotaEditor.jsx, AdminExamComposer.jsx (ExamRoom.jsx đã xóa trước)
- `src/components/admin/`: AdminExams.jsx, AdminSubjects.jsx
- `src/hooks/`: useExamEngine.js, useExamAccess.js
- `src/services/`: adminExamApi.js, examReviewApi.js
- `src/utils/`: examStructure.js, examTime.js, examIndexCache.js, examReviewDerived.js,
  examBlockText.test.js, localImportFallback.js
- `src/lib/uploadExamFile.js`, `src/components/SecurityWrapper.jsx`
- **Toàn bộ `server/`** (đây là "exam-review-api", không phục vụ gì khác)
- `public/data/exams/`

### Đã SỬA (gỡ phần exam, giữ phần khác)
- `src/App.jsx` — gỡ route/lazy ExamTaking, ExamResult, redirect /exam-room, `<SecurityWrapper>`;
  thêm route `<Route path="hoc-online" element={<OnlineLearning />} />`.
- `src/lib/routeModules.js` — gỡ loader ExamTaking/ExamResult; thêm `OnlineLearning`.
- `src/components/RootLayout.jsx` — gỡ logic fullscreen `isExamTakingRoute`; thêm nav "Học online"
  (desktop + mobile, icon `cast_for_education`).
- `src/pages/Profile.jsx` — gỡ mục "Đề đã làm" (state/hàm/UI + query exam_results/exam_progress + RPC).
- `src/pages/Admin.jsx` — gỡ 2 tab "Quản lý đề thi" + "Môn học" (state/hàm/render/modal/import),
  **giữ** tab Library / VIP / Sắc phong Bang Chủ / Truyền Đạo Sư.
- `src/components/ui/Skeleton.jsx` — gỡ `ExamResultSkeleton`.
- `package.json` — gỡ script `exam-index`, `predev`, `prebuild`, `sync`, `build-index`,
  `status`, `distribute`. Còn lại: dev/build/lint/preview.

### Đã THÊM (tab Học online)
- `src/config/onlineLearning.js` — ID sheet + 5 tab + hàm `embedUrl(gid)` / `openUrl(gid)`.
- `src/pages/OnlineLearning.jsx` — trang Học online (chi tiết ở mục 4).

---

## 3. ⚠️ CẢNH BÁO QUAN TRỌNG về Database

Trong lúc làm, công cụ Supabase (MCP) kết nối tới **NHẦM project**:
- Repo dùng project **`szvzwnbdjixcvgbgpavf`** (theo `.env`).
- Nhưng tài khoản kết nối chỉ thấy project **`eskgjwzcognziachvcbl` ("web-thi-thpt")** — schema
  hoàn toàn khác, có dữ liệu thật của **một ứng dụng khác** (exam_rooms, exam_blueprints…).

➡️ **TUYỆT ĐỐI KHÔNG chạy DROP qua project `eskgjwzcognziachvcbl`** — sẽ phá hỏng app khác.
➡️ Migration xóa DB đã được **viết sẵn nhưng CHƯA áp dụng**. Phải áp vào đúng project
   `szvzwnbdjixcvgbgpavf` (xem mục 5), **và backup trước**.

---

## 4. Chi tiết tab "Học online" (đã code, để GPT hiểu & tinh chỉnh)

### `src/config/onlineLearning.js`
```js
export const ONLINE_SHEET_ID = '13KsuJCOh2oxz7Olv6shcs1rAsZlZZio_DuCqibdYYos';
export const ONLINE_SHEET_TABS = [
  { gid: '1914158245', title: 'HS12 XPS 2K9' },
  { gid: '901945532',  title: 'BONUS HS12 2K8' },
  { gid: '1052649703', title: 'Ebook' },
  { gid: '325181356',  title: 'ĐÔI LỜI NHẮN NHỦ' },
  { gid: '1217873399', title: 'HƯỚNG DẪN HỌC TRÊN DRIVE' },
];
export const embedUrl = (gid) =>
  `https://docs.google.com/spreadsheets/d/${ONLINE_SHEET_ID}/preview?gid=${gid}&widget=true&headers=false`;
export const openUrl = (gid) =>
  `https://docs.google.com/spreadsheets/d/${ONLINE_SHEET_ID}/edit?gid=${gid}#gid=${gid}`;
```

### `src/pages/OnlineLearning.jsx` — hành vi
- Lấy `user, loading` từ `useAuth()` (`src/contexts/AuthContext.jsx`). Route nằm trong
  `RootLayout` nên **bắt buộc đăng nhập** (chưa login → tự redirect `/auth`).
- **Không còn gate VIP.** Mọi tài khoản đã đăng nhập đều vào thẳng khung sheet. Việc ai xem được
  nội dung do **Google enforce** theo email đã được chia sẻ trên spreadsheet/Drive.
- **Khung view:** `<iframe src={embedUrl(activeGid)} key={activeGid} onLoad={...}>`. Đổi tab = đổi
  `activeGid` → iframe remount (vẫn nằm trong web). Link trong ô do Google render `target=_blank`
  → tự mở tab mới.
- **Banner Google:** nếu tài khoản không phải đăng nhập bằng Google (`user.app_metadata.provider !==
  'google'` và không có identity google) → hiện banner mời đăng nhập Google (vì iframe sheet private
  cần phiên Google của trình duyệt).
- **Ổn định mobile:** luôn có nút "Mở trong Google Sheets" (`openUrl`, `target=_blank`) + chú thích
  fallback (iframe cookie bên thứ ba hay bị Safari/Chrome chặn trên điện thoại).
- Style theo theme: Tailwind, tông `#10b981` (xanh) / `#e36488` (hồng), nền tối `#150a0d`/`#201216`.

### Cơ chế "so khớp quyền truy cập với tài khoản Google"
- **Không cần backend.** Sheet để **PRIVATE**. Khi nhúng `/preview`, Google chỉ render nội dung nếu
  tài khoản Google đang đăng nhập trên trình duyệt **đã được chia sẻ** trên sheet. Tài khoản chưa
  được chia sẻ → Google hiện "cần quyền truy cập". Đây chính là phần "so khớp quyền".
- **Việc admin phải làm:** Share spreadsheet (và các Drive khóa học liên kết trong ô) tới đúng email
  Google của học viên.

---

## 5. Migration Database (CHƯA áp dụng — GPT/anh cần thực thi vào đúng project)

File: `supabase/migrations/20260613000000_drop_exam_system.sql` (đã có sẵn trong repo).

**Nội dung:** DROP các bảng/RPC chỉ-thuộc-đề-thi, GIỮ phần dùng chung.

- **DROP TABLE … CASCADE:** `attempt_answers, exam_attempts, exam_assets, exam_review_state,
  exam_private_data, exam_public_data, exams, exam_import_jobs, exam_draft_revisions, exam_drafts,
  exam_keys, exam_results, exam_progress, user_access_log, exam_subjects, deleted_exam_tombstones,
  sync_logs`.
- **DROP FUNCTION (mọi overload, qua vòng lặp):** `check_and_log_exam_access, get_exam_review_payload,
  calculate_flat_score, normalize_answers_to_flat, list_exam_answer_files, resolve_exam_key_lookup,
  _rescore_exam_results_for_exam, _trg_rescore_exam_results_on_exam_keys`, và nhóm `admin_*` đề thi.
- **GIỮ:** profiles, orders, payment_logs, transactions, campaigns, documents, school_scores,
  user_notes, roadmap_milestones, notifications, follows, document_reports, subjects; hàm
  `is_active_vip` (tái dùng cho Học online), `is_admin`, `admin_user_directory`,
  `admin_get_thongsoai_candidates`, `set_order_transfer_code`, `order_transfer_code_from_uuid`.

**Cách áp dụng (chọn 1):**
```bash
# Cách A: Supabase CLI (link đúng project trước)
supabase link --project-ref szvzwnbdjixcvgbgpavf
supabase db push

# Cách B: Dán nội dung file .sql vào Dashboard → SQL Editor của project szvzwnbdjixcvgbgpavf rồi Run.
```
**⚠️ Trước khi chạy: export/backup các bảng trên (Dashboard → Database → Backups, hoặc dump).**

> Lưu ý: Trước khi DROP, nên `list_tables` / kiểm tra schema thực tế của project
> `szvzwnbdjixcvgbgpavf` để đối chiếu đúng tên bảng (lịch sử migration trong repo có thể lệch với DB).

---

## 6. Việc CÒN LẠI cho GPT (checklist)

1. **(Bắt buộc) Áp migration DB** vào project `szvzwnbdjixcvgbgpavf` theo mục 5 (backup trước).
2. **(Bắt buộc) Cấu hình Google sharing:** chia sẻ spreadsheet + Drive tới email Google học viên.
3. **(Khuyến nghị) Kiểm thử** theo mục 7.
4. **(Tùy chọn) Dọn thêm:**
   - Xóa `scripts/` các file pipeline đề thi cũ (generate-exam-index.mjs, convert_exam_*, dtht.py…) —
     hiện là dead code, không ảnh hưởng build.
   - Thêm card "Học online" ở `src/pages/Home.jsx` (mảng `lmsHighlights`).
   - Thêm `/hoc-online` vào sitemap (không nên, vì cần đăng nhập).
5. **(Tùy chọn) Storage:** nếu project `szvzwnbdjixcvgbgpavf` có bucket chứa file đề/đáp án cũ → xóa.

### Lưu ý khi sửa code
- **GIỮ** các dep `katex`, `pdfjs-dist`, `react-pdf` trong `package.json` (còn được `ErrorBoundary`
  tham chiếu) — đừng gỡ kẻo vỡ build.
- Pattern thêm route mới: khai báo loader ở `src/lib/routeModules.js` → `lazyRetry` + `<Route>` ở
  `src/App.jsx` → nav link ở `src/components/RootLayout.jsx`.

---

## 7. Cách kiểm thử (verification)

```bash
npm install      # nếu chưa
npm run build    # phải PASS (không lỗi import)
npm run dev      # mở http://localhost:5173
```

- Không còn route/nav phòng thi; `/exam/...` không tồn tại; Home/GPA/Library/Profile/Admin/Pricing OK.
- `/admin`: chỉ còn 4 tab (Library, Bang Chủ, VIP, Truyền Đạo Sư); không còn tab Đề thi/Môn học.
- `/profile`: không còn mục "Đề đã làm".
- **`/hoc-online`:**
  - Chưa đăng nhập → đẩy về `/auth`.
  - Đăng nhập Google (tài khoản đã được share sheet) → 5 tab hiện; đổi tab giữ khung trong web;
    bấm link trong ô mở tab mới.
  - Tài khoản chưa được share → iframe báo cần quyền + nút "Mở trong Google Sheets".
  - Non-VIP → thấy CTA nâng cấp; VIP/admin → vào khung học.
  - Mobile: iframe hiển thị, hoặc dùng fallback "Mở trong Google Sheets".
- Sau khi áp migration: app không gọi RPC đề thi nào (không lỗi 404 RPC trong console).

---

## 8. File quan trọng (tham chiếu nhanh)

| File | Vai trò |
|---|---|
| `src/config/onlineLearning.js` | ID sheet + danh sách tab + URL embed/open |
| `src/pages/OnlineLearning.jsx` | Trang tab Học online |
| `src/App.jsx` | Khai báo route `/hoc-online` |
| `src/lib/routeModules.js` | Lazy loader các page |
| `src/components/RootLayout.jsx` | Nav desktop/mobile + layout shell |
| `src/contexts/AuthContext.jsx` | `useAuth()` → user, profile (is_vip, role…) |
| `src/pages/AuthScreen.jsx` | Mẫu đăng nhập Google (signInWithOAuth) |
| `supabase/migrations/20260613000000_drop_exam_system.sql` | Migration xóa DB đề thi (chưa áp) |
| `.env` | `VITE_SUPABASE_URL` = project đúng (`szvzwnbdjixcvgbgpavf`) |
