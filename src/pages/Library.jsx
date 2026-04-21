import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { sanitizeExternalUrl } from '../utils/urlSecurity';
import {
  DOCUMENT_FIELDS,
  LIBRARY_THPT_CATEGORIES,
  formatViDate,
  formatViDateTime,
  getDocumentKindMeta,
  getDocumentUploadDate,
  getEducationLevelLabel,
  normalizeSearchText,
} from '../lib/documents';

const REPORT_REASONS = [
  'Link tài liệu bị lỗi hoặc không mở được',
  'Nội dung không phù hợp',
  'Sai môn học hoặc thông tin sai',
  'Vi phạm bản quyền',
  'Lý do khác',
];

const DOCUMENT_PAGE_SIZE = 30;
const FEATURED_LIMIT = 5;

function useClickOutside(ref, onClose) {
  useEffect(() => {
    const handler = (event) => {
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }

      onClose();
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, ref]);
}

function DetailMetaRow({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value || '—'}</p>
    </div>
  );
}

function NotificationDropdown({ loading, notifications, onMarkAllRead }) {
  return (
    <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-3xl border border-white/10 bg-[#0f172a] shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-sm font-bold">Thông báo</span>
        {notifications.length > 0 && (
          <button onClick={onMarkAllRead} className="text-xs font-semibold text-sky-300 transition-colors hover:text-sky-200">
            Đánh dấu đã đọc
          </button>
        )}
      </div>
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center px-4 py-10 text-slate-500">
            <span className="material-symbols-outlined animate-spin text-3xl">sync</span>
            <p className="mt-2 text-sm">Đang tải thông báo...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-10 text-slate-500">
            <span className="material-symbols-outlined text-3xl">notifications_off</span>
            <p className="mt-2 text-sm">Chưa có thông báo nào</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`border-b border-white/5 px-4 py-3 transition-colors hover:bg-white/5 ${
                notification.is_read ? '' : 'bg-sky-500/6'
              }`}
            >
              <div className="flex items-start gap-2">
                {!notification.is_read && (
                  <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-sky-400" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{notification.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{notification.message}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-600">
                    {formatViDateTime(notification.created_at) || 'Vừa xong'}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FeaturedDocumentCard({ document, onSelect, isActive, getCategoryLabel }) {
  const safeFileUrl = sanitizeExternalUrl(document.file_url);
  const kind = getDocumentKindMeta(document.file_url);

  return (
    <button
      type="button"
      onClick={() => onSelect(document.id)}
      className={`w-72 shrink-0 rounded-[28px] border p-4 text-left transition-all ${
        isActive
          ? 'border-amber-400/40 bg-amber-500/14 shadow-[0_18px_40px_rgba(251,191,36,0.12)]'
          : 'border-white/8 bg-white/6 hover:border-amber-400/25 hover:bg-white/10'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/16 text-amber-300">
          <span className="material-symbols-outlined">{kind.icon}</span>
        </div>
        <span className="rounded-full bg-amber-500/16 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200">
          Nổi bật
        </span>
      </div>

      <h3 className="mt-4 line-clamp-2 text-base font-black leading-6 text-white">{document.title}</h3>
      <p className="mt-2 text-xs leading-5 text-slate-300">
        {document.description || 'Tài liệu được ghim để bạn mở nhanh trong thư viện.'}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${kind.chipClass}`}>{kind.label}</span>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-slate-200">
          {getCategoryLabel(document)}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400">
        <span>Up {formatViDate(getDocumentUploadDate(document)) || 'Chưa rõ'}</span>
        <span>{safeFileUrl ? 'Có thể mở ngay' : 'Link lỗi'}</span>
      </div>
    </button>
  );
}

function DocumentRow({
  document,
  isActive,
  onSelect,
  onReport,
  canReport,
  getCategoryLabel,
}) {
  const safeFileUrl = sanitizeExternalUrl(document.file_url);
  const uploadDate = formatViDate(getDocumentUploadDate(document)) || '—';
  const publishDate = formatViDate(document.publish_date) || '—';
  const kind = getDocumentKindMeta(document.file_url);
  const primaryLabel = getCategoryLabel(document);
  const secondaryLabel = document.major && document.education_level === 'university'
    ? document.major
    : getEducationLevelLabel(document.education_level);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(document.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(document.id)}
      onKeyDown={handleKeyDown}
      className={`group grid cursor-pointer gap-3 px-4 py-4 transition-colors md:grid-cols-[minmax(0,2.8fr)_1.15fr_1fr_1fr_0.95fr_100px] md:items-center ${
        isActive ? 'bg-sky-500/12' : 'hover:bg-white/5'
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/8 ${kind.accent}`}>
          <span className="material-symbols-outlined">{kind.icon}</span>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-bold text-white">{document.title}</p>
            {document.is_featured && (
              <span className="rounded-full bg-amber-500/16 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-200">
                Star
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-1 text-xs text-slate-400">
            {document.description || `${kind.label} • ${secondaryLabel}`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 md:hidden">
            <span className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-semibold text-slate-200">{primaryLabel}</span>
            <span className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-semibold text-slate-200">{uploadDate}</span>
            <span className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-semibold text-slate-200">{kind.label}</span>
          </div>
        </div>
      </div>

      <div className="hidden text-sm font-medium text-slate-300 md:block">{primaryLabel}</div>
      <div className="hidden text-sm font-medium text-slate-300 md:block">{document.author_name || 'Khuyết danh'}</div>
      <div className="hidden text-sm font-medium text-slate-300 md:block">{uploadDate}</div>
      <div className="hidden text-sm font-medium text-slate-300 md:block">{publishDate}</div>

      <div className="flex items-center justify-end gap-2">
        {canReport && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onReport(document);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/5 text-slate-400 transition-colors hover:border-red-400/30 hover:text-red-300"
            title="Báo cáo tài liệu"
          >
            <span className="material-symbols-outlined text-[18px]">flag</span>
          </button>
        )}
        {safeFileUrl ? (
          <a
            href={safeFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex min-h-9 items-center justify-center rounded-xl border border-sky-400/18 bg-sky-500/10 px-3 text-xs font-bold text-sky-200 transition-colors hover:bg-sky-500/20"
          >
            Mở
          </a>
        ) : (
          <span className="inline-flex min-h-9 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 px-3 text-xs font-bold text-red-300">
            Lỗi link
          </span>
        )}
      </div>
    </div>
  );
}

function ReportModal({
  loading,
  reason,
  reportTarget,
  success,
  onChangeReason,
  onClose,
  onSubmit,
}) {
  if (!reportTarget) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#0f172a] shadow-2xl">
        {success ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>
            <h3 className="mt-4 text-lg font-bold text-white">Đã gửi báo cáo</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Cảm ơn bạn. Tài liệu này đã được đưa vào hàng đợi kiểm tra.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-400">flag</span>
                <h3 className="font-bold text-white">Báo cáo tài liệu</h3>
              </div>
              <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/10">
                <span className="material-symbols-outlined text-slate-400">close</span>
              </button>
            </div>

            <div className="px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Tài liệu</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-white">{reportTarget.title}</p>

              <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Lý do</p>
              <div className="mt-3 flex flex-col gap-2">
                {REPORT_REASONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onChangeReason(item)}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                      reason === item
                        ? 'border-red-500/40 bg-red-500/12 text-red-200'
                        : 'border-white/8 bg-white/5 text-slate-300 hover:bg-white/8'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 px-5 pb-5">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-400 transition-colors hover:bg-white/8"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={!reason || loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-50"
              >
                {loading ? (
                  <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">flag</span>
                )}
                Gửi báo cáo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Library() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [featuredDocuments, setFeaturedDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreDocuments, setHasMoreDocuments] = useState(false);
  const [educationLevel, setEducationLevel] = useState('thpt');
  const [activeCategory, setActiveCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [isFilterPending, startFilterTransition] = useTransition();

  const deferredSearch = useDeferredValue(normalizeSearchText(searchQuery));
  const notificationRef = useRef(null);
  const documentsRequestRef = useRef(0);
  const featuredRequestRef = useRef(0);

  useClickOutside(notificationRef, () => setShowNotifications(false));

  const unreadCount = notifications.filter((item) => !item.is_read).length;

  const applyEducationFilter = useCallback((query) => {
    if (educationLevel === 'university') {
      return query.eq('education_level', 'university');
    }

    return query.or('education_level.eq.thpt,education_level.is.null');
  }, [educationLevel]);

  const buildDocumentsQuery = useCallback(() => {
    let query = supabase
      .from('documents')
      .select(DOCUMENT_FIELDS)
      .order('uploaded_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    query = applyEducationFilter(query);

    if (activeCategory) {
      query = educationLevel === 'university'
        ? query.eq('major', activeCategory)
        : query.eq('category', activeCategory);
    }

    return query;
  }, [activeCategory, applyEducationFilter, educationLevel]);

  const fetchDocumentsPage = useCallback(async ({ offset = 0, replace = false } = {}) => {
    const requestId = ++documentsRequestRef.current;

    if (replace) {
      setLoading(true);
      setLoadingMore(false);
    } else {
      setLoadingMore(true);
    }

    try {
      const { data, error } = await buildDocumentsQuery()
        .range(offset, offset + DOCUMENT_PAGE_SIZE);

      if (error) {
        throw error;
      }

      if (requestId !== documentsRequestRef.current) {
        return;
      }

      const nextRows = data || [];
      const visibleRows = nextRows.slice(0, DOCUMENT_PAGE_SIZE);

      setHasMoreDocuments(nextRows.length > DOCUMENT_PAGE_SIZE);
      setDocuments((previous) => (replace ? visibleRows : [...previous, ...visibleRows]));
    } catch (error) {
      console.error('Error fetching documents:', error);
      if (replace) {
        setDocuments([]);
        setHasMoreDocuments(false);
      }
    } finally {
      if (requestId === documentsRequestRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [buildDocumentsQuery]);

  const fetchFeaturedDocuments = useCallback(async () => {
    const requestId = ++featuredRequestRef.current;

    try {
      let query = supabase
        .from('documents')
        .select(DOCUMENT_FIELDS)
        .eq('is_featured', true)
        .order('publish_date', { ascending: false, nullsFirst: false })
        .order('uploaded_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(FEATURED_LIMIT);

      query = applyEducationFilter(query);

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (requestId === featuredRequestRef.current) {
        setFeaturedDocuments(data || []);
      }
    } catch (error) {
      console.error('Error fetching featured documents:', error);
      if (requestId === featuredRequestRef.current) {
        setFeaturedDocuments([]);
      }
    }
  }, [applyEducationFilter]);

  const fetchNotifications = useCallback(async () => {
    if (!user || notificationsLoading || notificationsLoaded) {
      return;
    }

    setNotificationsLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, message, link, is_read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        throw error;
      }

      setNotifications(data || []);
      setNotificationsLoaded(true);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setNotificationsLoading(false);
    }
  }, [notificationsLoaded, notificationsLoading, user]);

  useEffect(() => {
    setDocuments([]);
    setHasMoreDocuments(false);
    void fetchDocumentsPage({ offset: 0, replace: true });
  }, [fetchDocumentsPage]);

  useEffect(() => {
    if (activeCategory || deferredSearch) {
      setFeaturedDocuments([]);
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      void fetchFeaturedDocuments();
    }, 250);

    return () => window.clearTimeout(timerId);
  }, [activeCategory, deferredSearch, fetchFeaturedDocuments]);

  useEffect(() => {
    setNotifications([]);
    setNotificationsLoaded(false);
    setShowNotifications(false);
  }, [user?.id]);

  const categoriesList = useMemo(() => {
    if (educationLevel === 'thpt') {
      const dynamicCategories = Array.from(new Set(
        documents
          .filter((document) => (document.education_level || 'thpt') === 'thpt')
          .map((document) => document.category)
          .filter((value) => value && !LIBRARY_THPT_CATEGORIES.some((category) => category.value === value)),
      ));

      return [
        ...LIBRARY_THPT_CATEGORIES,
        ...dynamicCategories.map((value) => ({ label: value, value })),
      ];
    }

    const dynamicMajors = Array.from(new Set(
      documents
        .filter((document) => document.education_level === 'university' && document.major)
        .map((document) => document.major)
        .filter(Boolean),
    ));

    return [
      { label: 'Tất cả ngành / trường', value: '' },
      ...dynamicMajors.map((value) => ({ label: value, value })),
    ];
  }, [documents, educationLevel]);

  const getCategoryLabel = useCallback((document) => {
    if ((document.education_level || 'thpt') === 'thpt') {
      const category = categoriesList.find((item) => item.value === document.category);
      return category?.label || document.category || 'Khác';
    }

    return document.category || document.major || 'Chuyên ngành';
  }, [categoriesList]);

  const filteredDocuments = useMemo(() => {
    if (!deferredSearch) {
      return documents;
    }

    return documents.filter((document) => {
      const haystack = normalizeSearchText([
        document.title,
        document.description,
        document.author_name,
        document.category,
        document.major,
      ].filter(Boolean).join(' '));

      return haystack.includes(deferredSearch);
    });
  }, [deferredSearch, documents]);

  useEffect(() => {
    if (filteredDocuments.length === 0) {
      setSelectedDocumentId(null);
      return;
    }

    if (!filteredDocuments.some((document) => document.id === selectedDocumentId)) {
      setSelectedDocumentId(filteredDocuments[0].id);
    }
  }, [filteredDocuments, selectedDocumentId]);

  const selectedDocument = useMemo(() => (
    filteredDocuments.find((document) => document.id === selectedDocumentId) || null
  ), [filteredDocuments, selectedDocumentId]);

  const markAllRead = async () => {
    if (!user || unreadCount === 0) {
      return;
    }

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    setNotifications((previous) => previous.map((notification) => ({ ...notification, is_read: true })));
  };

  const handleOpenNotifications = () => {
    const nextState = !showNotifications;
    setShowNotifications(nextState);

    if (nextState) {
      void fetchNotifications();
    }
  };

  const handleOpenReport = (document) => {
    if (!user) {
      alert('Bạn cần đăng nhập để báo cáo tài liệu.');
      return;
    }

    if (document.uploaded_by === user.id) {
      alert('Bạn không thể báo cáo tài liệu do chính mình đăng.');
      return;
    }

    setReportTarget(document);
    setReportReason('');
    setReportSuccess(false);
  };

  const handleSubmitReport = async () => {
    if (!reportTarget || !reportReason) {
      return;
    }

    setReportLoading(true);
    try {
      const { error } = await supabase
        .from('document_reports')
        .insert({
          document_id: reportTarget.id,
          reason: reportReason,
          reported_by: user.id,
        });

      if (error) {
        if (error.code === '23505') {
          alert('Bạn đã báo cáo tài liệu này rồi.');
          setReportTarget(null);
          return;
        }

        throw error;
      }

      setReportSuccess(true);
      window.setTimeout(() => setReportTarget(null), 1800);
    } catch (error) {
      console.error('Error submitting report:', error);
      alert('Không thể gửi báo cáo. Vui lòng thử lại.');
    } finally {
      setReportLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (loading || loadingMore || !hasMoreDocuments) {
      return;
    }

    void fetchDocumentsPage({ offset: documents.length, replace: false });
  };

  const selectedDocumentKind = selectedDocument ? getDocumentKindMeta(selectedDocument.file_url) : null;
  const selectedDocumentUrl = selectedDocument ? sanitizeExternalUrl(selectedDocument.file_url) : null;

  return (
    <>
      <div className="min-h-screen bg-[#07111f] pb-24 text-white">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),transparent_32%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.16),transparent_28%),linear-gradient(180deg,#07111f_0%,#0b1628_100%)]" />

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6">
          <header className="overflow-hidden rounded-[32px] border border-white/8 bg-[#0d1728]/82 shadow-[0_20px_60px_rgba(2,6,23,0.32)] backdrop-blur-xl">
            <div className="flex flex-col gap-4 border-b border-white/8 px-4 py-5 md:px-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate(-1)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/8 bg-white/5 transition-colors hover:bg-white/10 md:hidden"
                  >
                    <span className="material-symbols-outlined">arrow_back_ios_new</span>
                  </button>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-300">Library Explorer</p>
                    <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">Tài liệu học Free</h1>
                    <p className="mt-1 text-sm text-slate-400">Xem tài liệu theo dạng details, có ngày upload và panel chi tiết rõ ràng.</p>
                  </div>
                </div>

                <div className="relative" ref={notificationRef}>
                  <button
                    onClick={handleOpenNotifications}
                    className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/5 transition-colors hover:bg-white/10"
                  >
                    <span className="material-symbols-outlined">notifications</span>
                    {unreadCount > 0 && (
                      <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <NotificationDropdown
                      loading={notificationsLoading}
                      notifications={notifications}
                      onMarkAllRead={markAllRead}
                    />
                  )}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <label className="relative block">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">search</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Tìm theo tiêu đề, tác giả, môn hoặc mô tả..."
                    className="h-12 w-full rounded-2xl border border-white/8 bg-white/5 pl-12 pr-4 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-sky-400/30 focus:bg-white/8"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/8 bg-white/5 p-1">
                  <button
                    type="button"
                    onClick={() => startFilterTransition(() => {
                      setEducationLevel('thpt');
                      setActiveCategory('');
                    })}
                    className={`rounded-[14px] px-4 py-2 text-sm font-bold transition-colors ${
                      educationLevel === 'thpt'
                        ? 'bg-sky-500 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    THPT
                  </button>
                  <button
                    type="button"
                    onClick={() => startFilterTransition(() => {
                      setEducationLevel('university');
                      setActiveCategory('');
                    })}
                    className={`rounded-[14px] px-4 py-2 text-sm font-bold transition-colors ${
                      educationLevel === 'university'
                        ? 'bg-orange-500 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Đại học
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 px-4 py-4 md:px-6">
              {categoriesList.map((category) => (
                <button
                  key={category.value || '__all__'}
                  type="button"
                  onClick={() => startFilterTransition(() => setActiveCategory(category.value))}
                  className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
                    activeCategory === category.value
                      ? educationLevel === 'university'
                        ? 'bg-orange-500 text-white'
                        : 'bg-sky-500 text-white'
                      : 'border border-white/8 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {category.label}
                </button>
              ))}
              <div className="ml-auto hidden items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-xs font-semibold text-slate-400 md:flex">
                <span>{filteredDocuments.length} tài liệu đang hiện</span>
                {isFilterPending && <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>}
              </div>
            </div>
          </header>

          {featuredDocuments.length > 0 && (
            <section className="overflow-x-auto rounded-[28px] border border-white/8 bg-[#0d1728]/72 p-4 backdrop-blur-xl">
              <div className="mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-300">star</span>
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-amber-200">Tài liệu nổi bật</h2>
              </div>
              <div className="flex gap-3">
                {featuredDocuments.map((document) => (
                  <FeaturedDocumentCard
                    key={document.id}
                    document={document}
                    onSelect={setSelectedDocumentId}
                    isActive={document.id === selectedDocumentId}
                    getCategoryLabel={getCategoryLabel}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_360px]">
            <div className="overflow-hidden rounded-[32px] border border-white/8 bg-[#0d1728]/78 shadow-[0_20px_60px_rgba(2,6,23,0.28)] backdrop-blur-xl">
              <div className="hidden grid-cols-[minmax(0,2.8fr)_1.15fr_1fr_1fr_0.95fr_100px] gap-3 border-b border-white/8 px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 md:grid">
                <span>Tên tài liệu</span>
                <span>Môn / học phần</span>
                <span>Tác giả</span>
                <span>Ngày up</span>
                <span>Ngày tài liệu</span>
                <span className="text-right">Mở</span>
              </div>

              <div className="divide-y divide-white/6">
                {loading ? (
                  <div className="flex flex-col items-center px-4 py-16 text-slate-500">
                    <span className="material-symbols-outlined animate-spin text-4xl">sync</span>
                    <p className="mt-3 text-sm">Đang tải thư viện...</p>
                  </div>
                ) : filteredDocuments.length === 0 ? (
                  <div className="flex flex-col items-center px-4 py-16 text-center text-slate-500">
                    <span className="material-symbols-outlined text-5xl">folder_off</span>
                    <p className="mt-3 text-sm">
                      {documents.length === 0
                        ? 'Chưa có tài liệu nào trong thư viện.'
                        : 'Không tìm thấy tài liệu phù hợp với bộ lọc hiện tại.'}
                    </p>
                  </div>
                ) : (
                  filteredDocuments.map((document) => (
                    <DocumentRow
                      key={document.id}
                      document={document}
                      isActive={document.id === selectedDocumentId}
                      onSelect={setSelectedDocumentId}
                      onReport={handleOpenReport}
                      canReport={Boolean(user && document.uploaded_by !== user.id)}
                      getCategoryLabel={getCategoryLabel}
                    />
                  ))
                )}
              </div>

              {(hasMoreDocuments || loadingMore) && (
                <div className="border-t border-white/8 px-4 py-4">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10 disabled:opacity-60"
                  >
                    <span className={`material-symbols-outlined text-[18px] ${loadingMore ? 'animate-spin' : ''}`}>
                      {loadingMore ? 'sync' : 'expand_more'}
                    </span>
                    {loadingMore ? 'Đang tải thêm...' : 'Tải thêm tài liệu'}
                  </button>
                </div>
              )}
            </div>

            <aside className="xl:sticky xl:top-6">
              <div className="overflow-hidden rounded-[32px] border border-white/8 bg-[#0d1728]/84 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.28)] backdrop-blur-xl">
                {selectedDocument ? (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-white/8 ${selectedDocumentKind?.accent}`}>
                        <span className="material-symbols-outlined text-2xl">{selectedDocumentKind?.icon}</span>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${selectedDocumentKind?.chipClass}`}>
                          {selectedDocumentKind?.label}
                        </span>
                        <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-200">
                          {getEducationLevelLabel(selectedDocument.education_level)}
                        </span>
                      </div>
                    </div>

                    <h2 className="mt-5 text-2xl font-black leading-tight tracking-[-0.04em] text-white">
                      {selectedDocument.title}
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-slate-300">
                      {selectedDocument.description || 'Tài liệu này chưa có mô tả chi tiết.'}
                    </p>

                    <div className="mt-5 grid gap-3">
                      <DetailMetaRow label="Tác giả" value={selectedDocument.author_name || 'Khuyết danh'} />
                      <DetailMetaRow label="Môn / học phần" value={getCategoryLabel(selectedDocument)} />
                      <DetailMetaRow label="Trường / ngành" value={selectedDocument.major || 'Không áp dụng'} />
                      <DetailMetaRow label="Ngày upload" value={formatViDateTime(getDocumentUploadDate(selectedDocument))} />
                      <DetailMetaRow label="Ngày tài liệu" value={formatViDate(selectedDocument.publish_date)} />
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      {selectedDocument.uploaded_by ? (
                        <Link
                          to={`/profile/${selectedDocument.uploaded_by}`}
                          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
                        >
                          Xem tác giả
                        </Link>
                      ) : null}

                      {selectedDocumentUrl ? (
                        <a
                          href={selectedDocumentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-sky-500 px-4 text-sm font-bold text-white shadow-[0_12px_30px_rgba(14,165,233,0.25)] transition-colors hover:bg-sky-400"
                        >
                          Mở tài liệu
                        </a>
                      ) : (
                        <span className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 px-4 text-sm font-bold text-red-300">
                          Link tài liệu lỗi
                        </span>
                      )}
                    </div>

                    {user && selectedDocument.uploaded_by !== user.id && (
                      <button
                        type="button"
                        onClick={() => handleOpenReport(selectedDocument)}
                        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl border border-red-500/18 bg-red-500/8 px-4 text-sm font-semibold text-red-200 transition-colors hover:bg-red-500/14"
                      >
                        Báo cáo tài liệu này
                      </button>
                    )}
                  </>
                ) : (
                  <div className="flex min-h-[360px] flex-col items-center justify-center text-center text-slate-500">
                    <span className="material-symbols-outlined text-5xl">topic</span>
                    <p className="mt-3 text-sm">Chọn một tài liệu trong danh sách để xem chi tiết.</p>
                  </div>
                )}
              </div>
            </aside>
          </section>
        </div>
      </div>

      <ReportModal
        loading={reportLoading}
        reason={reportReason}
        reportTarget={reportTarget}
        success={reportSuccess}
        onChangeReason={setReportReason}
        onClose={() => setReportTarget(null)}
        onSubmit={handleSubmitReport}
      />
    </>
  );
}
