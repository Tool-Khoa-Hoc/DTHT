import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/ToastProvider';
import { sanitizeExternalUrl } from '../utils/urlSecurity';
import { getDocumentKindMeta } from '../lib/documents';
import RankSeal from '../components/ui/RankSeal';
import Avatar from '../components/Avatar';

const THPT_CATEGORIES = [
  { label: 'Tất cả môn', value: '' },
  { label: 'Toán', value: 'toan', icon: 'functions' },
  { label: 'Vật Lý', value: 'ly', icon: 'bolt' },
  { label: 'Hóa Học', value: 'hoa', icon: 'science' },
  { label: 'Sinh Học', value: 'sinh', icon: 'biotech' },
  { label: 'Ngữ Văn', value: 'van', icon: 'menu_book' },
  { label: 'Tiếng Anh', value: 'anh', icon: 'language' },
  { label: 'Lịch Sử', value: 'su', icon: 'history_edu' },
  { label: 'Địa Lý', value: 'dia', icon: 'public' },
  { label: 'GDCD / PL', value: 'gdcd', icon: 'gavel' },
  { label: 'Tin Học', value: 'tin', icon: 'computer' },
  { label: 'Khác', value: 'khac', icon: 'folder' },
];

const UNI_CATEGORIES = [
  { label: 'Tất cả học phần', value: '' },
  { label: 'Giải Tích / Toán CC', value: 'giai_tich', icon: 'functions' },
  { label: 'Lập Trình / CNTT', value: 'lap_trinh', icon: 'code' },
  { label: 'Kinh Tế / QTKD', value: 'kinh_te', icon: 'trending_up' },
  { label: 'Kiến Trúc / Kỹ Thuật', value: 'kien_truc', icon: 'architecture' },
  { label: 'Khác', value: 'khac', icon: 'folder' },
];

const REPORT_REASONS = [
  'Link tài liệu bị lỗi hoặc không mở được',
  'Nội dung sai lệch kiến thức hoặc thông tin sai',
  'Tài liệu không phù hợp hoặc trùng lặp',
  'Vi phạm bản quyền',
  'Lý do khác',
];

