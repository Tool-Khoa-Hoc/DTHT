import React, { useState } from 'react';
import { sanitizeExternalUrl } from '../../utils/urlSecurity';
import { getDocumentKindMeta } from '../../lib/documents';

const THPT_CATEGORIES = [
  { label: 'Toán', value: 'toan' },
  { label: 'Vật Lý', value: 'ly' },
  { label: 'Hóa Học', value: 'hoa' },
  { label: 'Sinh Học', value: 'sinh' },
  { label: 'Ngữ Văn', value: 'van' },
  { label: 'Tiếng Anh', value: 'anh' },
  { label: 'Lịch Sử', value: 'su' },
  { label: 'Địa Lý', value: 'dia' },
  { label: 'GDCD', value: 'gdcd' },
  { label: 'Tin Học', value: 'tin' },
  { label: 'Khác', value: 'khac' },
];

const UNI_CATEGORIES = [
  { label: 'Giải Tích', value: 'giai_tich' },
  { label: 'Lập Trình', value: 'lap_trinh' },
  { label: 'Kinh Tế', value: 'kinh_te' },
  { label: 'Kiến Trúc', value: 'kien_truc' },
  { label: 'Khác', value: 'khac' },
];

export default function AdminLibrary({
  documents = [],
  reports = [],
  loadingDocs = false,
  loadingReports = false,
  docId,
  title,
  setTitle,
  description,
  setDescription,
  authorName,
  setAuthorName,
  educationLevel,
  setEducationLevel,
  category,
  setCategory,
  major,
  setMajor,
  fileUrl,
  setFileUrl,
  isFeatured,
  setIsFeatured,
  isPublic,
  setIsPublic,
  publishDate,
  setPublishDate,
  isUploading,
  onSaveDocument,
  onEditDocument,
  onResetForm,
  onDeleteDocument,
  onResolveReport,
}) {
  const [activeSubTab, setActiveSubTab] = useState('docs'); // 'docs' | 'reports'
  const [searchDocQuery, setSearchDocQuery] = useState('');
  const [deleteConfirmDocId, setDeleteConfirmDocId] = useState(null);

  const categories = educationLevel === 'university' ? UNI_CATEGORIES : THPT_CATEGORIES;

  const filteredDocs = documents.filter((d) => {
    if (!searchDocQuery.trim()) return true;
    const q = searchDocQuery.toLowerCase();
    return (
      (d.title || '').toLowerCase().includes(q) ||
      (d.author_name || '').toLowerCase().includes(q) ||
      (d.category || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Subtab Navigation */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('docs')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'docs'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-surface border border-border text-secondary-text hover:text-foreground'
          }`}
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            library_books
          </span>
          <span>Kho tài liệu ({documents.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('reports')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'reports'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-surface border border-border text-secondary-text hover:text-foreground'
          }`}
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            report
          </span>
          <span>Báo cáo sự cố ({reports.length})</span>
          {reports.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" aria-hidden="true" />
          )}
        </button>
      </div>

      {activeSubTab === 'docs' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Add / Edit Form */}
          <div className="lg:col-span-5">
            <form
              onSubmit={onSaveDocument}
              className="paper-card p-5 space-y-4 sticky top-6"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="font-display font-bold text-base text-foreground flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary" aria-hidden="true">
                    {docId ? 'edit_document' : 'cloud_upload'}
                  </span>
                  <span>{docId ? 'Sửa thông tin tài liệu' : 'Đăng tài liệu mới'}</span>
                </h2>
                {docId && (
                  <button
                    type="button"
                    onClick={onResetForm}
                    className="text-xs text-secondary-text hover:text-primary transition-colors cursor-pointer"
                  >
                    Hủy sửa
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Tiêu đề tài liệu <span className="text-primary">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Tuyển tập 50 Đề Thi Thử THPT Quốc Gia 2027..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Mô tả / Tóm tắt nội dung
                </label>
                <textarea
                  rows={3}
                  placeholder="Nội dung trọng tâm, cấu trúc đề, lưu ý phương pháp giải..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-paper border border-border-strong rounded-xl text-xs text-foreground focus:outline-none focus:border-primary leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Cấp học</label>
                  <select
                    value={educationLevel}
                    onChange={(e) => setEducationLevel(e.target.value)}
                    className="w-full px-3 py-2 bg-paper border border-border-strong rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="thpt">THPT</option>
                    <option value="university">Đại học</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Danh mục môn</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-paper border border-border-strong rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    {categories.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Tác giả / Nguồn
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Thầy Đỗ Văn Đức, Chuyên ĐHSP..."
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="w-full px-3 py-2 bg-paper border border-border-strong rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Trường / Chuyên ngành
                  </label>
                  <input
                    type="text"
                    placeholder="VD: ĐHQG Hà Nội / KHTN..."
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    className="w-full px-3 py-2 bg-paper border border-border-strong rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Link tải tài liệu (URL) <span className="text-primary">*</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://docs.google.com/spreadsheets/... hoặc Drive link"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-paper border border-border-strong rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Ngày tài liệu (tuỳ chọn)
                </label>
                <input
                  type="date"
                  value={publishDate}
                  onChange={(e) => setPublishDate(e.target.value)}
                  className="w-full px-3 py-2 bg-paper border border-border-strong rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-alt border border-border">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="text-primary focus:ring-primary rounded"
                  />
                  <span>Tài liệu Nổi bật</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="text-primary focus:ring-primary rounded"
                  />
                  <span>Công khai</span>
                </label>
              </div>

              <div className="flex items-center gap-2 pt-2">
                {docId && (
                  <button
                    type="button"
                    onClick={onResetForm}
                    className="btn-arena btn-arena-secondary btn-arena-sm flex-1"
                  >
                    Hủy sửa
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isUploading}
                  className="btn-arena btn-arena-primary btn-arena-sm flex-1"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    {isUploading ? 'hourglass_empty' : 'save'}
                  </span>
                  <span>
                    {isUploading
                      ? 'Đang xử lý...'
                      : docId
                        ? 'Cập nhật tài liệu'
                        : 'Lưu tài liệu mới'}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* List of Documents */}
          <div className="lg:col-span-7 paper-card p-5 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h3 className="font-display font-bold text-base text-foreground">
                Danh sách tài liệu ({filteredDocs.length})
              </h3>
              <input
                type="text"
                placeholder="Tìm tài liệu..."
                value={searchDocQuery}
                onChange={(e) => setSearchDocQuery(e.target.value)}
                className="px-3 py-1.5 bg-paper border border-border-strong rounded-xl text-xs text-foreground focus:outline-none focus:border-primary w-full sm:w-56"
              />
            </div>

            {loadingDocs ? (
              <div className="flex justify-center py-16">
                <span
                  className="material-symbols-outlined animate-spin text-3xl text-primary"
                  aria-hidden="true"
                >
                  sync
                </span>
              </div>
            ) : filteredDocs.length > 0 ? (
              <div className="space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
                {filteredDocs.map((doc) => {
                  const kind = getDocumentKindMeta(doc.title, doc.file_url);
                  const safeUrl = sanitizeExternalUrl(doc.file_url);

                  return (
                    <div
                      key={doc.id}
                      className="p-3.5 rounded-xl bg-paper border border-border hover:border-border-strong transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${kind.badgeClass}`}>
                            {kind.label}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-alt text-secondary-text border border-border uppercase">
                            {doc.education_level || 'THPT'}
                          </span>
                          {doc.category && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary-soft text-primary border border-primary/30">
                              {doc.category}
                            </span>
                          )}
                          {doc.is_featured && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gold-soft text-gold-dark border border-gold">
                              Nổi bật
                            </span>
                          )}
                          {!doc.is_public && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/40 text-red-600 border border-red-300">
                              Ẩn
                            </span>
                          )}
                        </div>

                        <h4 className="font-display font-bold text-sm text-foreground truncate">
                          {doc.title}
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          Tác giả: {doc.author_name || 'Khuyết danh'} • Ngày tạo:{' '}
                          {new Date(doc.created_at).toLocaleDateString('vi-VN')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 no-shrink">
                        {safeUrl && (
                          <a
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-surface-alt rounded-lg transition-colors cursor-pointer"
                            title="Mở link"
                          >
                            <span className="material-symbols-outlined text-lg" aria-hidden="true">
                              open_in_new
                            </span>
                          </a>
                        )}

                        <button
                          type="button"
                          aria-label={`Chỉnh sửa tài liệu ${doc.title || ''}`.trim()}
                          onClick={() => onEditDocument(doc)}
                          className="p-2 text-muted-foreground hover:text-primary hover:bg-primary-soft rounded-lg transition-colors cursor-pointer"
                          title="Sửa"
                        >
                          <span className="material-symbols-outlined text-lg" aria-hidden="true">
                            edit
                          </span>
                        </button>

                        <button
                          type="button"
                          aria-label={`Xóa tài liệu ${doc.title || ''}`.trim()}
                          onClick={() => setDeleteConfirmDocId(doc.id)}
                          className="p-2 text-muted-foreground hover:text-primary hover:bg-primary-soft rounded-lg transition-colors cursor-pointer"
                          title="Xóa"
                        >
                          <span className="material-symbols-outlined text-lg" aria-hidden="true">
                            delete
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-secondary-text">
                Chưa có tài liệu nào trong hệ thống.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Reports Subtab */
        <div className="paper-card p-6">
          <div className="border-b border-border pb-4 mb-4">
            <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
              <span className="material-symbols-outlined text-primary" aria-hidden="true">
                report
              </span>
              <span>Báo cáo sự cố từ người học ({reports.length})</span>
            </h3>
            <p className="text-xs text-secondary-text mt-1">
              Các tài liệu bị báo cáo link hỏng, sai kiến thức hoặc vi phạm cần xử lý.
            </p>
          </div>

          {loadingReports ? (
            <div className="py-12 flex justify-center">
              <span className="material-symbols-outlined animate-spin text-3xl text-primary" aria-hidden="true">
                sync
              </span>
            </div>
          ) : reports.length > 0 ? (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="p-4 rounded-xl bg-paper border border-border hover:border-border-strong transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/40 text-red-600 border border-red-300">
                        Sự cố
                      </span>
                      <span className="text-xs font-bold text-foreground">
                        {report.documents?.title || `Mã tài liệu: ${report.document_id}`}
                      </span>
                    </div>

                    <p className="text-xs text-primary font-medium">
                      Lý do: &ldquo;{report.reason}&rdquo;
                    </p>

                    <p className="text-[10px] text-muted-foreground">
                      Báo lúc: {new Date(report.created_at).toLocaleString('vi-VN')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 no-shrink">
                    <button
                      type="button"
                      onClick={() => onResolveReport(report.id)}
                      className="btn-arena btn-arena-jade btn-arena-sm"
                    >
                      <span className="material-symbols-outlined text-sm" aria-hidden="true">
                        check
                      </span>
                      <span>Đã giải quyết</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onDeleteDocument(report.document_id);
                        onResolveReport(report.id);
                      }}
                      className="btn-arena btn-arena-primary btn-arena-sm"
                    >
                      <span className="material-symbols-outlined text-sm" aria-hidden="true">
                        delete
                      </span>
                      <span>Xóa tài liệu lỗi</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-secondary-text">
              Hiện tại không có báo cáo sự cố nào! Kho thư viện đang hoạt động tốt.
            </div>
          )}
        </div>
      )}

      {/* Delete Document Confirmation Dialog */}
      {deleteConfirmDocId && (
        <div
          className="fixed inset-0 z-[110] bg-foreground/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeleteConfirmDocId(null)}
        >
          <div
            className="imperial-frame w-full max-w-sm p-6 bg-surface shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center no-shrink">
                <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                  delete_forever
                </span>
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-foreground">
                  Xác nhận xoá tài liệu
                </h3>
                <p className="text-xs text-secondary-text mt-0.5">
                  Tài liệu này sẽ bị xoá khỏi kho và không thể hoàn tác.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmDocId(null)}
                className="btn-arena btn-arena-secondary btn-arena-sm"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteDocument(deleteConfirmDocId);
                  setDeleteConfirmDocId(null);
                }}
                className="btn-arena btn-arena-primary btn-arena-sm"
              >
                Xác nhận xoá
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
