import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/ToastProvider';
import { sanitizeExternalUrl, assertSafeExternalUrl } from '../utils/urlSecurity';
import { getDocumentKindMeta } from '../lib/documents';
import RankSeal from '../components/ui/RankSeal';

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

export default function Collaborator() {
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const canManage = profile?.role === 'collaborator' || profile?.role === 'admin';

  // Form State
  const [docId, setDocId] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [educationLevel, setEducationLevel] = useState('thpt');
  const [category, setCategory] = useState('toan');
  const [major, setMajor] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [publishDate, setPublishDate] = useState('');
  const [uploadMode, setUploadMode] = useState('link'); // 'link' | 'file'
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // My Documents List State
  const [myDocuments, setMyDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const categories = educationLevel === 'university' ? UNI_CATEGORIES : THPT_CATEGORIES;

  const fetchMyDocuments = useCallback(async () => {
    if (!user) return;
    setLoadingDocs(true);
    try {
      // Query documents uploaded by this collaborator using real columns
      const { data, error } = await supabase
        .from('documents')
        .select(
          'id, title, description, category, category_id, education_level, major, author_name, file_url, file_type, file_size, is_public, is_featured, uploaded_by, created_at, uploaded_at, publish_date',
        )
        .eq('uploaded_by', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMyDocuments(data || []);
    } catch (err) {
      console.error('Lỗi tải tài liệu của tôi:', err);
      showToast('Không thể tải danh sách tài liệu: ' + err.message, 'error');
    } finally {
      setLoadingDocs(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    if (canManage) {
      fetchMyDocuments();
    }
  }, [canManage, fetchMyDocuments]);

  const resetForm = () => {
    setDocId(null);
    setTitle('');
    setDescription('');
    setAuthorName('');
    setEducationLevel('thpt');
    setCategory('toan');
    setMajor('');
    setFileUrl('');
    setPublishDate('');
    setSelectedFile(null);
    if (document.getElementById('collab-file-input')) {
      document.getElementById('collab-file-input').value = '';
    }
  };

  const handleEdit = (doc) => {
    setDocId(doc.id);
    setTitle(doc.title || '');
    setDescription(doc.description || '');
    setAuthorName(doc.author_name || '');
    setEducationLevel(doc.education_level || 'thpt');
    setCategory(doc.category || 'toan');
    setMajor(doc.major || '');
    setFileUrl(doc.file_url || '');
    setPublishDate(doc.publish_date || '');
    setUploadMode('link');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    if (!title.trim()) {
      showToast('Vui lòng nhập tiêu đề tài liệu!', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalUrl = fileUrl.trim();

      // If user uploaded a file to Supabase storage
      if (uploadMode === 'file' && selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `uploads/${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from('documents').getPublicUrl(filePath);

        finalUrl = publicUrl;
      }

      const safeUrl = assertSafeExternalUrl(finalUrl, 'Link tài liệu không hợp lệ!');

      // ONLY valid columns for public.documents
      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        category_id: category,
        education_level: educationLevel,
        major: major.trim(),
        author_name: authorName.trim() || profile?.display_name || 'Khuyết danh',
        file_url: safeUrl,
        publish_date: publishDate || null,
        uploaded_by: user.id,
        is_public: true,
      };

      if (docId) {
        const { error } = await supabase
          .from('documents')
          .update(payload)
          .eq('id', docId)
          .eq('uploaded_by', user.id);

        if (error) throw error;
        showToast('Đã cập nhật tài liệu thành công!', 'success');
      } else {
        const { error } = await supabase.from('documents').insert([payload]);
        if (error) throw error;
        showToast('Đã đăng tài liệu thành công!', 'success');
      }

      resetForm();
      fetchMyDocuments();
    } catch (err) {
      showToast('Lỗi khi lưu tài liệu: ' + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    const targetId = deleteConfirmId;
    setDeleteConfirmId(null);

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', targetId)
        .eq('uploaded_by', user.id);

      if (error) throw error;
      showToast('Đã xóa tài liệu của bạn', 'info');
      if (docId === targetId) resetForm();
      setMyDocuments((prev) => prev.filter((d) => d.id !== targetId));
    } catch (err) {
      showToast('Lỗi khi xóa tài liệu: ' + err.message, 'error');
    }
  };

  if (!canManage) {
    return <Navigate to="/home" />;
  }

  return (
    <div className="bg-background font-sans text-foreground min-h-full pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Header */}
        <header className="imperial-frame p-5 sm:p-7 mb-6 relative overflow-hidden">
          <span
            aria-hidden="true"
            className="hanzi-watermark absolute top-2 right-6 text-8xl font-bold text-jade/10"
          >
            傳道
          </span>

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="mb-2">
                <RankSeal size="sm" icon="edit_document" label="Thư Viện · Truyền Đạo Sư" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-foreground">
                Góc Đóng Góp Học Liệu
              </h1>
              <p className="text-xs sm:text-sm text-secondary-text mt-1">
                Khu vực dành cho Truyền Đạo Sư &amp; Cộng tác viên đăng tải đề thi, tài liệu và sơ đồ tư duy cho cộng đồng
              </p>
            </div>

            <Link to="/library" className="btn-arena btn-arena-secondary btn-arena-sm">
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                menu_book
              </span>
              <span>Xem Thư Viện</span>
            </Link>
          </div>
        </header>

        {/* Form and List Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Add / Edit Form */}
          <div className="lg:col-span-5">
            <form onSubmit={handleSubmit} className="paper-card p-5 space-y-4 sticky top-6">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="font-display font-bold text-base text-foreground flex items-center gap-2">
                  <span className="material-symbols-outlined text-jade" aria-hidden="true">
                    {docId ? 'edit' : 'cloud_upload'}
                  </span>
                  <span>{docId ? 'Cập nhật tài liệu' : 'Đăng tải tài liệu mới'}</span>
                </h2>
                {docId && (
                  <button
                    type="button"
                    onClick={resetForm}
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
                  placeholder="VD: Chuyên đề Hàm Số & Cực Trị Vận Dụng Cao 2027..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Mô tả nội dung tóm tắt
                </label>
                <textarea
                  rows={3}
                  placeholder="Phương pháp giải, dạng bài tập phân loại, cấu trúc..."
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
                    Tên tác giả / Biên soạn
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Ban Học Thuật DTHT..."
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="w-full px-3 py-2 bg-paper border border-border-strong rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Trường / Khối ngành
                  </label>
                  <input
                    type="text"
                    placeholder="VD: THPT Chuyên Sư Phạm..."
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    className="w-full px-3 py-2 bg-paper border border-border-strong rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Upload Mode Selector */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-surface-alt rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setUploadMode('link')}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    uploadMode === 'link'
                      ? 'bg-jade text-white'
                      : 'text-secondary-text hover:text-foreground'
                  }`}
                >
                  Dán link Sheet / Drive
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('file')}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    uploadMode === 'file'
                      ? 'bg-jade text-white'
                      : 'text-secondary-text hover:text-foreground'
                  }`}
                >
                  Tải file trực tiếp
                </button>
              </div>

              {uploadMode === 'link' ? (
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Link tài liệu (Google Sheet / Google Drive / URL) <span className="text-primary">*</span>
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={fileUrl}
                    onChange={(e) => setFileUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-paper border border-border-strong rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Chọn file tải lên (PDF, Doc)
                  </label>
                  <input
                    id="collab-file-input"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                    className="w-full text-xs text-secondary-text file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-jade-soft file:text-jade hover:file:bg-jade/20 cursor-pointer"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Ngày phát hành tài liệu (tuỳ chọn)
                </label>
                <input
                  type="date"
                  value={publishDate}
                  onChange={(e) => setPublishDate(e.target.value)}
                  className="w-full px-3 py-2 bg-paper border border-border-strong rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                {docId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="btn-arena btn-arena-secondary btn-arena-sm flex-1"
                  >
                    Hủy
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-arena btn-arena-jade btn-arena-sm flex-1"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    {isSubmitting ? 'hourglass_empty' : 'save'}
                  </span>
                  <span>
                    {isSubmitting
                      ? 'Đang tải lên...'
                      : docId
                        ? 'Cập nhật tài liệu'
                        : 'Đăng tải tài liệu'}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* List of Contributed Documents */}
          <div className="lg:col-span-7 paper-card p-5 flex flex-col">
            <h3 className="font-display font-bold text-base text-foreground mb-4 flex items-center gap-2 border-b border-border pb-3">
              <span className="material-symbols-outlined text-jade" aria-hidden="true">
                inventory_2
              </span>
              <span>Tài liệu do tôi đóng góp ({myDocuments.length})</span>
            </h3>

            {loadingDocs ? (
              <div className="py-16 flex justify-center">
                <span
                  className="material-symbols-outlined animate-spin text-3xl text-jade"
                  aria-hidden="true"
                >
                  sync
                </span>
              </div>
            ) : myDocuments.length > 0 ? (
              <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
                {myDocuments.map((doc) => {
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
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-jade-soft text-jade border border-jade-border">
                              {doc.category}
                            </span>
                          )}
                        </div>

                        <h4 className="font-display font-bold text-sm text-foreground truncate">
                          {doc.title}
                        </h4>
                        <p className="text-xs text-secondary-text truncate mt-0.5">
                          {doc.description || 'Chưa có mô tả chi tiết'}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Đăng lúc: {new Date(doc.created_at).toLocaleDateString('vi-VN')}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 no-shrink">
                        {safeUrl && (
                          <a
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-surface-alt rounded-lg transition-colors cursor-pointer"
                            title="Mở tài liệu"
                          >
                            <span className="material-symbols-outlined text-lg" aria-hidden="true">
                              open_in_new
                            </span>
                          </a>
                        )}

                        <button
                          type="button"
                          aria-label={`Chỉnh sửa tài liệu ${doc.title || ''}`.trim()}
                          onClick={() => handleEdit(doc)}
                          className="p-2 text-muted-foreground hover:text-jade hover:bg-jade-soft rounded-lg transition-colors cursor-pointer"
                          title="Sửa"
                        >
                          <span className="material-symbols-outlined text-lg" aria-hidden="true">
                            edit
                          </span>
                        </button>

                        <button
                          type="button"
                          aria-label={`Xóa tài liệu ${doc.title || ''}`.trim()}
                          onClick={() => setDeleteConfirmId(doc.id)}
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
              <div className="p-12 text-center text-sm text-secondary-text border-2 border-dashed border-border rounded-xl">
                Bạn chưa đóng góp tài liệu nào. Hãy điền form bên cạnh để đăng tải bí kíp đầu tiên!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-[110] bg-foreground/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeleteConfirmId(null)}
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
                  Xóa tài liệu đóng góp
                </h3>
                <p className="text-xs text-secondary-text mt-0.5">
                  Tài liệu này sẽ bị gỡ khỏi Thư viện và không thể hoàn tác.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="btn-arena btn-arena-secondary btn-arena-sm"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="btn-arena btn-arena-primary btn-arena-sm"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
