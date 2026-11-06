import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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

const CATEGORIES = [
  {
    id: 'Tất cả',
    label: 'Tất cả',
    icon: 'grid_view',
    color: 'text-secondary-text',
    bg: 'bg-surface-alt',
    border: 'border-border-strong',
  },
  {
    id: 'Công thức',
    label: 'Công thức',
    icon: 'functions',
    color: 'text-sky-800 dark:text-sky-300',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    border: 'border-sky-300 dark:border-sky-800',
  },
  {
    id: 'Từ vựng',
    label: 'Từ vựng',
    icon: 'translate',
    color: 'text-jade',
    bg: 'bg-jade-soft',
    border: 'border-jade-border',
  },
  {
    id: 'Lịch sử / Văn',
    label: 'Lịch sử / Văn',
    icon: 'history_edu',
    color: 'text-gold-dark dark:text-accent',
    bg: 'bg-gold-soft',
    border: 'border-gold',
  },
  {
    id: 'Nhắc nhở',
    label: 'Nhắc nhở',
    icon: 'notifications_active',
    color: 'text-primary',
    bg: 'bg-primary-soft',
    border: 'border-primary/35',
  },
  {
    id: 'Khác',
    label: 'Khác',
    icon: 'push_pin',
    color: 'text-indigo-800 dark:text-indigo-300',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    border: 'border-indigo-200 dark:border-indigo-800',
  },
];

