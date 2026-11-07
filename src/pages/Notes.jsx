import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import RankSeal from '../components/ui/RankSeal';
import { useToast } from '../components/ui/ToastProvider';

const NOTES_META_KEY = 'dtht_notes_meta';

function loadNotesMeta() {
  try {
    const raw = localStorage.getItem(NOTES_META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveNoteMeta(id, meta) {
  try {
    const all = loadNotesMeta();
    all[id] = { ...(all[id] || {}), ...meta };
    localStorage.setItem(NOTES_META_KEY, JSON.stringify(all));
  } catch {
    // Ignore storage quota
  }
}

function removeNoteMeta(id) {
  try {
    const all = loadNotesMeta();
    delete all[id];
    localStorage.setItem(NOTES_META_KEY, JSON.stringify(all));
  } catch {
    // Ignore
  }
}

const CATEGORY_EN_MAP = {
  'Tất cả': 'All',
  'Công thức': 'Formulas',
  'Từ vựng': 'Vocabulary',
  'Lịch sử / Văn': 'History / Lit',
  'Nhắc nhở': 'Reminders',
  'Đề cương': 'Outlines',
  'Ghi chép': 'Study Notes',
  'Kế hoạch': 'Plans',
  Khác: 'Other',
};

function getCategoryLabel(cat, isEn) {
  if (!cat) return '';
  if (!isEn) return cat;
  return CATEGORY_EN_MAP[cat] || cat;
}

const CATEGORIES = [
  {
    id: 'Tất cả',
    icon: 'grid_view',
    color: 'text-secondary-text',
    bg: 'bg-surface-alt',
    border: 'border-border-strong',
  },
  {
    id: 'Công thức',
    icon: 'functions',
    color: 'text-sky-800 dark:text-sky-300',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    border: 'border-sky-300 dark:border-sky-800',
  },
  {
    id: 'Từ vựng',
    icon: 'translate',
    color: 'text-jade',
    bg: 'bg-jade-soft',
    border: 'border-jade-border',
  },
  {
    id: 'Lịch sử / Văn',
    icon: 'history_edu',
    color: 'text-gold-dark dark:text-accent',
    bg: 'bg-gold-soft',
    border: 'border-gold',
  },
  {
    id: 'Nhắc nhở',
    icon: 'notifications_active',
    color: 'text-primary',
    bg: 'bg-primary-soft',
    border: 'border-primary/35',
  },
  {
    id: 'Khác',
    icon: 'push_pin',
    color: 'text-indigo-800 dark:text-indigo-300',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    border: 'border-indigo-200 dark:border-indigo-800',
  },
];

export default function Notes() {
  const { user } = useAuth();
  const { isEn, pick, formatNumber, formatDate } = useLanguage();
  const { showToast } = useToast();

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Công thức');
  const [isPinned, setIsPinned] = useState(false);
  const [editorMode, setEditorMode] = useState('edit'); // 'edit' | 'preview'
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const fetchNotes = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // ONLY valid columns in tram_sv: id, user_id, title, content, created_at, updated_at
      const { data, error } = await supabase
        .from('user_notes')
        .select('id, user_id, title, content, created_at, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const meta = loadNotesMeta();
      const enriched = (data || []).map((n) => ({
        ...n,
        category: meta[n.id]?.category || 'Khác',
        is_pinned: Boolean(meta[n.id]?.is_pinned),
      }));

      // Sort pinned first, then updated_at descending
      enriched.sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) {
          return a.is_pinned ? -1 : 1;
        }
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      setNotes(enriched);
    } catch (error) {
      console.error('Lỗi tải ghi chú:', error.message);
      showToast(
        pick('Không thể tải danh sách ghi chú: ', 'Unable to load notes: ') + error.message,
        'error',
      );
    } finally {
      setLoading(false);
    }
  }, [user, showToast, pick]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const openModal = (note = null) => {
    setEditorMode('edit');
    if (note) {
      setEditingNote(note);
      setTitle(note.title || '');
      setContent(note.content || '');
      setCategory(note.category || 'Công thức');
      setIsPinned(Boolean(note.is_pinned));
    } else {
      setEditingNote(null);
      setTitle('');
      setContent('');
      setCategory(selectedCategory === 'Tất cả' ? 'Công thức' : selectedCategory);
      setIsPinned(false);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingNote(null);
  };

  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!user) {
      showToast(
        pick('Vui lòng đăng nhập để lưu ghi chú!', 'Please sign in to save notes!'),
        'warning',
      );
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle && !trimmedContent) {
      showToast(
        pick(
          'Vui lòng nhập tiêu đề hoặc nội dung ghi chú!',
          'Please enter a note title or content!',
        ),
        'warning',
      );
      return;
    }

    if (trimmedTitle.length > 200) {
      showToast(
        pick(
          'Tiêu đề ghi chú không được vượt quá 200 ký tự!',
          'Note title cannot exceed 200 characters!',
        ),
        'warning',
      );
      return;
    }

    if (trimmedContent.length > 10000) {
      showToast(
        pick(
          'Nội dung ghi chú không được vượt quá 10.000 ký tự!',
          'Note content cannot exceed 10,000 characters!',
        ),
        'warning',
      );
      return;
    }

    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const fallbackTitle = pick('Ghi chú mới', 'Untitled Note');

      if (editingNote) {
        // ONLY send valid columns: title, content, updated_at
        const { error } = await supabase
          .from('user_notes')
          .update({
            title: trimmedTitle || fallbackTitle,
            content: trimmedContent,
            updated_at: nowIso,
          })
          .eq('id', editingNote.id);

        if (error) throw error;

        saveNoteMeta(editingNote.id, { category, is_pinned: isPinned });
        showToast(
          pick('Đã lưu thay đổi ghi chú thành công!', 'Note changes saved!'),
          'success',
        );
      } else {
        // ONLY send valid columns: user_id, title, content
        const { data, error } = await supabase
          .from('user_notes')
          .insert([
            {
              user_id: user.id,
              title: trimmedTitle || fallbackTitle,
              content: trimmedContent,
            },
          ])
          .select()
          .single();

        if (error) throw error;

        if (data?.id) {
          saveNoteMeta(data.id, { category, is_pinned: isPinned });
        }
        showToast(pick('Đã tạo ghi chú mới thành công!', 'New note created!'), 'success');
      }

      closeModal();
      fetchNotes();
    } catch (error) {
      showToast(
        pick('Lỗi khi lưu ghi chú: ', 'Failed to save note: ') +
          (error.message || pick('Thử lại sau.', 'Please try again.')),
        'error',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePin = (note, e) => {
    e.stopPropagation();
    const newPinStatus = !note.is_pinned;
    saveNoteMeta(note.id, { is_pinned: newPinStatus });

    setNotes((prev) => {
      const updated = prev.map((n) =>
        n.id === note.id ? { ...n, is_pinned: newPinStatus } : n,
      );
      return updated.sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
    });

    showToast(
      newPinStatus
        ? pick('Đã ghim ghi chú lên đầu', 'Note pinned to top')
        : pick('Đã bỏ ghim ghi chú', 'Note unpinned'),
      'info',
      2000,
    );
  };

  const handleRequestDelete = (id, e) => {
    if (e) e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);

    try {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      removeNoteMeta(id);
      if (editingNote?.id === id) closeModal();

      const { error } = await supabase.from('user_notes').delete().eq('id', id);
      if (error) throw error;
      showToast(pick('Đã xóa ghi chú', 'Note deleted'), 'info', 2500);
    } catch (error) {
      showToast(
        pick('Lỗi khi xóa ghi chú: ', 'Failed to delete note: ') + error.message,
        'error',
      );
      fetchNotes();
    }
  };

  const filteredNotes = notes.filter((note) => {
    const matchCategory =
      selectedCategory === 'Tất cả' || note.category === selectedCategory;
    const matchSearch =
      (note.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (note.content && note.content.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCategory && matchSearch;
  });

  const getCategoryStyle = (catName) => {
    return CATEGORIES.find((c) => c.id === catName) || CATEGORIES[5];
  };

  const wordCount = useMemo(() => {
    const trimmed = content.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }, [content]);

  const isDirty = useMemo(() => {
    if (!editingNote) {
      return Boolean(title.trim() || content.trim());
    }
    return (
      title !== (editingNote.title || '') ||
      content !== (editingNote.content || '') ||
      category !== (editingNote.category || 'Công thức') ||
      isPinned !== Boolean(editingNote.is_pinned)
    );
  }, [editingNote, title, content, category, isPinned]);

  return (
    <div className="bg-background font-sans text-foreground min-h-full pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Header */}
        <header className="imperial-frame p-5 sm:p-7 mb-6 relative overflow-hidden">
          <span
            aria-hidden="true"
            className="hanzi-watermark absolute top-2 right-5 text-8xl font-bold text-accent/8"
          >
            筆記
          </span>

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <div className="mb-2">
                <RankSeal
                  size="sm"
                  icon="edit_note"
                  label={pick('Thư Phòng Bút Ký', 'Scholar Study Notes')}
                />
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-foreground">
                {pick('Sổ Tay Kiến Thức', 'Knowledge Notebook')}
              </h1>
              <p className="text-xs sm:text-sm text-secondary-text mt-1">
                {pick(
                  'Lưu trữ công thức, từ vựng và những lưu ý quan trọng cho kỳ thi THPT & ĐGNL',
                  'Capture key formulas, vocabulary, and study notes for your High School & University exams',
                )}
              </p>
            </div>
            {user ? (
              <button
                type="button"
                onClick={() => openModal()}
                className="btn-arena btn-arena-primary self-start sm:self-auto"
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">
                  add
                </span>
                <span>{pick('Tạo ghi chú mới', 'New Note')}</span>
              </button>
            ) : (
              <Link to="/auth" className="btn-arena btn-arena-primary self-start sm:self-auto">
                <span className="material-symbols-outlined text-lg" aria-hidden="true">
                  login
                </span>
                <span>{pick('Đăng nhập để ghi chép', 'Sign in to take notes')}</span>
              </Link>
            )}
          </div>

          {/* Search & Category Filter Pills */}
          <div className="relative z-10 space-y-3">
            <div className="relative">
              <span
                className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              >
                search
              </span>
              <input
                type="text"
                placeholder={pick(
                  'Tìm kiếm trong ghi chú của bạn...',
                  'Search across your notes...',
                )}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-10 py-3 bg-surface border border-border-strong rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-sm text-foreground placeholder:text-muted-foreground transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={pick('Xoá tìm kiếm', 'Clear search')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">
                    close
                  </span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                    selectedCategory === cat.id
                      ? `${cat.bg} ${cat.color} ${cat.border} shadow-2xs`
                      : 'bg-surface border-border text-secondary-text hover:text-foreground hover:border-border-strong'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                    {cat.icon}
                  </span>
                  <span>{getCategoryLabel(cat.id, isEn)}</span>
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main>
          {!user ? (
            <div className="text-center py-16 paper-card border border-dashed border-border-strong max-w-lg mx-auto my-8 p-6">
              <div className="w-16 h-16 rounded-2xl bg-primary-soft border border-primary/30 text-primary flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl" aria-hidden="true">
                  edit_note
                </span>
              </div>
              <h3 className="font-display font-bold text-lg text-foreground mb-1">
                {pick(
                  'Đăng nhập để sử dụng Sổ Tay Kiến Thức',
                  'Sign in to use your Knowledge Notebook',
                )}
              </h3>
              <p className="text-xs text-secondary-text mb-6 max-w-xs mx-auto leading-relaxed">
                {pick(
                  'Ghi chú của bạn được đồng bộ an toàn trên hệ thống máy chủ để truy cập trên mọi thiết bị máy tính lẫn điện thoại.',
                  'Your study notes are synced securely in the cloud for instant access across desktop and mobile devices.',
                )}
              </p>
              <Link to="/auth" className="btn-arena btn-arena-primary btn-arena-sm">
                <span className="material-symbols-outlined text-sm" aria-hidden="true">
                  login
                </span>
                <span>{pick('Đăng nhập ngay', 'Sign in now')}</span>
              </Link>
            </div>
          ) : loading ? (
            <div
              className="flex justify-center py-20"
              role="status"
              aria-label={pick('Đang tải ghi chú', 'Loading notes')}
            >
              <span
                className="material-symbols-outlined animate-spin text-4xl text-primary"
                aria-hidden="true"
              >
                sync
              </span>
            </div>
          ) : filteredNotes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNotes.map((note) => {
                const catStyle = getCategoryStyle(note.category);
                return (
                  <div
                    key={note.id}
                    onClick={() => openModal(note)}
                    className={`group relative paper-card paper-card-interactive p-5 flex flex-col justify-between cursor-pointer h-64 border transition-all ${
                      note.is_pinned
                        ? 'border-gold ring-1 ring-gold/40 bg-paper hover:border-gold'
                        : 'border-border hover:border-border-strong'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-md ${catStyle.bg} ${catStyle.color} border ${catStyle.border}`}
                        >
                          <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                            {catStyle.icon}
                          </span>
                          <span>{getCategoryLabel(note.category, isEn)}</span>
                        </span>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            aria-label={
                              note.is_pinned
                                ? pick('Bỏ ghim ghi chú', 'Unpin note')
                                : pick('Ghim ghi chú lên đầu', 'Pin note to top')
                            }
                            onClick={(e) => handleTogglePin(note, e)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              note.is_pinned
                                ? 'text-primary bg-primary-soft'
                                : 'text-muted-foreground hover:text-foreground hover:bg-surface-alt sm:opacity-0 sm:group-hover:opacity-100'
                            }`}
                            title={
                              note.is_pinned
                                ? pick('Bỏ ghim', 'Unpin')
                                : pick('Ghim lên đầu', 'Pin to top')
                            }
                          >
                            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                              push_pin
                            </span>
                          </button>
                          <button
                            type="button"
                            aria-label={pick('Xóa ghi chú', 'Delete note')}
                            onClick={(e) => handleRequestDelete(note.id, e)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary-soft transition-colors sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
                            title={pick('Xóa ghi chú', 'Delete note')}
                          >
                            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                              delete
                            </span>
                          </button>
                        </div>
                      </div>

                      <h3 className="font-display font-bold text-base text-foreground mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                        {note.title}
                      </h3>
                      <p className="text-xs text-secondary-text whitespace-pre-line line-clamp-5 leading-relaxed">
                        {note.content || (
                          <span className="italic text-muted-foreground">
                            {pick('Không có nội dung...', 'No content...')}
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="pt-3 mt-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="tabular">
                        {pick('Cập nhật:', 'Updated:')} {formatDate(note.updated_at)}
                      </span>
                      <span className="text-primary font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                        <span>{pick('Mở xem', 'Open')}</span>
                        <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                          arrow_forward
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 paper-card border border-dashed border-border-strong max-w-lg mx-auto my-8 p-6">
              <div className="w-16 h-16 rounded-full bg-primary-soft border border-primary/30 text-primary flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl" aria-hidden="true">
                  edit_note
                </span>
              </div>
              <h3 className="font-display font-bold text-lg text-foreground mb-1">
                {searchQuery.trim() || selectedCategory !== 'Tất cả'
                  ? pick('Không tìm thấy ghi chú phù hợp', 'No matching notes found')
                  : pick('Chưa có ghi chú nào', 'No notes yet')}
              </h3>
              <p className="text-xs text-secondary-text mb-6 max-w-xs mx-auto leading-relaxed">
                {searchQuery.trim() || selectedCategory !== 'Tất cả'
                  ? pick(
                      'Thử đổi từ khóa tìm kiếm hoặc chọn danh mục khác.',
                      'Try adjusting your search keywords or selecting another folder.',
                    )
                  : pick(
                      'Hãy ghi lại những công thức khó nhớ, từ vựng mới hoặc mục tiêu học tập của bạn ngay hôm nay!',
                      'Jot down key formulas, vocabulary lists, or study goals today!',
                    )}
              </p>
              <button
                type="button"
                onClick={() => openModal()}
                className="btn-arena btn-arena-primary btn-arena-sm"
              >
                <span className="material-symbols-outlined text-sm" aria-hidden="true">
                  add
                </span>
                <span>{pick('Viết ghi chú đầu tiên', 'Write your first note')}</span>
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Modal Thêm / Sửa Ghi chú */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[100] bg-foreground/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="imperial-frame w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-5 sm:px-6 py-4 border-b border-border bg-paper">
              <div className="flex flex-wrap items-center gap-1.5">
                {CATEGORIES.filter((c) => c.id !== 'Tất cả').map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    aria-label={pick(
                      `Chọn danh mục ${cat.id}`,
                      `Select category ${getCategoryLabel(cat.id, true)}`,
                    )}
                    onClick={() => setCategory(cat.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                      category === cat.id
                        ? `${cat.bg} ${cat.color} ${cat.border}`
                        : 'bg-surface border-border text-secondary-text hover:text-foreground hover:border-border-strong'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                      {cat.icon}
                    </span>
                    <span>{getCategoryLabel(cat.id, isEn)}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-end gap-1.5 shrink-0">
                <div className="inline-flex p-0.5 rounded-lg bg-surface-alt border border-border">
                  <button
                    type="button"
                    onClick={() => setEditorMode('edit')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                      editorMode === 'edit'
                        ? 'bg-paper text-primary border border-border'
                        : 'text-secondary-text hover:text-foreground'
                    }`}
                  >
                    {pick('Soạn thảo', 'Edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode('preview')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                      editorMode === 'preview'
                        ? 'bg-paper text-primary border border-border'
                        : 'text-secondary-text hover:text-foreground'
                    }`}
                  >
                    {pick('Xem trước', 'Preview')}
                  </button>
                </div>

                <button
                  type="button"
                  aria-label={
                    isPinned
                      ? pick('Bỏ ghim ghi chú', 'Unpin note')
                      : pick('Ghim ghi chú lên đầu', 'Pin note to top')
                  }
                  onClick={() => setIsPinned(!isPinned)}
                  className={`p-2 rounded-xl transition-colors cursor-pointer ${
                    isPinned
                      ? 'bg-primary-soft text-primary'
                      : 'text-muted-foreground hover:bg-surface-alt hover:text-foreground'
                  }`}
                  title={isPinned ? pick('Đã ghim', 'Pinned') : pick('Ghim ghi chú', 'Pin note')}
                >
                  <span className="material-symbols-outlined text-xl" aria-hidden="true">
                    push_pin
                  </span>
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  aria-label={pick('Đóng', 'Close')}
                  className="p-2 rounded-xl text-muted-foreground hover:bg-surface-alt hover:text-foreground transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xl" aria-hidden="true">
                    close
                  </span>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <form
              onSubmit={handleSaveNote}
              className="flex-1 flex flex-col p-5 sm:p-6 overflow-y-auto space-y-4 bg-surface"
            >
              <div>
                <input
                  type="text"
                  maxLength={200}
                  placeholder={pick(
                    'Tiêu đề ghi chú (tối đa 200 ký tự)...',
                    'Note title (max 200 characters)...',
                  )}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-transparent text-xl font-display font-bold text-foreground placeholder:text-muted-foreground focus:outline-none border-b border-border pb-2"
                />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 tabular">
                  <span>
                    {isSaving
                      ? pick('Đang lưu...', 'Saving...')
                      : isDirty
                        ? pick('Chưa lưu thay đổi', 'Unsaved changes')
                        : editingNote
                          ? pick('Đã lưu', 'Saved')
                          : pick('Bản nháp mới', 'New draft')}
                  </span>
                  <span>{title.length}/200</span>
                </div>
              </div>

              <div className="flex-1 flex flex-col">
                {editorMode === 'edit' ? (
                  <textarea
                    maxLength={10000}
                    placeholder={pick(
                      'Nhập nội dung kiến thức, công thức, từ vựng cần nhớ vào đây (tối đa 10.000 ký tự)...',
                      'Write your study notes, formulas, or vocabulary here (max 10,000 characters)...',
                    )}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={12}
                    className="w-full flex-1 bg-paper border border-border rounded-xl p-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary leading-relaxed resize-none"
                  />
                ) : (
                  <div className="w-full flex-1 min-h-[240px] bg-paper border border-border rounded-xl p-4 text-sm text-foreground whitespace-pre-line leading-relaxed overflow-y-auto">
                    {content.trim() ? (
                      content
                    ) : (
                      <span className="italic text-muted-foreground">
                        {pick('Chưa có nội dung để xem trước...', 'Nothing to preview yet...')}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5 tabular">
                  <span>
                    {formatNumber(wordCount)} {pick('từ', wordCount === 1 ? 'word' : 'words')}
                  </span>
                  <span>
                    {formatNumber(content.length)}/{formatNumber(10000)}{' '}
                    {pick('ký tự', 'chars')}
                  </span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-2">
                {editingNote ? (
                  <button
                    type="button"
                    onClick={(e) => handleRequestDelete(editingNote.id, e)}
                    className="flex items-center gap-1 text-xs font-bold text-primary hover:bg-primary-soft px-3 py-2 rounded-xl transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      delete
                    </span>
                    <span>{pick('Xóa ghi chú', 'Delete note')}</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="btn-arena btn-arena-secondary btn-arena-sm"
                  >
                    {pick('Hủy', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="btn-arena btn-arena-primary btn-arena-sm"
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      {isSaving ? 'sync' : 'check'}
                    </span>
                    <span>
                      {isSaving ? pick('Đang lưu...', 'Saving...') : pick('Lưu ghi chú', 'Save Note')}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete */}
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
              <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                  delete_forever
                </span>
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-foreground">
                  {pick('Xác nhận xoá ghi chú', 'Confirm Note Deletion')}
                </h3>
                <p className="text-xs text-secondary-text mt-0.5">
                  {pick('Hành động này không thể hoàn tác.', 'This action cannot be undone.')}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="btn-arena btn-arena-secondary btn-arena-sm"
              >
                {pick('Hủy', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="btn-arena btn-arena-primary btn-arena-sm"
              >
                {pick('Xóa vĩnh viễn', 'Delete Permanently')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
