import React from 'react';

export default function AdminLibrary({
  documents,
  loadingDocs,
  docTitle,
  setDocTitle,
  docGrade,
  setDocGrade,
  docSubject,
  setDocSubject,
  docCategory,
  setDocCategory,
  uploadMode,
  setUploadMode,
  setSelectedFile,
  externalUrl,
  setExternalUrl,
  resourceLabel,
  setResourceLabel,
  isUploading,
  onUploadDocument,
  onDeleteDocument,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <form
          onSubmit={onUploadDocument}
          className="paper-card p-5 space-y-4 sticky top-6"
        >
          <h2 className="font-display font-bold text-base text-foreground flex items-center gap-2 border-b border-border pb-3">
            <span className="material-symbols-outlined text-primary" aria-hidden="true">
              cloud_upload
            </span>
            Đăng tài liệu mới
          </h2>

          <div className="grid grid-cols-2 gap-1.5 p-1 bg-surface-alt rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setUploadMode('file')}
              className={`py-2 rounded-lg text-xs font-display font-bold transition-all cursor-pointer ${
                uploadMode === 'file'
                  ? 'bg-primary text-white'
                  : 'text-secondary-text hover:text-foreground'
              }`}
            >
              Tải file PDF
            </button>
            <button
              type="button"
              onClick={() => setUploadMode('link')}
              className={`py-2 rounded-lg text-xs font-display font-bold transition-all cursor-pointer ${
                uploadMode === 'link'
                  ? 'bg-primary text-white'
                  : 'text-secondary-text hover:text-foreground'
              }`}
            >
              Dán link Sheet / Drive
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1">
              Tên tài liệu / Đề thi
            </label>
            <input
              type="text"
              required
              placeholder="VD: Đề thi thử THPT Quốc Gia 2027..."
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              className="w-full px-3 py-2 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">Khối lớp</label>
              <select
                value={docGrade}
                onChange={(e) => setDocGrade(e.target.value)}
                className="w-full px-3 py-2 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
              >
                <option value="Lớp 10">Lớp 10</option>
                <option value="Lớp 11">Lớp 11</option>
                <option value="Lớp 12">Lớp 12</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">Môn học</label>
              <select
                value={docSubject}
                onChange={(e) => setDocSubject(e.target.value)}
                className="w-full px-3 py-2 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
              >
                <option value="Toán">Toán</option>
                <option value="Vật Lý">Vật Lý</option>
                <option value="Hóa Học">Hóa Học</option>
                <option value="Sinh Học">Sinh Học</option>
                <option value="Tiếng Anh">Tiếng Anh</option>
                <option value="Ngữ Văn">Ngữ Văn</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1">Thể loại</label>
            <select
              value={docCategory}
              onChange={(e) => setDocCategory(e.target.value)}
              className="w-full px-3 py-2 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
            >
              <option value="Đề thi thử">Đề thi thử</option>
              <option value="Tóm tắt lý thuyết">Tóm tắt lý thuyết</option>
              <option value="Sơ đồ tư duy">Sơ đồ tư duy</option>
              <option value="Chuyên đề nâng cao">Chuyên đề nâng cao</option>
              <option value="Kho khóa học / Sheet">Kho khóa học / Sheet</option>
            </select>
          </div>

          {uploadMode === 'file' ? (
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">
                Chọn File (PDF, Word...)
              </label>
              <input
                id="file-upload"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setSelectedFile(e.target.files[0])}
                className="w-full text-xs text-secondary-text file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-primary-soft file:text-primary hover:file:bg-primary/20 cursor-pointer"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Link Google Sheet / Google Drive / Facebook
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://docs.google.com/spreadsheets/..."
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Nhãn hiển thị nguồn
                </label>
                <input
                  type="text"
                  placeholder="VD: Google Sheet / Folder Drive / Tổng hợp"
                  value={resourceLabel}
                  onChange={(e) => setResourceLabel(e.target.value)}
                  className="w-full px-3 py-2 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={isUploading}
            className="btn-arena btn-arena-primary w-full"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">
              {isUploading ? 'hourglass_empty' : 'upload_file'}
            </span>
            {isUploading ? 'Đang tải lên...' : 'Tải lên hệ thống'}
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 paper-card p-5">
        <h2 className="font-display font-bold text-base text-foreground mb-4">
          Danh sách tài liệu đã đăng ({documents.length})
        </h2>

        {loadingDocs ? (
          <div className="flex justify-center py-12">
            <span
              className="material-symbols-outlined animate-spin text-3xl text-primary"
              aria-hidden="true"
            >
              sync
            </span>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 rounded-xl bg-paper border border-border hover:border-border-strong transition-all"
              >
                <div className="min-w-0 flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary-soft text-primary border border-primary/30">
                      {doc.grade}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-alt text-secondary-text border border-border">
                      {doc.subject}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{doc.file_size}</span>
                  </div>
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-bold text-foreground hover:text-primary truncate block"
                  >
                    {doc.title}
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteDocument(doc.id, doc.file_url)}
                  aria-label="Xóa tài liệu"
                  className="p-2 text-muted-foreground hover:text-primary hover:bg-primary-soft rounded-lg transition-colors no-shrink cursor-pointer"
                  title="Xóa tài liệu"
                >
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">
                    delete
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
