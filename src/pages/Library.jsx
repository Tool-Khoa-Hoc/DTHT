import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../components/ui/ToastProvider';
import { sanitizeExternalUrl } from '../utils/urlSecurity';
import { getDocumentKindMeta } from '../lib/documents';
import RankSeal from '../components/ui/RankSeal';

const THPT_CATEGORIES = [
  { labelVi: 'Tất cả môn', labelEn: 'All Subjects', value: '' },
  { labelVi: 'Toán', labelEn: 'Mathematics', value: 'toan', icon: 'functions' },
  { labelVi: 'Vật Lý', labelEn: 'Physics', value: 'ly', icon: 'bolt' },
  { labelVi: 'Hóa Học', labelEn: 'Chemistry', value: 'hoa', icon: 'science' },
  { labelVi: 'Sinh Học', labelEn: 'Biology', value: 'sinh', icon: 'biotech' },
  { labelVi: 'Ngữ Văn', labelEn: 'Literature', value: 'van', icon: 'menu_book' },
  { labelVi: 'Tiếng Anh', labelEn: 'English', value: 'anh', icon: 'language' },
  { labelVi: 'Lịch Sử', labelEn: 'History', value: 'su', icon: 'history_edu' },
  { labelVi: 'Địa Lý', labelEn: 'Geography', value: 'dia', icon: 'public' },
  { labelVi: 'GDCD / PL', labelEn: 'Civics & Law', value: 'gdcd', icon: 'gavel' },
  { labelVi: 'Tin Học', labelEn: 'Informatics', value: 'tin', icon: 'computer' },
  { labelVi: 'Khác', labelEn: 'Other', value: 'khac', icon: 'folder' },
];

const UNI_CATEGORIES = [
  { labelVi: 'Tất cả học phần', labelEn: 'All Courses', value: '' },
  { labelVi: 'Giải Tích / Toán CC', labelEn: 'Calculus & Higher Math', value: 'giai_tich', icon: 'functions' },
  { labelVi: 'Lập Trình / CNTT', labelEn: 'Programming & IT', value: 'lap_trinh', icon: 'code' },
  { labelVi: 'Kinh Tế / QTKD', labelEn: 'Economics & Business', value: 'kinh_te', icon: 'trending_up' },
  { labelVi: 'Kiến Trúc / Kỹ Thuật', labelEn: 'Architecture & Engineering', value: 'kien_truc', icon: 'architecture' },
  { labelVi: 'Khác', labelEn: 'Other', value: 'khac', icon: 'folder' },
];

const CATEGORY_LABELS_MAP = {
  toan: { vi: 'Toán', en: 'Mathematics' },
  ly: { vi: 'Vật Lý', en: 'Physics' },
  hoa: { vi: 'Hóa Học', en: 'Chemistry' },
  sinh: { vi: 'Sinh Học', en: 'Biology' },
  van: { vi: 'Ngữ Văn', en: 'Literature' },
  anh: { vi: 'Tiếng Anh', en: 'English' },
  su: { vi: 'Lịch Sử', en: 'History' },
  dia: { vi: 'Địa Lý', en: 'Geography' },
  gdcd: { vi: 'GDCD / PL', en: 'Civics & Law' },
  tin: { vi: 'Tin Học', en: 'Informatics' },
  giai_tich: { vi: 'Giải Tích / Toán CC', en: 'Calculus & Higher Math' },
  lap_trinh: { vi: 'Lập Trình / CNTT', en: 'Programming & IT' },
  kinh_te: { vi: 'Kinh Tế / QTKD', en: 'Economics & Business' },
  kien_truc: { vi: 'Kiến Trúc / Kỹ Thuật', en: 'Architecture & Engineering' },
  khac: { vi: 'Khác', en: 'Other' },
  Toán: { vi: 'Toán', en: 'Mathematics' },
  'Vật Lý': { vi: 'Vật Lý', en: 'Physics' },
  'Vật lý': { vi: 'Vật lý', en: 'Physics' },
  'Hóa Học': { vi: 'Hóa Học', en: 'Chemistry' },
  'Hóa học': { vi: 'Hóa học', en: 'Chemistry' },
  'Sinh Học': { vi: 'Sinh Học', en: 'Biology' },
  'Sinh học': { vi: 'Sinh học', en: 'Biology' },
  'Ngữ Văn': { vi: 'Ngữ Văn', en: 'Literature' },
  'Ngữ văn': { vi: 'Ngữ văn', en: 'Literature' },
  'Tiếng Anh': { vi: 'Tiếng Anh', en: 'English' },
  'Lịch Sử': { vi: 'Lịch Sử', en: 'History' },
  'Lịch sử': { vi: 'Lịch sử', en: 'History' },
  'Địa Lý': { vi: 'Địa Lý', en: 'Geography' },
  'Địa lý': { vi: 'Địa lý', en: 'Geography' },
  GDCD: { vi: 'GDCD', en: 'Civics' },
  'Tin Học': { vi: 'Tin Học', en: 'Informatics' },
  'Tin học': { vi: 'Tin học', en: 'Informatics' },
  Khác: { vi: 'Khác', en: 'Other' },
};

