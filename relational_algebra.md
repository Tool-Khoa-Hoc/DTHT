# Lược Đồ Đại Số Quan Hệ Đấu Trường Học Tập

Đây là lược đồ cơ sở dữ liệu dưới dạng Lý thuyết Đại số Quan hệ được trích xuất từ database Supabase của dự án.
Quy ước:
- **Tên IN HOA**: Tên của quan hệ (bảng).
- **Gạch chân (<u>thuộc_tính</u>)**: Khóa chính (Primary Key).
- **In nghiêng (<i>thuộc_tính</i>)**: Khóa ngoại (Foreign Key).

---

## 1. Quản lý Người dùng & Nhắn tin (User Management)
- **PROFILES**(<u>id</u>, display_name, avatar_url, university, major, starting_year, target_gpa, current_gpa, role, admission_scores, is_approved_bang_chu, user_mode, target_thpt, target_dgnl, email, full_name, roadmap_data, is_vip, vip_expired_at, created_at, updated_at)
- **FOLLOWS**(<u>id</u>, <i>follower_id</i>, <i>following_id</i>, created_at)
- **NOTIFICATIONS**(<u>id</u>, <i>user_id</i>, title, message, link, is_read, created_at)

## 2. Quản lý Học tập & Lộ trình (Study & Roadmap)
- **SEMESTERS**(<u>id</u>, <i>user_id</i>, name, start_date, end_date, status, total_credits, gpa, created_at)
- **SUBJECTS**(<u>id</u>, <i>semester_id</i>, <i>user_id</i>, name, code, credits, grade_letter, grade_number, expected_grade, status, progress_percentage, created_at)
- **STUDY_SESSIONS**(<u>id</u>, <i>user_id</i>, <i>subject_id</i>, study_date, duration_minutes, focus_score, notes, created_at)
- **USER_GRADES**(<u>id</u>, <i>user_id</i>, subject, credits, score, created_at)
- **ROADMAP_MILESTONES**(<u>id</u>, <i>user_id</i>, mode, sort_order, title, subtitle, status, progress, created_at, updated_at)
- **CAMPAIGNS**(<u>id</u>, <i>user_id</i>, title, description, is_completed, is_public, start_date, end_date, target, targets, created_at)

## 3. Kho Tài liệu (Document Management)
- **DOCUMENTS**(<u>id</u>, title, description, category_id, <i>uploaded_by</i>, author_name, file_url, file_type, file_size, downloads_count, avg_rating, is_public, category, is_featured, education_level, publish_date, major, created_at)
- **DOCUMENT_REVIEWS**(<u>id</u>, <i>document_id</i>, <i>user_id</i>, rating, review_text, created_at)
- **USER_SAVED_DOCUMENTS**(<u>id</u>, <i>user_id</i>, <i>document_id</i>, saved_at, last_accessed)
- **DOCUMENT_REPORTS**(<u>id</u>, <i>document_id</i>, <i>reported_by</i>, reason, created_at)

## 4. Quản lý Đấu Trường / Đề Thi (Exam & Results)
- **EXAM_KEYS**(<u>exam_id</u>, answer_key, resources, last_synced_at, created_at)
- **USER_ACCESS_LOG**(<u>id</u>, <i>user_id</i>, exam_id, created_at)
- **EXAM_PROGRESS**(<u>id</u>, <i>user_id</i>, exam_id, subject_folder, answers, time_left_seconds, status, started_at, updated_at, answers_snapshot)
- **EXAM_RESULTS**(<u>id</u>, <i>user_id</i>, exam_id, subject_folder, exam_title, score, max_score, correct_count, total_questions, answers_snapshot, submitted_at, is_scored, scored_at)
- **SCHOOL_SCORES**(<u>id</u>, university_name, university_code, major_name, subject_groups, score, method, year, created_at)

## 5. Soạn thảo Đề Thi (Exam Composer - Admin)
- **EXAM_DRAFTS**(<u>id</u>, title, subject, duration_min, status, content_json, answer_key_json, raw_source_text, <i>created_by</i>, created_at, updated_at, published_at)
- **EXAM_DRAFT_REVISIONS**(<u>id</u>, <i>draft_id</i>, revision_no, content_json, answer_key_json, raw_source_text, <i>created_by</i>, created_at)
- **EXAM_IMPORT_JOBS**(<u>id</u>, filename, status, parse_error, preview_json, <i>created_by</i>, created_at, updated_at)

## 6. Giao dịch & Gói VIP (Payments)
- **ORDERS**(<u>id</u>, <i>user_id</i>, package_id, amount, vip_days, status, transfer_code, created_at, updated_at)
- **TRANSACTIONS**(<u>id</u>, tid, <i>order_id</i>, <i>user_id</i>, amount, description, bank, transaction_code, raw_data, processed_at, created_at)
- **PAYMENT_LOGS**(<u>id</u>, <i>order_id</i>, <i>user_id</i>, raw_payload, status, error_message, amount, provider, payload, created_at)

---

### Mối Quan Hệ (Dependencies / Foreign Keys)

* **PROFILES**: <i>id</i> tham chiếu tới bảng Auth của Supabase (`auth.users.id`).
* **SEMESTERS, SUBJECTS, STUDY_SESSIONS**: <i>user_id</i> tham chiếu tới **PROFILES**. <i>semester_id</i> trong SUBJECTS tham chiếu tới **SEMESTERS**. <i>subject_id</i> trong STUDY_SESSIONS tham chiếu tới **SUBJECTS**.
* **DOCUMENTS**: <i>uploaded_by</i> tham chiếu tới **PROFILES**.
* **DOCUMENT_REVIEWS, USER_SAVED_DOCUMENTS, DOCUMENT_REPORTS**: <i>user_id</i>/<i>reported_by</i> tham chiếu **PROFILES**, <i>document_id</i> tham chiếu **DOCUMENTS**.
* **ORDERS, TRANSACTIONS, PAYMENT_LOGS**: <i>user_id</i> tham chiếu **PROFILES**. <i>order_id</i> tham chiếu tới **ORDERS**.
* **EXAM_PROGRESS, EXAM_RESULTS, USER_ACCESS_LOG**: <i>user_id</i> tham chiếu tới **PROFILES**.
* **EXAM_DRAFTS, EXAM_IMPORT_JOBS**: <i>created_by</i> tham chiếu tới `auth.users.id`.