export default function Notes() {
  const { user } = useAuth();
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
      showToast('Không thể tải danh sách ghi chú: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const openModal = (note = null) => {
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
      showToast('Vui lòng đăng nhập để lưu ghi chú!', 'warning');
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle && !trimmedContent) {
      showToast('Vui lòng nhập tiêu đề hoặc nội dung ghi chú!', 'warning');
      return;
    }

    if (trimmedTitle.length > 200) {
      showToast('Tiêu đề ghi chú không được vượt quá 200 ký tự!', 'warning');
      return;
    }

    if (trimmedContent.length > 10000) {
      showToast('Nội dung ghi chú không được vượt quá 10.000 ký tự!', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();

      if (editingNote) {
        // ONLY send valid columns: title, content, updated_at
        const { error } = await supabase
          .from('user_notes')
          .update({
            title: trimmedTitle || 'Ghi chú mới',
            content: trimmedContent,
            updated_at: nowIso,
          })
          .eq('id', editingNote.id);

        if (error) throw error;

        saveNoteMeta(editingNote.id, { category, is_pinned: isPinned });
        showToast('Đã lưu thay đổi ghi chú thành công!', 'success');
      } else {
        // ONLY send valid columns: user_id, title, content
        const { data, error } = await supabase
          .from('user_notes')
          .insert([
            {
              user_id: user.id,
              title: trimmedTitle || 'Ghi chú mới',
              content: trimmedContent,
            },
          ])
          .select()
          .single();

        if (error) throw error;

        if (data?.id) {
          saveNoteMeta(data.id, { category, is_pinned: isPinned });
        }
        showToast('Đã tạo ghi chú mới thành công!', 'success');
      }

      closeModal();
      fetchNotes();
    } catch (error) {
      showToast('Lỗi khi lưu ghi chú: ' + (error.message || 'Thử lại sau.'), 'error');
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
      newPinStatus ? 'Đã ghim ghi chú lên đầu' : 'Đã bỏ ghim ghi chú',
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
      showToast('Đã xóa ghi chú', 'info', 2500);
    } catch (error) {
      showToast('Lỗi khi xóa ghi chú: ' + error.message, 'error');
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
                <RankSeal size="sm" icon="edit_note" label="Thư Phòng Bút Ký" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-foreground">
                Sổ Tay Kiến Thức
              </h1>
              <p className="text-xs sm:text-sm text-secondary-text mt-1">
                Lưu trữ công thức, từ vựng và những lưu ý quan trọng cho kỳ thi THPT &amp; ĐGNL
              </p>
            </div>
            {user ? (
              <button
                type="button"
                onClick={() => openModal()}
                className="btn-arena btn-arena-primary"
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">
                  add
                </span>
                <span>Tạo ghi chú mới</span>
              </button>
            ) : (
              <Link to="/auth" className="btn-arena btn-arena-primary">
                <span className="material-symbols-outlined text-lg" aria-hidden="true">
                  login
                </span>
                <span>Đăng nhập để ghi chép</span>
              </Link>
            )}
          </div>

          {/* Search & Filter */}
          <div className="relative z-10 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <span
                className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              >
                search
              </span>
              <input
                type="text"
                placeholder="Tìm kiếm trong ghi chú của bạn..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-10 py-3 bg-surface border border-border-strong rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-sm text-foreground placeholder:text-muted-foreground transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Xoá tìm kiếm"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">
                    close
                  </span>
                </button>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                    selectedCategory === cat.id
                      ? `${cat.bg} ${cat.color} ${cat.border} shadow-2xs`
                      : 'bg-surface border-border text-secondary-text hover:text-foreground hover:border-border-strong'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                    {cat.icon}
                  </span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main>
          {!user ? (
            <div className="text-center py-16 paper-card border-dashed max-w-lg mx-auto my-8 p-6">
              <div className="w-16 h-16 rounded-2xl bg-primary-soft border border-primary/30 text-primary flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl" aria-hidden="true">
                  edit_note
                </span>
              </div>
              <h3 className="font-display font-bold text-lg text-foreground mb-1">
                Đăng nhập để sử dụng Sổ Tay Kiến Thức
              </h3>
              <p className="text-xs text-secondary-text mb-6 max-w-xs mx-auto leading-relaxed">
                Ghi chú của bạn được đồng bộ an toàn trên hệ thống máy chủ để truy cập trên mọi thiết bị máy tính lẫn điện thoại.
              </p>
              <Link to="/auth" className="btn-arena btn-arena-primary btn-arena-sm">
                <span className="material-symbols-outlined text-sm" aria-hidden="true">
                  login
                </span>
                Đăng nhập ngay
              </Link>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-20">
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
                    className={`group relative paper-card paper-card-interactive p-5 flex flex-col justify-between cursor-pointer h-64 ${
                      note.is_pinned ? 'border-gold ring-1 ring-gold/40 bg-paper' : ''
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
                          {note.category}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={note.is_pinned ? 'Bỏ ghim ghi chú' : 'Ghim ghi chú lên đầu'}
                            onClick={(e) => handleTogglePin(note, e)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              note.is_pinned
                                ? 'text-primary bg-primary-soft'
                                : 'text-muted-foreground hover:text-foreground hover:bg-surface-alt sm:opacity-0 sm:group-hover:opacity-100'
                            }`}
                            title={note.is_pinned ? 'Bỏ ghim' : 'Ghim lên đầu'}
                          >
                            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                              push_pin
                            </span>
                          </button>
                          <button
                            type="button"
                            aria-label="Xóa ghi chú"
                            onClick={(e) => handleRequestDelete(note.id, e)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary-soft transition-colors sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
                            title="Xóa ghi chú"
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
                          <span className="italic text-muted-foreground">Không có nội dung...</span>
                        )}
                      </p>
                    </div>

                    <div className="pt-3 mt-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>
                        Cập nhật: {new Date(note.updated_at).toLocaleDateString('vi-VN')}
                      </span>
                      <span className="text-primary font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                        Mở xem{' '}
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
            <div className="text-center py-16 paper-card border-dashed max-w-lg mx-auto my-8 p-6">
              <div className="w-16 h-16 rounded-full bg-primary-soft border border-primary/30 text-primary flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl" aria-hidden="true">
                  edit_note
                </span>
              </div>
              <h3 className="font-display font-bold text-lg text-foreground mb-1">
                Chưa có ghi chú nào
              </h3>
              <p className="text-xs text-secondary-text mb-6 max-w-xs mx-auto leading-relaxed">
                Hãy ghi lại những công thức khó nhớ, từ vựng mới hoặc mục tiêu học tập của bạn ngay hôm nay!
              </p>
              <button
                type="button"
                onClick={() => openModal()}
                className="btn-arena btn-arena-primary btn-arena-sm"
              >
                <span className="material-symbols-outlined text-sm" aria-hidden="true">
                  add
                </span>
                Viết ghi chú đầu tiên
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-paper">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {CATEGORIES.filter((c) => c.id !== 'Tất cả').map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                      category === cat.id
                        ? `${cat.bg} ${cat.color} ${cat.border}`
                        : 'bg-surface border-border text-secondary-text hover:text-foreground'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                      {cat.icon}
                    </span>
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 no-shrink ml-2">
                <button
                  type="button"
                  aria-label={isPinned ? 'Bỏ ghim ghi chú' : 'Ghim ghi chú lên đầu'}
                  onClick={() => setIsPinned(!isPinned)}
                  className={`p-2 rounded-xl transition-colors cursor-pointer ${
                    isPinned
                      ? 'bg-primary-soft text-primary'
                      : 'text-muted-foreground hover:bg-surface-alt hover:text-foreground'
                  }`}
                  title={isPinned ? 'Đã ghim' : 'Ghim ghi chú'}
                >
                  <span className="material-symbols-outlined text-xl" aria-hidden="true">
                    push_pin
                  </span>
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  aria-label="Đóng"
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
              className="flex-1 flex flex-col p-6 overflow-y-auto space-y-4 bg-surface"
            >
              <div>
                <input
                  type="text"
                  maxLength={200}
                  placeholder="Tiêu đề ghi chú (tối đa 200 ký tự)..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-transparent text-xl font-display font-bold text-foreground placeholder:text-muted-foreground focus:outline-none border-b border-border pb-2"
                />
                <div className="text-[10px] text-muted-foreground text-right mt-1 tabular">
                  {title.length}/200
                </div>
              </div>

              <div className="flex-1 flex flex-col">
                <textarea
                  maxLength={10000}
                  placeholder="Nhập nội dung kiến thức, công thức, từ vựng cần nhớ vào đây (tối đa 10.000 ký tự)..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={12}
                  className="w-full flex-1 bg-paper border border-border rounded-xl p-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary leading-relaxed resize-none"
                />
                <div className="text-[10px] text-muted-foreground text-right mt-1 tabular">
                  {content.length}/10000
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-border flex items-center justify-between">
                {editingNote ? (
                  <button
                    type="button"
                    onClick={(e) => handleRequestDelete(editingNote.id, e)}
                    className="flex items-center gap-1 text-xs font-bold text-primary hover:bg-primary-soft px-3 py-2 rounded-xl transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      delete
                    </span>
                    Xóa ghi chú
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="btn-arena btn-arena-secondary btn-arena-sm"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="btn-arena btn-arena-primary btn-arena-sm"
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      {isSaving ? 'sync' : 'check'}
                    </span>
                    {isSaving ? 'Đang lưu...' : 'Lưu ghi chú'}
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
              <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center no-shrink">
                <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                  delete_forever
                </span>
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-foreground">
                  Xác nhận xoá ghi chú
                </h3>
                <p className="text-xs text-secondary-text mt-0.5">
                  Hành động này không thể hoàn tác.
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
                Xóa vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
