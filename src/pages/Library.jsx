import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { sanitizeExternalUrl } from '../utils/urlSecurity';

const CATEGORIES = [
  { label: 'Tất cả', value: '' },
  { label: 'Toán', value: 'toan' },
  { label: 'Vật Lý', value: 'ly' },
  { label: 'Hóa Học', value: 'hoa' },
  { label: 'Sinh Học', value: 'sinh' },
  { label: 'Ngữ Văn', value: 'van' },
  { label: 'Tiếng Anh', value: 'anh' },
  { label: 'Lịch Sử', value: 'su' },
  { label: 'Địa Lý', value: 'dia' },
  { label: 'Tin Học', value: 'tin' },
  { label: 'GD KT&PL', value: 'gdktpl' },
];

const REPORT_REASONS = [
  'Link tài liệu bị lỗi / không mở được',
  'Nội dung không phù hợp',
  'Sai môn học / thông tin sai',
  'Vi phạm bản quyền',
  'Lý do khác',
];

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return <div className="p-10 text-white"><h1 className="text-red-500 font-bold">Something went wrong.</h1><pre className="text-xs bg-black p-4 mt-4">{this.state.error?.toString()}</pre></div>;
    }
    return this.props.children;
  }
}


function useDraggableScroll() {
  const ref = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragged, setDragged] = useState(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const onMouseDown = useCallback((e) => {
    if (!ref.current) return;
    setIsDragging(true);
    setDragged(false);
    startX.current = e.pageX - ref.current.offsetLeft;
    scrollLeft.current = ref.current.scrollLeft;
  }, []);

  const onMouseLeave = useCallback(() => setIsDragging(false), []);
  const onMouseUp = useCallback(() => setIsDragging(false), []);

  const onMouseMove = useCallback((e) => {
    if (!isDragging || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    if (Math.abs(x - startX.current) > 3) {
      setDragged(true);
    }
    ref.current.scrollLeft = scrollLeft.current - (x - startX.current) * 2;
  }, [isDragging]);

  return {
    events: {
      ref,
      onMouseDown,
      onMouseLeave,
      onMouseUp,
      onMouseMove
    },
    dragged,
    isDragging
  };
}

export default function Library() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [educationLevel, setEducationLevel] = useState('thpt');

  // Report modal state
  const [reportTarget, setReportTarget] = useState(null); // doc object
  const [reportReason, setReportReason] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef(null);

  const categoriesScroll = useDraggableScroll();
  const featuredScroll = useDraggableScroll();

  const fetchDocuments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, description, file_url, category, education_level, uploaded_by, author_name, created_at, is_featured, publish_date, major')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('notifications')
        .select('id, title, message, link, is_read, created_at, user_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }, [user]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);
  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Close notif dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const categoriesList = useMemo(() => {
    if (educationLevel === 'thpt') {
      const dynamicCats = Array.from(new Set(
        documents
          .filter(d => (d.education_level || 'thpt') === 'thpt')
          .map(d => d.category)
          .filter(c => c && !CATEGORIES.some(cat => cat.value === c))
      ));
      return [
        ...CATEGORIES,
        ...dynamicCats.map(c => ({ label: c, value: c }))
      ];
    } else {
      // University: dynamic list based on unique majors
      const dynamicMajors = Array.from(new Set(documents.filter(d => d.education_level === 'university' && d.major).map(d => d.major).filter(Boolean)));
      return [
        { label: 'Tất cả Ngành/Trường', value: '' },
        ...dynamicMajors.map(m => ({ label: m, value: m }))
      ];
    }
  }, [documents, educationLevel]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleOpenNotifs = () => {
    setShowNotifs(v => !v);
    if (!showNotifs) markAllRead();
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const openReportModal = (doc) => {
    if (!user) { alert('Bạn cần đăng nhập để báo cáo tài liệu.'); return; }
    if (doc.uploaded_by === user.id) { alert('Bạn không thể báo cáo tài liệu của chính mình.'); return; }
    setReportTarget(doc);
    setReportReason('');
    setReportSuccess(false);
  };

  const handleSubmitReport = async () => {
    if (!reportReason) return;
    setReportLoading(true);
    try {
      // Insert report (unique constraint ngăn báo cáo trùng)
      const { error: reportError } = await supabase
        .from('document_reports')
        .insert({ document_id: reportTarget.id, reported_by: user.id, reason: reportReason });

      if (reportError) {
        if (reportError.code === '23505') {
          alert('Bạn đã báo cáo tài liệu này rồi.');
          setReportTarget(null);
          return;
        }
        throw reportError;
      }

      setReportSuccess(true);
      setTimeout(() => setReportTarget(null), 2000);
    } catch (err) {
      console.error('Report error:', err);
      alert('Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setReportLoading(false);
    }
  };

  const filteredDocs = documents.filter(doc => {
    const matchEduLevel = (doc.education_level || 'thpt') === educationLevel;
    let matchCat = true;
    if (activeCategory) {
      if (educationLevel === 'thpt') {
        matchCat = doc.category === activeCategory;
      } else {
        matchCat = doc.major === activeCategory;
      }
    }
    const titleMatch = (doc.title || '').toLowerCase().includes(searchQuery.toLowerCase());
    const authorMatch = (doc.author_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchSearch = !searchQuery || titleMatch || authorMatch;
    return matchEduLevel && matchCat && matchSearch;
  });

  const getDisplayCategory = (doc) => {
    if ((doc.education_level || 'thpt') === 'thpt') {
      const found = categoriesList.find(c => c.value === doc.category);
      return found?.label || doc.category;
    }
    return doc.category;
  };

  const getSafeDate = (dateString) => {
    try {
      if (!dateString) return null;
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString('vi-VN');
    } catch {
      return null;
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-[#0a0c14] text-white font-display pb-24">
        {/* Background Mesh */}
        <div className="fixed inset-0 bg-[radial-gradient(at_0%_0%,#4f46e5_0px,transparent_50%),radial-gradient(at_100%_0%,#7e22ce_0px,transparent_50%),radial-gradient(at_100%_100%,#3b82f6_0px,transparent_50%),radial-gradient(at_0%_100%,#ec4899_0px,transparent_50%)] opacity-30 pointer-events-none"></div>

      <div className="w-full max-w-6xl mx-auto flex flex-col flex-1 relative z-10">
        <header className="relative z-50 px-4 pt-6 pb-4 bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/5 mt-0 md:mt-4 md:rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigate(-1)} className="md:hidden flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined">arrow_back_ios_new</span>
            </button>
            <h1 className="text-xl font-bold tracking-tight">Tài Liệu Học Free</h1>

            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={handleOpenNotifs}
                className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/10 transition-colors relative"
              >
                <span className="material-symbols-outlined">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center shadow-lg shadow-red-500/50 animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifs && (
                <div className="absolute right-0 top-12 w-80 bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                    <span className="font-bold text-sm">Thông báo</span>
                    {notifications.length > 0 && (
                      <button onClick={markAllRead} className="text-xs text-blue-400 hover:text-blue-300">
                        Đánh dấu đã đọc
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-8 flex flex-col items-center text-slate-500">
                        <span className="material-symbols-outlined text-3xl mb-2">notifications_off</span>
                        <p className="text-sm">Chưa có thông báo nào</p>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          className={`px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors ${!n.is_read ? 'bg-blue-500/5' : ''}`}
                        >
                          {!n.is_read && (
                            <span className="inline-block w-2 h-2 bg-blue-400 rounded-full mr-2 mb-0.5 align-middle"></span>
                          )}
                          <p className="text-sm font-semibold text-white">{n.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{n.message}</p>
                          <p className="text-[10px] text-slate-600 mt-1">
                            {new Date(n.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <input
                className="w-full h-11 pl-10 pr-4 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 focus:ring-2 focus:ring-[#306ee8]/50 text-sm placeholder:text-slate-400 outline-none text-white"
                placeholder="Tìm kiếm tài liệu..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined">tune</span>
            </button>
          </div>

          {/* Education Level Switcher */}
          <div className="mt-4 flex bg-white/5 backdrop-blur-md p-1 rounded-xl w-full mx-auto border border-white/10">
            <button
              onClick={() => { setEducationLevel('thpt'); setActiveCategory(''); }}
              className={`flex-1 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1 sm:gap-2 ${educationLevel === 'thpt' ? 'bg-[#306ee8] text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <span className="material-symbols-outlined text-[16px] sm:text-[18px]">menu_book</span> THPT Quốc Gia
            </button>
            <button
              onClick={() => { setEducationLevel('university'); setActiveCategory(''); }}
              className={`flex-1 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1 sm:gap-2 ${educationLevel === 'university' ? 'bg-[#7f13ec] text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <span className="material-symbols-outlined text-[16px] sm:text-[18px]">school</span> Đại Học
            </button>
          </div>
        </header>

        <main className="flex-1 relative z-10 pt-2">
          {/* Categories */}
          <div 
            {...categoriesScroll.events}
            onClickCapture={(e) => {
              if (categoriesScroll.dragged) {
                e.stopPropagation();
                e.preventDefault();
              }
            }}
            className={`flex gap-2 p-4 overflow-x-auto no-scrollbar ${categoriesScroll.isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
          >
            {categoriesList.map(cat => (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`shrink-0 px-4 py-1.5 sm:px-5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors ${activeCategory === cat.value
                  ? educationLevel === 'university' ? 'bg-[#7f13ec] text-white shadow-lg shadow-[#7f13ec]/25' : 'bg-[#306ee8] text-white shadow-lg shadow-[#306ee8]/25'
                  : 'bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10'
                  }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* === FEATURED SECTION === */}
          {(() => {
            const featured = documents.filter(d => d.is_featured);
            if (featured.length === 0) return null;
            return (
              <div className="px-4 pt-2 pb-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-amber-400 text-lg">star</span>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-amber-400">Tài liệu nổi bật</h2>
                </div>
                <div 
                  {...featuredScroll.events}
                  onClickCapture={(e) => {
                    if (featuredScroll.dragged) {
                      e.stopPropagation();
                      e.preventDefault();
                    }
                  }}
                  className={`flex gap-3 overflow-x-auto no-scrollbar pb-1 ${featuredScroll.isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
                >
                  {featured.map(doc => {
                    const safeFileUrl = sanitizeExternalUrl(doc.file_url);

                    return (
                    <div key={doc.id} className="shrink-0 w-56 bg-gradient-to-br from-amber-500/15 to-orange-600/10 border border-amber-500/30 rounded-2xl p-3 flex flex-col gap-2 relative">
                      <span className="absolute top-2 right-2 material-symbols-outlined text-amber-400 text-base">star</span>
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-amber-300">picture_as_pdf</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-white line-clamp-2 leading-snug pr-4">{doc.title}</h3>
                        {doc.uploaded_by ? (
                          <Link to={`/profile/${doc.uploaded_by}`} className="text-[10px] text-amber-300 hover:text-amber-200 hover:underline mt-0.5 inline-block">
                            {doc.author_name}
                          </Link>
                        ) : (
                          <p className="text-[10px] text-slate-400 mt-0.5">{doc.author_name}</p>
                        )}
                        {getSafeDate(doc.publish_date) && (
                          <p className="text-[10px] text-slate-400 mt-0.5"><span className="material-symbols-outlined text-[10px] align-middle">calendar_month</span> {getSafeDate(doc.publish_date)}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {doc.major && doc.education_level === 'university' && (
                            <span className="text-[9px] font-semibold uppercase tracking-wide text-rose-400/80 bg-rose-500/10 rounded px-1.5 py-0.5 inline-block">
                              {doc.major}
                            </span>
                          )}
                          {doc.category && (
                            <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-400/70 bg-amber-500/10 rounded px-1.5 py-0.5 inline-block">
                              {getDisplayCategory(doc)}
                            </span>
                          )}
                        </div>
                      </div>
                      {safeFileUrl ? (
                        <a
                          href={safeFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-auto w-full py-1.5 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-colors border border-amber-500/20"
                        >
                          <span className="material-symbols-outlined text-[14px]">download</span> Tải về
                        </a>
                      ) : (
                        <div className="mt-auto w-full py-1.5 bg-red-500/10 text-red-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1 border border-red-500/20">
                          <span className="material-symbols-outlined text-[14px]">link_off</span> Link lỗi
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              </div>
            );
          })()}

          {/* Grid Items */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 px-3 sm:px-4 mt-2 mb-8">
            {loading ? (
              <div className="col-span-full py-10 flex flex-col items-center justify-center text-slate-400">
                <span className="material-symbols-outlined animate-spin text-4xl mb-2">sync</span>
                <p>Đang tải tài liệu...</p>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="col-span-full py-10 flex flex-col items-center justify-center text-slate-400">
                <span className="material-symbols-outlined text-5xl mb-2 opacity-50">folder_off</span>
                <p>{documents.length === 0 ? 'Chưa có tài liệu nào trong thư viện.' : 'Không tìm thấy tài liệu phù hợp.'}</p>
              </div>
            ) : (
              filteredDocs.map(doc => {
                const safeFileUrl = sanitizeExternalUrl(doc.file_url);

                return (
                <div key={doc.id} className="bg-white/5 backdrop-blur-md border border-white/10 p-3 sm:p-4 rounded-2xl flex flex-col gap-3 hover:bg-white/10 transition-all cursor-pointer group relative shadow-sm hover:shadow-md">
                  {/* Report button */}
                  {user && doc.uploaded_by !== user.id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); openReportModal(doc); }}
                      title="Báo cáo tài liệu"
                      className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/20 hover:bg-red-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px] text-slate-400 hover:text-red-400 transition-colors">flag</span>
                    </button>
                  )}

                  <div className="flex gap-3 items-start pr-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl bg-[#306ee8]/20 flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-overlay bg-gradient-to-br from-indigo-500 to-purple-500 group-hover:scale-110 transition-transform duration-500"></div>
                      <span className="material-symbols-outlined text-xl sm:text-2xl text-white drop-shadow-md relative z-10">picture_as_pdf</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-white line-clamp-2 leading-snug">{doc.title}</h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        {doc.uploaded_by ? (
                          <Link to={`/profile/${doc.uploaded_by}`} className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline truncate max-w-[100px]">
                            {doc.author_name}
                          </Link>
                        ) : (
                          <p className="text-[11px] text-slate-400 truncate max-w-[100px]">{doc.author_name}</p>
                        )}
                        {getSafeDate(doc.publish_date) && (
                          <>
                            <span className="text-slate-600 text-[10px]">•</span>
                            <p className="text-[10px] text-slate-400 flex items-center gap-0.5 whitespace-nowrap"><span className="material-symbols-outlined text-[10px]">calendar_month</span> {getSafeDate(doc.publish_date)}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {doc.description && (
                      <p className="text-[11px] sm:text-xs text-slate-400 line-clamp-2 leading-relaxed">{doc.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {doc.major && doc.education_level === 'university' && (
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-rose-400/80 bg-rose-500/10 rounded-md px-1.5 py-0.5 inline-block">
                          {doc.major}
                        </span>
                      )}
                      {doc.category && (
                        <span className={`text-[9px] font-semibold uppercase tracking-wide ${doc.education_level === 'university' ? 'text-[#7f13ec]/80 bg-[#7f13ec]/10' : 'text-[#306ee8]/80 bg-[#306ee8]/10'} rounded-md px-1.5 py-0.5 inline-block`}>
                          {getDisplayCategory(doc)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-auto pt-2">
                    {safeFileUrl ? (
                      <a
                        href={safeFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 bg-[#306ee8]/10 hover:bg-[#306ee8]/30 text-blue-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-[#306ee8]/20 group-hover:border-[#306ee8]/40"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="material-symbols-outlined text-[16px]">download</span> Tải về
                      </a>
                    ) : (
                      <div className="w-full py-2 bg-red-500/10 text-red-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 border border-red-500/20">
                        <span className="material-symbols-outlined text-[16px]">link_off</span> Link lỗi
                      </div>
                    )}
                  </div>
                </div>
              )})
            )}
          </div>
        </main>
      </div>

      {/* === REPORT MODAL === */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            {reportSuccess ? (
              <div className="p-8 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-green-400 text-3xl">check_circle</span>
                </div>
                <h3 className="font-bold text-lg mb-1">Đã gửi báo cáo!</h3>
                <p className="text-slate-400 text-sm">Cảm ơn bạn đã phản hồi. Chúng tôi sẽ xem xét sớm nhất có thể.</p>
              </div>
            ) : (
              <>
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-red-400">flag</span>
                    <h3 className="font-bold">Báo cáo tài liệu</h3>
                  </div>
                  <button onClick={() => setReportTarget(null)} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-slate-400">close</span>
                  </button>
                </div>

                <div className="p-5">
                  <p className="text-sm text-slate-400 mb-1">Tài liệu:</p>
                  <p className="text-sm font-semibold line-clamp-2 mb-4 text-white">{reportTarget.title}</p>

                  <p className="text-sm text-slate-400 mb-3">Chọn lý do báo cáo:</p>
                  <div className="flex flex-col gap-2">
                    {REPORT_REASONS.map(r => (
                      <button
                        key={r}
                        onClick={() => setReportReason(r)}
                        className={`text-left px-4 py-2.5 rounded-xl text-sm transition-all border ${reportReason === r
                          ? 'border-red-500/60 bg-red-500/15 text-red-300'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                          }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="px-5 pb-5 flex gap-3">
                  <button
                    onClick={() => setReportTarget(null)}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-slate-400 hover:bg-white/10 transition-colors"
                  >
                    Huỷ
                  </button>
                  <button
                    onClick={handleSubmitReport}
                    disabled={!reportReason || reportLoading}
                    className="flex-1 py-2.5 rounded-xl bg-red-500/80 hover:bg-red-500 text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                  >
                    {reportLoading ? (
                      <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">flag</span>
                        Gửi báo cáo
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      </div>
    </ErrorBoundary>
  );
}