function getCategoryDisplayLabel(rawCat, isEn) {
  if (!rawCat) return '';
  const mapped = CATEGORY_LABELS_MAP[rawCat];
  if (mapped) return isEn ? mapped.en : mapped.vi;
  return rawCat;
}

const OTHER_REPORT_REASON_VALUE = 'Lý do khác';

const REPORT_REASONS = [
  {
    value: 'Link tài liệu bị lỗi hoặc không mở được',
    labelVi: 'Link tài liệu bị lỗi hoặc không mở được',
    labelEn: 'Broken or inaccessible resource link',
  },
  {
    value: 'Nội dung sai lệch kiến thức hoặc thông tin sai',
    labelVi: 'Nội dung sai lệch kiến thức hoặc thông tin sai',
    labelEn: 'Inaccurate academic content or misleading information',
  },
  {
    value: 'Tài liệu không phù hợp hoặc trùng lặp',
    labelVi: 'Tài liệu không phù hợp hoặc trùng lặp',
    labelEn: 'Inappropriate or duplicate resource',
  },
  {
    value: 'Vi phạm bản quyền',
    labelVi: 'Vi phạm bản quyền',
    labelEn: 'Copyright infringement',
  },
  {
    value: OTHER_REPORT_REASON_VALUE,
    labelVi: 'Lý do khác',
    labelEn: 'Other reason',
  },
];

