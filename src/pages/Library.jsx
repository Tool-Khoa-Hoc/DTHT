import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { DOCUMENT_SELECT_FIELDS, getDocumentKindMeta } from '../lib/documents';
import { useAuth } from '../contexts/AuthContext';
import SectionHeading from '../components/ui/SectionHeading';
import RankSeal from '../components/ui/RankSeal';

const GRADES = ['Lớp 10', 'Lớp 11', 'Lớp 12'];
const SUBJECTS = ['Tất cả', 'Toán', 'Vật Lý', 'Hóa Học', 'Sinh Học', 'Tiếng Anh', 'Ngữ Văn'];

export default function Library() {
  const { isAdmin, isCollaborator } = useAuth();
  const [selectedGrade, setSelectedGrade] = useState('Lớp 12');
  const [selectedSubject, setSelectedSubject] = useState('Tất cả');
  const [searchQuery, setSearchQuery] = useState('');
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select(DOCUMENT_SELECT_FIELDS)
        .eq('grade', selectedGrade)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setDocuments(data);
    } catch (error) {
      console.error('Lỗi tải tài liệu:', error.message);
    } finally {
      setLoading(false);
    }
  }, [selectedGrade]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const filteredDocs = documents.filter((doc) => {
    const matchSubject = selectedSubject === 'Tất cả' || doc.subject === selectedSubject;
    const matchSearch = (doc.title || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchSubject && matchSearch;
  });

  const getSubjectIcon = (subject) => {
    switch (subject) {
      case 'Toán':
        return { icon: 'functions', color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200' };
      case 'Vật Lý':
        return { icon: 'bolt', color: 'text-accent', bg: 'bg-gold-soft border-gold' };
      case 'Hóa Học':
        return { icon: 'science', color: 'text-jade', bg: 'bg-jade-soft border-jade-border' };
      case 'Sinh Học':
        return { icon: 'biotech', color: 'text-completed', bg: 'bg-completed-soft border-completed-border' };
      case 'Tiếng Anh':
        return { icon: 'language', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' };
      case 'Ngữ Văn':
        return { icon: 'menu_book', color: 'text-primary', bg: 'bg-primary-soft border-primary/30' };
      default:
        return { icon: 'description', color: 'text-secondary-text', bg: 'bg-surface-alt border-border' };
    }
  };

  return (
    <div className="bg-background font-sans text-foreground min-h-full pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Header & Search */}
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
                Thư Viện Tài Liệu Học Free
              </h1>
              <p className="text-xs sm:text-sm text-secondary-text mt-1">
                Kho đề thi thử, chuyên đề và sơ đồ tư duy chọn lọc cho học sinh THPT
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
                  <span>Đăng tài liệu mới</span>
                </Link>
              )}
            </div>
          </div>

          <div className="relative z-10 flex flex-col gap-3">
            {/* Search Input */}
            <div className="relative flex items-center w-full">
              <span
                className="material-symbols-outlined absolute left-4 text-muted-foreground"
                aria-hidden="true"
              >
                search
              </span>
              <input
                className="w-full pl-12 pr-10 py-3 bg-surface border border-border-strong rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-sm text-foreground placeholder:text-muted-foreground transition-all"
                placeholder="Tìm kiếm tài liệu, đề thi, chuyên đề..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Xoá tìm kiếm"
                  className="absolute right-4 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">
                    close
                  </span>
                </button>
              )}
            </div>

            {/* Grade Selector (Segmented Control) */}
            <div className="grid grid-cols-3 gap-2 p-1.5 bg-surface-alt rounded-xl border border-border">
              {GRADES.map((grade) => (
                <button
                  key={grade}
                  type="button"
                  onClick={() => setSelectedGrade(grade)}
                  className={`py-2 text-sm font-display font-bold rounded-lg transition-all cursor-pointer ${
                    selectedGrade === grade
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'text-secondary-text hover:text-foreground'
                  }`}
                >
                  {grade}
                </button>
              ))}
            </div>

            {/* Subject Filter Chips */}
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {SUBJECTS.map((subject) => (
                <button
                  key={subject}
                  type="button"
                  onClick={() => setSelectedSubject(subject)}
                  aria-pressed={selectedSubject === subject}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                    selectedSubject === subject
                      ? 'bg-primary-soft text-primary border-primary/40 shadow-2xs'
                      : 'bg-surface text-secondary-text border-border hover:border-border-strong hover:text-foreground'
                  }`}
                >
                  {subject}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Main Content: Document List */}
        <main className="space-y-4">
          <SectionHeading
            eyebrow={selectedGrade}
            title={`Tài liệu ${selectedSubject === 'Tất cả' ? 'tất cả các môn' : selectedSubject}`}
            action={
              <span className="paper-chip tabular font-bold text-primary bg-primary-soft border-primary/30">
                {filteredDocs.length} tài liệu
              </span>
            }
          />

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <span
                className="material-symbols-outlined animate-spin text-3xl text-primary"
                aria-hidden="true"
              >
                sync
              </span>
            </div>
          ) : filteredDocs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredDocs.map((doc) => {
                const style = getSubjectIcon(doc.subject);
                const kindMeta = getDocumentKindMeta(doc.file_name, doc.file_url);
                return (
                  <div
                    key={doc.id}
                    className="content-auto paper-card paper-card-interactive p-4 flex items-start gap-4 group"
                  >
                    <div
                      className={`w-12 h-12 rounded-xl border ${style.bg} flex items-center justify-center no-shrink ${style.color} group-hover:scale-105 transition-transform`}
                    >
                      <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                        {style.icon}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-alt text-secondary-text border border-border">
                          {doc.subject}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gold-soft text-gold-dark border border-gold">
                          {doc.category}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded inline-flex items-center gap-1 ${kindMeta.badgeClass}`}
                        >
                          <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                            {kindMeta.icon}
                          </span>
                          {kindMeta.label}
                        </span>
                      </div>

                      <h3 className="font-display font-bold text-sm sm:text-base text-foreground leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                        {doc.title}
                      </h3>

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                              calendar_month
                            </span>
                            {new Date(doc.created_at).toLocaleDateString('vi-VN')}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                              folder_open
                            </span>
                            {doc.file_size}
                          </span>
                        </div>

                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary font-bold hover:underline bg-primary-soft border border-primary/25 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-base" aria-hidden="true">
                            open_in_new
                          </span>
                          {kindMeta.actionLabel}
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 paper-card border-dashed">
              <span
                className="material-symbols-outlined text-4xl text-muted-foreground mb-2"
                aria-hidden="true"
              >
                search_off
              </span>
              <p className="text-foreground font-display font-bold text-base">
                Không tìm thấy tài liệu nào
              </p>
              <p className="text-xs text-secondary-text mt-1">
                Thử thay đổi bộ lọc môn học hoặc từ khóa tìm kiếm nhé!
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