export default function Library() {
  const { user, isAdmin, isCollaborator } = useAuth();
  const { showToast } = useToast();

  const [educationLevel, setEducationLevel] = useState('all'); // 'all' | 'thpt' | 'university'
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Saved bookmark IDs
  const [savedDocIds, setSavedDocIds] = useState(new Set());
  const [bookmarkingId, setBookmarkingId] = useState(null);

  // Detail Modal State
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newReviewText, setNewReviewText] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Report Modal State
  const [reportingDoc, setReportingDoc] = useState(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [customReportReason, setCustomReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Fetch Public Documents
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      // Query REAL columns on public.documents
      let query = supabase
        .from('documents')
        .select(
          'id, title, description, category, category_id, education_level, major, author_name, file_url, file_type, file_size, downloads_count, avg_rating, is_public, is_featured, uploaded_by, created_at, uploaded_at, publish_date',
        )
        .eq('is_public', true)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });

      if (educationLevel !== 'all') {
        query = query.eq('education_level', educationLevel);
      }

      if (selectedCategory) {
        query = query.eq('category', selectedCategory);
      }

      const { data, error } = await query.limit(200);
      if (error) throw error;
      setDocuments(data || []);
    } catch (err) {
      console.error('Lỗi tải tài liệu:', err.message);
      showToast('Không thể tải kho tài liệu: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [educationLevel, selectedCategory, showToast]);

  // Fetch Saved Bookmarks for logged in user
  const fetchSavedBookmarks = useCallback(async () => {
    if (!user) {
      setSavedDocIds(new Set());
      return;
    }
    try {
      const { data, error } = await supabase
        .from('user_saved_documents')
        .select('document_id')
        .eq('user_id', user.id);

      if (!error && data) {
        setSavedDocIds(new Set(data.map((d) => d.document_id)));
      }
    } catch (err) {
      console.error('Lỗi tải danh sách đã lưu:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    fetchSavedBookmarks();
  }, [fetchSavedBookmarks]);

  // Toggle Bookmark
  const handleToggleBookmark = async (docId, e) => {
    if (e) e.stopPropagation();
    if (!user) {
      showToast('Vui lòng đăng nhập để lưu tài liệu vào Tàng Thư riêng!', 'warning');
      return;
    }

    setBookmarkingId(docId);
    const isCurrentlySaved = savedDocIds.has(docId);
    try {
      if (isCurrentlySaved) {
        const { error } = await supabase
          .from('user_saved_documents')
          .delete()
          .eq('user_id', user.id)
          .eq('document_id', docId);

        if (error) throw error;
        setSavedDocIds((prev) => {
          const next = new Set(prev);
          next.delete(docId);
          return next;
        });
        showToast('Đã xóa khỏi tài liệu đã lưu', 'info', 2000);
      } else {
        const { error } = await supabase
          .from('user_saved_documents')
          .insert([{ user_id: user.id, document_id: docId }]);

        if (error) throw error;
        setSavedDocIds((prev) => new Set(prev).add(docId));
        showToast('Đã lưu tài liệu vào Tàng Thư của bạn', 'success', 2000);
      }
    } catch (err) {
      showToast('Lỗi cập nhật lưu trữ: ' + err.message, 'error');
    } finally {
      setBookmarkingId(null);
    }
  };

  // Open Document Detail
  const handleOpenDoc = (doc) => {
    setSelectedDoc(doc);
    fetchDocReviews(doc.id);
  };

  const fetchDocReviews = async (docId) => {
    setLoadingReviews(true);
    try {
      const { data, error } = await supabase
        .from('document_reviews')
        .select('id, document_id, user_id, rating, review_text, created_at')
        .eq('document_id', docId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setReviews(data);
      }
    } catch (err) {
      console.error('Lỗi tải đánh giá:', err);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleAddReview = async (e) => {
    e.preventDefault();
    if (!user) {
      showToast('Vui lòng đăng nhập để gửi đánh giá!', 'warning');
      return;
    }
    if (!newReviewText.trim()) {
      showToast('Vui lòng nhập cảm nhận về tài liệu!', 'warning');
      return;
    }

    setIsSubmittingReview(true);
    try {
      const { data, error } = await supabase
        .from('document_reviews')
        .insert([
          {
            document_id: selectedDoc.id,
            user_id: user.id,
            rating: Number(newRating) || 5,
            review_text: newReviewText.trim(),
          },
        ])
        .select()
        .single();

      if (error) throw error;
      setReviews((prev) => [data, ...prev]);
      setNewReviewText('');
      showToast('Cảm ơn bạn đã gửi đánh giá!', 'success');
    } catch (err) {
      showToast('Lỗi khi gửi đánh giá: ' + err.message, 'error');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleOpenReport = (doc, e) => {
    if (e) e.stopPropagation();
    if (!user) {
      showToast('Vui lòng đăng nhập để báo cáo tài liệu!', 'warning');
      return;
    }
    setReportingDoc(doc);
    setReportReason(REPORT_REASONS[0]);
    setCustomReportReason('');
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!user || !reportingDoc) return;

    const finalReason =
      reportReason === 'Lý do khác' && customReportReason.trim()
        ? customReportReason.trim()
        : reportReason;

    setIsSubmittingReport(true);
    try {
      const { error } = await supabase.from('document_reports').insert([
        {
          document_id: reportingDoc.id,
          reported_by: user.id,
          reason: finalReason,
        },
      ]);

      if (error) throw error;
      showToast('Đã gửi báo cáo. Ban quản trị sẽ kiểm tra sớm nhất!', 'success');
      setReportingDoc(null);
    } catch (err) {
      showToast('Lỗi gửi báo cáo: ' + err.message, 'error');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Filtered documents
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      if (showSavedOnly && !savedDocIds.has(doc.id)) {
        return false;
      }
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const inTitle = (doc.title || '').toLowerCase().includes(q);
      const inDesc = (doc.description || '').toLowerCase().includes(q);
      const inAuthor = (doc.author_name || '').toLowerCase().includes(q);
      const inMajor = (doc.major || '').toLowerCase().includes(q);
      return inTitle || inDesc || inAuthor || inMajor;
    });
  }, [documents, searchQuery, showSavedOnly, savedDocIds]);

  const activeCategoryList =
    educationLevel === 'university' ? UNI_CATEGORIES : THPT_CATEGORIES;

  return (
    <div className="bg-background font-sans text-foreground min-h-full pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Header */}
        <header className="imperial-frame p-5 sm:p-7 mb-6 relative overflow-hidden">
          <span
            aria-hidden="true"
            className="hanzi-watermark absolute top-2 right-6 text-8xl font-bold text-accent/8"
          >
            藏書
          </span>

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <div className="mb-2">
                <RankSeal size="sm" icon="library_books" label="Tàng Thư Các · Học liệu miễn phí" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-foreground">
                Thư Viện Tài Liệu Free
              </h1>
              <p className="text-xs sm:text-sm text-secondary-text mt-1">
                Kho đề thi thử, chuyên đề và sơ đồ tư duy chọn lọc cho học sinh THPT &amp; Đại học
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to="/hoc-online"
                className="btn-arena btn-arena-gold btn-arena-sm"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  cast_for_education
                </span>
                <span>Mở Kho Học Online</span>
              </Link>
              {(isAdmin || isCollaborator) && (
                <Link
                  to={isAdmin ? '/admin' : '/collaborator'}
                  className="btn-arena btn-arena-primary btn-arena-sm"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    cloud_upload
                  </span>
                  <span>Đăng tài liệu</span>
                </Link>
              )}
            </div>
          </div>

          {/* Search Bar & Saved Toggle */}
          <div className="relative z-10 flex flex-col md:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <span
                className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              >
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm theo tên tài liệu, môn học, tác giả, chuyên ngành..."
                className="w-full pl-12 pr-10 py-3 bg-surface border border-border-strong rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-sm text-foreground placeholder:text-muted-foreground transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Xóa tìm kiếm"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">
                    close
                  </span>
                </button>
              )}
            </div>

            {user && (
              <button
                type="button"
                onClick={() => setShowSavedOnly(!showSavedOnly)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-bold transition-all cursor-pointer no-shrink ${
                  showSavedOnly
                    ? 'bg-primary-soft text-primary border-primary/40 shadow-xs'
                    : 'bg-surface border-border text-secondary-text hover:text-foreground hover:border-border-strong'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-base ${
                    showSavedOnly ? 'icon-fill text-primary' : ''
                  }`}
                  aria-hidden="true"
                >
                  bookmark
                </span>
                <span>Đã lưu ({savedDocIds.size})</span>
              </button>
            )}
          </div>

          {/* Education Level Selector */}
          <div className="relative z-10 flex flex-wrap items-center gap-2 pt-2 border-t border-border">
            <span className="text-xs font-bold text-secondary-text mr-1">Cấp học:</span>
            {[
              { id: 'all', label: 'Tất cả cấp học' },
              { id: 'thpt', label: 'THPT (Lớp 10 · 11 · 12)' },
              { id: 'university', label: 'Đại học' },
            ].map((lvl) => (
              <button
                key={lvl.id}
                type="button"
                onClick={() => {
                  setEducationLevel(lvl.id);
                  setSelectedCategory('');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  educationLevel === lvl.id
                    ? 'bg-primary text-white border-primary'
                    : 'bg-surface border-border text-secondary-text hover:text-foreground'
                }`}
              >
                {lvl.label}
              </button>
            ))}
          </div>

          {/* Category Chips */}
          <div className="relative z-10 flex gap-2 overflow-x-auto pb-1 mt-3 no-scrollbar">
            {activeCategoryList.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setSelectedCategory(cat.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                  selectedCategory === cat.value
                    ? 'bg-gold-soft text-gold-dark border-gold shadow-2xs'
                    : 'bg-surface border-border text-secondary-text hover:text-foreground'
                }`}
              >
                {cat.icon && (
                  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                    {cat.icon}
                  </span>
                )}
                {cat.label}
              </button>
            ))}
          </div>
        </header>

        {/* Documents Grid */}
        <main>
          {loading ? (
            <div className="flex justify-center py-20">
              <span
                className="material-symbols-outlined animate-spin text-4xl text-primary"
                aria-hidden="true"
              >
                sync
              </span>
            </div>
          ) : filteredDocs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocs.map((doc) => {
                const kind = getDocumentKindMeta(doc.title, doc.file_url);
                const safeUrl = sanitizeExternalUrl(doc.file_url);
                const isSaved = savedDocIds.has(doc.id);

                return (
                  <div
                    key={doc.id}
                    onClick={() => handleOpenDoc(doc)}
                    className={`group relative paper-card paper-card-interactive p-5 flex flex-col justify-between cursor-pointer ${
                      doc.is_featured ? 'border-gold ring-1 ring-gold/40' : ''
                    }`}
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${kind.badgeClass}`}
                          >
                            <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                              {kind.icon}
                            </span>
                            {kind.label}
                          </span>

                          {doc.is_featured && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-gold-soft text-gold-dark border border-gold">
                              <span className="material-symbols-outlined text-[11px] icon-fill" aria-hidden="true">
                                star
                              </span>
                              Nổi bật
                            </span>
                          )}

                          <span className="text-[10px] uppercase font-bold text-secondary-text">
                            {doc.education_level === 'university' ? 'ĐH' : 'THPT'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={isSaved ? 'Bỏ lưu tài liệu' : 'Lưu tài liệu vào Tàng Thư'}
                            onClick={(e) => handleToggleBookmark(doc.id, e)}
                            disabled={bookmarkingId === doc.id}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isSaved
                                ? 'text-primary bg-primary-soft'
                                : 'text-muted-foreground hover:text-foreground hover:bg-surface-alt'
                            }`}
                            title={isSaved ? 'Bỏ lưu' : 'Lưu tài liệu'}
                          >
                            <span
                              className={`material-symbols-outlined text-lg ${
                                isSaved ? 'icon-fill' : ''
                              }`}
                              aria-hidden="true"
                            >
                              bookmark
                            </span>
                          </button>

                          <button
                            type="button"
                            aria-label="Báo cáo tài liệu hoặc sự cố link"
                            onClick={(e) => handleOpenReport(doc, e)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary-soft transition-colors cursor-pointer"
                            title="Báo lỗi link"
                          >
                            <span className="material-symbols-outlined text-lg" aria-hidden="true">
                              flag
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Title & Description */}
                      <h3 className="font-display font-bold text-base text-foreground mb-1.5 line-clamp-2 group-hover:text-primary transition-colors">
                        {doc.title}
                      </h3>
                      <p className="text-xs text-secondary-text line-clamp-3 leading-relaxed mb-4">
                        {doc.description || 'Tài liệu tuyển chọn, chuyên đề ôn tập trọng tâm.'}
                      </p>
                    </div>

                    {/* Meta Footer */}
                    <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                          person
                        </span>
                        <span className="truncate max-w-[120px]">
                          {doc.author_name || 'Khuyết danh'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 no-shrink font-bold">
                        {safeUrl ? (
                          <a
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-primary hover:text-primary-hover hover:underline"
                          >
                            <span>{kind.actionLabel}</span>
                            <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                              open_in_new
                            </span>
                          </a>
                        ) : (
                          <span className="text-primary/70">Mở xem chi tiết</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 paper-card border-dashed max-w-lg mx-auto my-8 p-6">
              <div className="w-16 h-16 rounded-2xl bg-primary-soft border border-primary/30 text-primary flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl" aria-hidden="true">
                  folder_off
                </span>
              </div>
              <h3 className="font-display font-bold text-lg text-foreground mb-1">
                Không tìm thấy tài liệu phù hợp
              </h3>
              <p className="text-xs text-secondary-text mb-6 max-w-xs mx-auto leading-relaxed">
                Hãy thử đổi từ khóa tìm kiếm hoặc chọn cấp học và bộ lọc môn học khác.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('');
                  setEducationLevel('all');
                  setShowSavedOnly(false);
                }}
                className="btn-arena btn-arena-secondary btn-arena-sm"
              >
                Đặt lại bộ lọc
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Document Detail Modal */}
      {selectedDoc && (
        <div
          className="fixed inset-0 z-[100] bg-foreground/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedDoc(null)}
        >
          <div
            className="imperial-frame w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-border bg-paper flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-primary-soft text-primary border border-primary/30">
                    {selectedDoc.education_level === 'university' ? 'Đại học' : 'THPT'}
                  </span>
                  {selectedDoc.category && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-alt text-secondary-text border border-border">
                      {selectedDoc.category}
                    </span>
                  )}
                  {selectedDoc.major && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-jade-soft text-jade border border-jade-border">
                      {selectedDoc.major}
                    </span>
                  )}
                </div>
                <h2 className="font-display font-bold text-lg sm:text-xl text-foreground leading-snug">
                  {selectedDoc.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDoc(null)}
                aria-label="Đóng"
                className="p-2 rounded-xl text-muted-foreground hover:bg-surface-alt hover:text-foreground transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl" aria-hidden="true">
                  close
                </span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* Description */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-secondary-text mb-2">
                  Mô tả tài liệu
                </h4>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line bg-paper p-4 rounded-xl border border-border">
                  {selectedDoc.description || 'Tài liệu này chưa có mô tả chi tiết từ tác giả.'}
                </p>
              </div>

              {/* Meta information */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-paper border border-border">
                  <div className="text-[10px] text-secondary-text">Tác giả</div>
                  <div className="font-bold text-xs text-foreground mt-0.5 truncate">
                    {selectedDoc.author_name || 'Khuyết danh'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-paper border border-border">
                  <div className="text-[10px] text-secondary-text">Ngày tải lên</div>
                  <div className="font-bold text-xs text-foreground mt-0.5">
                    {new Date(selectedDoc.created_at).toLocaleDateString('vi-VN')}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-paper border border-border">
                  <div className="text-[10px] text-secondary-text">Định dạng</div>
                  <div className="font-bold text-xs text-foreground mt-0.5 uppercase">
                    {selectedDoc.file_type || 'Link / Sheet'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-paper border border-border">
                  <div className="text-[10px] text-secondary-text">Đánh giá TB</div>
                  <div className="font-bold text-xs text-accent mt-0.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs icon-fill" aria-hidden="true">
                      star
                    </span>
                    <span>{Number(selectedDoc.avg_rating || 5).toFixed(1)} / 5</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                {sanitizeExternalUrl(selectedDoc.file_url) ? (
                  <a
                    href={sanitizeExternalUrl(selectedDoc.file_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-arena btn-arena-primary flex-1 text-center justify-center"
                  >
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">
                      open_in_new
                    </span>
                    <span>Mở / Tải tài liệu ngay</span>
                  </a>
                ) : (
                  <span className="btn-arena btn-arena-secondary flex-1 text-center justify-center opacity-60">
                    Link tài liệu không khả dụng
                  </span>
                )}

                <button
                  type="button"
                  onClick={(e) => handleToggleBookmark(selectedDoc.id, e)}
                  className={`btn-arena btn-arena-secondary no-shrink ${
                    savedDocIds.has(selectedDoc.id) ? 'text-primary border-primary/40' : ''
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-lg ${
                      savedDocIds.has(selectedDoc.id) ? 'icon-fill' : ''
                    }`}
                    aria-hidden="true"
                  >
                    bookmark
                  </span>
                  <span>{savedDocIds.has(selectedDoc.id) ? 'Đã lưu' : 'Lưu lại'}</span>
                </button>

                <button
                  type="button"
                  aria-label="Báo cáo tài liệu hoặc link hỏng"
                  onClick={(e) => handleOpenReport(selectedDoc, e)}
                  className="btn-arena btn-arena-secondary no-shrink text-muted-foreground hover:text-primary"
                  title="Báo cáo link hỏng"
                >
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">
                    flag
                  </span>
                </button>
              </div>

              {/* Reviews Section */}
              <div className="pt-4 border-t border-border space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-display font-bold text-foreground flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-accent text-lg" aria-hidden="true">
                      reviews
                    </span>
                    Đánh giá từ người học ({reviews.length})
                  </h4>
                </div>

                {/* Submit Review */}
                {user ? (
                  <form
                    onSubmit={handleAddReview}
                    className="p-4 rounded-xl bg-paper border border-border space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">
                        Bạn đánh giá tài liệu này thế nào?
                      </span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            aria-label={`Đánh giá ${star} sao`}
                            onClick={() => setNewRating(star)}
                            className="text-accent cursor-pointer hover:scale-110 transition-transform"
                          >
                            <span
                              className={`material-symbols-outlined text-lg ${
                                star <= newRating ? 'icon-fill' : ''
                              }`}
                              aria-hidden="true"
                            >
                              star
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <input
                      type="text"
                      value={newReviewText}
                      onChange={(e) => setNewReviewText(e.target.value)}
                      placeholder="Chia sẻ nhận xét ngắn của bạn về tài liệu này..."
                      className="w-full px-3 py-2 bg-surface border border-border-strong rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                    />

                    <div className="text-right">
                      <button
                        type="submit"
                        disabled={isSubmittingReview}
                        className="btn-arena btn-arena-primary btn-arena-sm"
                      >
                        {isSubmittingReview ? 'Đang gửi...' : 'Gửi nhận xét'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="text-xs text-secondary-text italic p-3 rounded-xl bg-paper border border-border text-center">
                    <Link to="/auth" className="text-primary font-bold hover:underline">
                      Đăng nhập
                    </Link>{' '}
                    để để lại đánh giá và nhận xét cho tài liệu này.
                  </p>
                )}

                {/* Review List */}
                <div className="space-y-2.5">
                  {loadingReviews ? (
                    <div className="py-4 text-center">
                      <span className="material-symbols-outlined animate-spin text-primary" aria-hidden="true">
                        sync
                      </span>
                    </div>
                  ) : reviews.length > 0 ? (
                    reviews.map((r) => (
                      <div
                        key={r.id}
                        className="p-3 rounded-xl bg-paper border border-border text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-muted-foreground">
                          <div className="flex items-center gap-1 text-accent">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <span
                                key={s}
                                className={`material-symbols-outlined text-xs ${
                                  s <= r.rating ? 'icon-fill' : ''
                                }`}
                                aria-hidden="true"
                              >
                                star
                              </span>
                            ))}
                          </div>
                          <span>{new Date(r.created_at).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <p className="text-foreground leading-relaxed">{r.review_text}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground italic text-center py-2">
                      Chưa có đánh giá nào cho tài liệu này.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportingDoc && (
        <div
          className="fixed inset-0 z-[110] bg-foreground/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setReportingDoc(null)}
        >
          <div
            className="imperial-frame w-full max-w-md p-6 bg-surface shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center no-shrink">
                <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                  flag
                </span>
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-foreground">
                  Báo cáo sự cố tài liệu
                </h3>
                <p className="text-xs text-secondary-text mt-0.5 truncate max-w-[260px]">
                  {reportingDoc.title}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitReport} className="space-y-3 pt-2">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-foreground">Lý do báo cáo:</label>
                {REPORT_REASONS.map((reason) => (
                  <label
                    key={reason}
                    className="flex items-center gap-2 p-2.5 rounded-xl border border-border hover:bg-paper cursor-pointer text-xs"
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      value={reason}
                      checked={reportReason === reason}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-foreground">{reason}</span>
                  </label>
                ))}
              </div>

              {reportReason === 'Lý do khác' && (
                <div>
                  <textarea
                    rows={3}
                    placeholder="Mô tả chi tiết vấn đề bạn gặp phải..."
                    value={customReportReason}
                    onChange={(e) => setCustomReportReason(e.target.value)}
                    className="w-full p-2.5 bg-paper border border-border-strong rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReportingDoc(null)}
                  className="btn-arena btn-arena-secondary btn-arena-sm"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="btn-arena btn-arena-primary btn-arena-sm"
                >
                  {isSubmittingReport ? 'Đang gửi...' : 'Gửi báo cáo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