export default function Library() {
  const { user, isAdmin, isCollaborator } = useAuth();
  const { lang, isEn, pick, formatNumber, formatDate } = useLanguage();
  const { showToast } = useToast();

  const [educationLevel, setEducationLevel] = useState('all'); // 'all' | 'thpt' | 'university'
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [sortBy, setSortBy] = useState('featured'); // 'featured' | 'newest' | 'rating'

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
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0].value);
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
      showToast(
        pick('Không thể tải kho tài liệu: ', 'Unable to load library resources: ') + err.message,
        'error',
      );
    } finally {
      setLoading(false);
    }
  }, [educationLevel, selectedCategory, showToast, pick]);

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
      showToast(
        pick(
          'Vui lòng đăng nhập để lưu tài liệu vào Tàng Thư riêng!',
          'Please sign in to save resources to your personal library!',
        ),
        'warning',
      );
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
        showToast(pick('Đã xóa khỏi tài liệu đã lưu', 'Removed from saved resources'), 'info', 2000);
      } else {
        const { error } = await supabase
          .from('user_saved_documents')
          .insert([{ user_id: user.id, document_id: docId }]);

        if (error) throw error;
        setSavedDocIds((prev) => new Set(prev).add(docId));
        showToast(
          pick('Đã lưu tài liệu vào Tàng Thư của bạn', 'Saved to your personal library'),
          'success',
          2000,
        );
      }
    } catch (err) {
      showToast(
        pick('Lỗi cập nhật lưu trữ: ', 'Failed to update bookmark: ') + err.message,
        'error',
      );
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
      showToast(
        pick('Vui lòng đăng nhập để gửi đánh giá!', 'Please sign in to submit a review!'),
        'warning',
      );
      return;
    }
    if (!newReviewText.trim()) {
      showToast(
        pick('Vui lòng nhập cảm nhận về tài liệu!', 'Please enter your review comment!'),
        'warning',
      );
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
      showToast(pick('Cảm ơn bạn đã gửi đánh giá!', 'Thank you for your review!'), 'success');
    } catch (err) {
      showToast(
        pick('Lỗi khi gửi đánh giá: ', 'Failed to submit review: ') + err.message,
        'error',
      );
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleOpenReport = (doc, e) => {
    if (e) e.stopPropagation();
    if (!user) {
      showToast(
        pick('Vui lòng đăng nhập để báo cáo tài liệu!', 'Please sign in to report a resource!'),
        'warning',
      );
      return;
    }
    setReportingDoc(doc);
    setReportReason(REPORT_REASONS[0].value);
    setCustomReportReason('');
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!user || !reportingDoc) return;

    const finalReason =
      reportReason === OTHER_REPORT_REASON_VALUE && customReportReason.trim()
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
      showToast(
        pick(
          'Đã gửi báo cáo. Ban quản trị sẽ kiểm tra sớm nhất!',
          'Report submitted. Our moderators will inspect it shortly!',
        ),
        'success',
      );
      setReportingDoc(null);
    } catch (err) {
      showToast(pick('Lỗi gửi báo cáo: ', 'Failed to submit report: ') + err.message, 'error');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Filtered & sorted documents
  const filteredDocs = useMemo(() => {
    const matched = documents.filter((doc) => {
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

    if (sortBy === 'newest') {
      return [...matched].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      );
    }
    if (sortBy === 'rating') {
      return [...matched].sort(
        (a, b) => (Number(b.avg_rating) || 5) - (Number(a.avg_rating) || 5),
      );
    }
    return matched;
  }, [documents, searchQuery, showSavedOnly, savedDocIds, sortBy]);

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
                <RankSeal
                  size="sm"
                  icon="library_books"
                  label={pick(
                    'Tàng Thư Các · Học liệu miễn phí',
                    'Imperial Library · Free Study Resources',
                  )}
                />
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-foreground">
                {pick('Thư Viện Tài Liệu Free', 'Free Resource Library')}
              </h1>
              <p className="text-xs sm:text-sm text-secondary-text mt-1">
                {pick(
                  'Kho đề thi thử, chuyên đề và sơ đồ tư duy chọn lọc cho học sinh THPT & Đại học',
                  'Curated mock exams, topic guides, and mind maps for High School & University scholars',
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Link to="/hoc-online" className="btn-arena btn-arena-gold btn-arena-sm">
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  cast_for_education
                </span>
                <span>{pick('Mở Kho Học Online', 'Open Online Study Hub')}</span>
              </Link>
              {(isAdmin || isCollaborator) && (
                <Link
                  to={isAdmin ? '/admin' : '/collaborator'}
                  className="btn-arena btn-arena-primary btn-arena-sm"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    cloud_upload
                  </span>
                  <span>{pick('Đăng tài liệu', 'Upload Resource')}</span>
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
                placeholder={pick(
                  'Tìm kiếm theo tên tài liệu, môn học, tác giả, chuyên ngành...',
                  'Search by resource title, subject, author, or major...',
                )}
                className="w-full pl-12 pr-10 py-3 bg-surface border border-border-strong rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-sm text-foreground placeholder:text-muted-foreground transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={pick('Xóa tìm kiếm', 'Clear search')}
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
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-bold transition-all cursor-pointer shrink-0 ${
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
                <span>
                  {pick('Đã lưu', 'Saved')} ({formatNumber(savedDocIds.size)})
                </span>
              </button>
            )}
          </div>

          {/* Education Level Selector & Sort Controls */}
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-secondary-text mr-1">
                {pick('Cấp học:', 'Level:')}
              </span>
              {[
                { id: 'all', label: pick('Tất cả cấp học', 'All Levels') },
                { id: 'thpt', label: pick('THPT (Lớp 10 · 11 · 12)', 'High School (Grades 10–12)') },
                { id: 'university', label: pick('Đại học', 'University') },
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
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-surface border-border text-secondary-text hover:text-foreground hover:border-border-strong'
                  }`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-secondary-text mr-0.5">
                {pick('Sắp xếp:', 'Sort:')}
              </span>
              {[
                { id: 'featured', label: pick('Nổi bật', 'Featured') },
                { id: 'newest', label: pick('Mới nhất', 'Newest') },
                { id: 'rating', label: pick('Đánh giá cao', 'Top Rated') },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSortBy(opt.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    sortBy === opt.id
                      ? 'bg-surface-alt text-primary border-border-strong'
                      : 'bg-surface border-border text-secondary-text hover:text-foreground hover:border-border-strong'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category Chips */}
          <div className="relative z-10 flex flex-wrap gap-2 mt-3">
            {activeCategoryList.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setSelectedCategory(cat.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                  selectedCategory === cat.value
                    ? 'bg-gold-soft text-gold-dark border-gold shadow-2xs'
                    : 'bg-surface border-border text-secondary-text hover:text-foreground hover:border-border-strong'
                }`}
              >
                {cat.icon && (
                  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                    {cat.icon}
                  </span>
                )}
                <span>{isEn ? cat.labelEn : cat.labelVi}</span>
              </button>
            ))}
          </div>
        </header>

        {/* Documents Grid */}
        <main>
          {loading ? (
            <div
              className="flex justify-center py-20"
              role="status"
              aria-label={pick('Đang tải kho tài liệu', 'Loading library resources')}
            >
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
                const kind = getDocumentKindMeta(doc.title, doc.file_url, lang);
                const safeUrl = sanitizeExternalUrl(doc.file_url);
                const isSaved = savedDocIds.has(doc.id);
                const uploadDateText = formatDate(doc.created_at);

                return (
                  <div
                    key={doc.id}
                    onClick={() => handleOpenDoc(doc)}
                    className={`group relative paper-card paper-card-interactive p-5 flex flex-col justify-between cursor-pointer border transition-all ${
                      doc.is_featured
                        ? 'border-gold ring-1 ring-gold/40 hover:border-gold'
                        : 'border-border hover:border-border-strong'
                    }`}
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
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
                              <span
                                className="material-symbols-outlined text-[11px] icon-fill"
                                aria-hidden="true"
                              >
                                star
                              </span>
                              {pick('Nổi bật', 'Featured')}
                            </span>
                          )}

                          <span className="text-[10px] uppercase font-bold text-secondary-text">
                            {doc.education_level === 'university'
                              ? pick('ĐH', 'UNI')
                              : pick('THPT', 'HS')}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            aria-label={
                              isSaved
                                ? pick('Bỏ lưu tài liệu', 'Remove bookmark')
                                : pick('Lưu tài liệu vào Tàng Thư', 'Save resource to library')
                            }
                            onClick={(e) => handleToggleBookmark(doc.id, e)}
                            disabled={bookmarkingId === doc.id}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isSaved
                                ? 'text-primary bg-primary-soft'
                                : 'text-muted-foreground hover:text-foreground hover:bg-surface-alt'
                            }`}
                            title={
                              isSaved
                                ? pick('Bỏ lưu', 'Remove bookmark')
                                : pick('Lưu tài liệu', 'Bookmark resource')
                            }
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
                            aria-label={pick(
                              'Báo cáo tài liệu hoặc sự cố link',
                              'Report resource or broken link',
                            )}
                            onClick={(e) => handleOpenReport(doc, e)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary-soft transition-colors cursor-pointer"
                            title={pick('Báo lỗi link', 'Report issue')}
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
                        {doc.description ||
                          pick(
                            'Tài liệu tuyển chọn, chuyên đề ôn tập trọng tâm.',
                            'Curated study material covering core exam topics.',
                          )}
                      </p>
                    </div>

                    {/* Meta Footer */}
                    <div className="pt-3 mt-auto border-t border-border flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="material-symbols-outlined text-[14px] shrink-0"
                          aria-hidden="true"
                        >
                          person
                        </span>
                        <span className="truncate max-w-[110px]">
                          {doc.author_name || pick('Khuyết danh', 'Anonymous')}
                        </span>
                        {uploadDateText && (
                          <span className="hidden sm:inline text-muted-foreground tabular shrink-0">
                            · {uploadDateText}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 font-bold whitespace-nowrap">
                        {safeUrl ? (
                          <a
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-primary hover:text-primary-hover hover:underline"
                          >
                            <span>{kind.actionLabel}</span>
                            <span
                              className="material-symbols-outlined text-[12px]"
                              aria-hidden="true"
                            >
                              open_in_new
                            </span>
                          </a>
                        ) : (
                          <span className="text-primary/70">
                            {pick('Mở xem chi tiết', 'View details')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 paper-card border border-dashed border-border-strong max-w-lg mx-auto my-8 p-6">
              <div className="w-16 h-16 rounded-2xl bg-primary-soft border border-primary/30 text-primary flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl" aria-hidden="true">
                  folder_off
                </span>
              </div>
              <h3 className="font-display font-bold text-lg text-foreground mb-1">
                {pick('Không tìm thấy tài liệu phù hợp', 'No matching resources found')}
              </h3>
              <p className="text-xs text-secondary-text mb-6 max-w-xs mx-auto leading-relaxed">
                {pick(
                  'Hãy thử đổi từ khóa tìm kiếm hoặc chọn cấp học và bộ lọc môn học khác.',
                  'Try changing your search keywords or selecting a different education level and subject filter.',
                )}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('');
                  setEducationLevel('all');
                  setShowSavedOnly(false);
                  setSortBy('featured');
                }}
                className="btn-arena btn-arena-secondary btn-arena-sm"
              >
                {pick('Đặt lại bộ lọc', 'Reset filters')}
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
                    {selectedDoc.education_level === 'university'
                      ? pick('Đại học', 'University')
                      : pick('THPT', 'High School')}
                  </span>
                  {selectedDoc.category && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-alt text-secondary-text border border-border">
                      {getCategoryDisplayLabel(selectedDoc.category, isEn)}
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
                aria-label={pick('Đóng', 'Close')}
                className="p-2 rounded-xl text-muted-foreground hover:bg-surface-alt hover:text-foreground transition-colors cursor-pointer shrink-0"
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
                  {pick('Mô tả tài liệu', 'Resource Description')}
                </h4>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line bg-paper p-4 rounded-xl border border-border">
                  {selectedDoc.description ||
                    pick(
                      'Tài liệu này chưa có mô tả chi tiết từ tác giả.',
                      'No detailed description has been provided by the author yet.',
                    )}
                </p>
              </div>

              {/* Meta information */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-paper border border-border">
                  <div className="text-[10px] text-secondary-text">
                    {pick('Tác giả', 'Author')}
                  </div>
                  <div className="font-bold text-xs text-foreground mt-0.5 truncate">
                    {selectedDoc.author_name || pick('Khuyết danh', 'Anonymous')}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-paper border border-border">
                  <div className="text-[10px] text-secondary-text">
                    {pick('Ngày tải lên', 'Uploaded')}
                  </div>
                  <div className="font-bold text-xs text-foreground mt-0.5 tabular">
                    {formatDate(selectedDoc.created_at) || '—'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-paper border border-border">
                  <div className="text-[10px] text-secondary-text">
                    {pick('Định dạng', 'Format')}
                  </div>
                  <div className="font-bold text-xs text-foreground mt-0.5 uppercase truncate">
                    {selectedDoc.file_type ||
                      getDocumentKindMeta(selectedDoc.title, selectedDoc.file_url, lang).label}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-paper border border-border">
                  <div className="text-[10px] text-secondary-text">
                    {pick('Đánh giá TB', 'Avg. Rating')}
                  </div>
                  <div className="font-bold text-xs text-accent mt-0.5 flex items-center gap-1 tabular">
                    <span className="material-symbols-outlined text-xs icon-fill" aria-hidden="true">
                      star
                    </span>
                    <span>{Number(selectedDoc.avg_rating || 5).toFixed(1)} / 5</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {sanitizeExternalUrl(selectedDoc.file_url) ? (
                  <a
                    href={sanitizeExternalUrl(selectedDoc.file_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-arena btn-arena-primary flex-1 min-w-[180px] text-center justify-center"
                  >
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">
                      open_in_new
                    </span>
                    <span>{pick('Mở / Tải tài liệu ngay', 'Open / Download Resource')}</span>
                  </a>
                ) : (
                  <span className="btn-arena btn-arena-secondary flex-1 min-w-[180px] text-center justify-center opacity-60">
                    {pick('Link tài liệu không khả dụng', 'Resource link unavailable')}
                  </span>
                )}

                <button
                  type="button"
                  onClick={(e) => handleToggleBookmark(selectedDoc.id, e)}
                  className={`btn-arena btn-arena-secondary shrink-0 ${
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
                  <span>
                    {savedDocIds.has(selectedDoc.id)
                      ? pick('Đã lưu', 'Saved')
                      : pick('Lưu lại', 'Save')}
                  </span>
                </button>

                <button
                  type="button"
                  aria-label={pick(
                    'Báo cáo tài liệu hoặc link hỏng',
                    'Report resource or broken link',
                  )}
                  onClick={(e) => handleOpenReport(selectedDoc, e)}
                  className="btn-arena btn-arena-secondary shrink-0 text-muted-foreground hover:text-primary"
                  title={pick('Báo cáo link hỏng', 'Report broken link')}
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
                    <span>
                      {pick('Đánh giá từ người học', 'Learner Reviews')} (
                      {formatNumber(reviews.length)})
                    </span>
                  </h4>
                </div>

                {/* Submit Review */}
                {user ? (
                  <form
                    onSubmit={handleAddReview}
                    className="p-4 rounded-xl bg-paper border border-border space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-bold text-foreground">
                        {pick(
                          'Bạn đánh giá tài liệu này thế nào?',
                          'How would you rate this resource?',
                        )}
                      </span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            aria-label={pick(
                              `Đánh giá ${star} sao`,
                              `Rate ${star} out of 5 stars`,
                            )}
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
                      placeholder={pick(
                        'Chia sẻ nhận xét ngắn của bạn về tài liệu này...',
                        'Share a brief review of this resource...',
                      )}
                      className="w-full px-3 py-2 bg-surface border border-border-strong rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                    />

                    <div className="text-right">
                      <button
                        type="submit"
                        disabled={isSubmittingReview}
                        className="btn-arena btn-arena-primary btn-arena-sm"
                      >
                        {isSubmittingReview
                          ? pick('Đang gửi...', 'Submitting...')
                          : pick('Gửi nhận xét', 'Post Review')}
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="text-xs text-secondary-text italic p-3 rounded-xl bg-paper border border-border text-center">
                    <Link to="/auth" className="text-primary font-bold hover:underline">
                      {pick('Đăng nhập', 'Sign in')}
                    </Link>{' '}
                    {pick(
                      'để để lại đánh giá và nhận xét cho tài liệu này.',
                      'to rate and review this resource.',
                    )}
                  </p>
                )}

                {/* Review List */}
                <div className="space-y-2.5">
                  {loadingReviews ? (
                    <div className="py-4 text-center">
                      <span
                        className="material-symbols-outlined animate-spin text-primary"
                        aria-hidden="true"
                      >
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
                          <span className="tabular">{formatDate(r.created_at)}</span>
                        </div>
                        <p className="text-foreground leading-relaxed">{r.review_text}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground italic text-center py-2">
                      {pick(
                        'Chưa có đánh giá nào cho tài liệu này.',
                        'No reviews yet for this resource.',
                      )}
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
              <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                  flag
                </span>
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-bold text-base text-foreground">
                  {pick('Báo cáo sự cố tài liệu', 'Report Resource Issue')}
                </h3>
                <p className="text-xs text-secondary-text mt-0.5 truncate">
                  {reportingDoc.title}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitReport} className="space-y-3 pt-2">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-foreground">
                  {pick('Lý do báo cáo:', 'Reason for report:')}
                </label>
                {REPORT_REASONS.map((reason) => (
                  <label
                    key={reason.value}
                    className="flex items-center gap-2 p-2.5 rounded-xl border border-border hover:bg-paper cursor-pointer text-xs"
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      value={reason.value}
                      checked={reportReason === reason.value}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-foreground">
                      {isEn ? reason.labelEn : reason.labelVi}
                    </span>
                  </label>
                ))}
              </div>

              {reportReason === OTHER_REPORT_REASON_VALUE && (
                <div>
                  <textarea
                    rows={3}
                    placeholder={pick(
                      'Mô tả chi tiết vấn đề bạn gặp phải...',
                      'Describe the issue in detail...',
                    )}
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
                  {pick('Hủy', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="btn-arena btn-arena-primary btn-arena-sm"
                >
                  {isSubmittingReport
                    ? pick('Đang gửi...', 'Submitting...')
                    : pick('Gửi báo cáo', 'Submit Report')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
