import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

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
  { label: 'GDCD', value: 'gdcd' },
  { label: 'Tin Học', value: 'tin' },
  { label: 'Giải Tích', value: 'giai_tich' },
  { label: 'Lập Trình', value: 'lap_trinh' },
  { label: 'Kiến Trúc', value: 'kien_truc' },
  { label: 'Kinh Tế', value: 'kinh_te' },
  { label: 'Khác', value: 'khac' },
];

export default function Library() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [educationLevel, setEducationLevel] = useState('thpt'); // 'thpt' | 'university'

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, file_url, category, education_level, uploaded_by, author_name, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDocs = documents.filter(doc => {
    const matchEduLevel = (doc.education_level || 'thpt') === educationLevel;
    const matchCat = !activeCategory || doc.category === activeCategory;
    const matchSearch = !searchQuery
      || doc.title?.toLowerCase().includes(searchQuery.toLowerCase())
      || doc.author_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchEduLevel && matchCat && matchSearch;
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0c14] text-white font-display pb-24">
      {/* Background Mesh */}
      <div className="fixed inset-0 bg-[radial-gradient(at_0%_0%,#4f46e5_0px,transparent_50%),radial-gradient(at_100%_0%,#7e22ce_0px,transparent_50%),radial-gradient(at_100%_100%,#3b82f6_0px,transparent_50%),radial-gradient(at_0%_100%,#ec4899_0px,transparent_50%)] opacity-30 pointer-events-none"></div>

      <div className="w-full max-w-6xl mx-auto flex flex-col flex-1 relative z-10">
        <header className="sticky top-0 z-50 px-4 pt-6 pb-4 bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/5 mt-0 md:mt-4 md:rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigate(-1)} className="md:hidden flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined">arrow_back_ios_new</span>
            </button>
            <h1 className="text-xl font-bold tracking-tight">Tài Liệu Học Free</h1>
            <button className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined">notifications</span>
            </button>
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
              onClick={() => setEducationLevel('thpt')}
              className={`flex-1 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1 sm:gap-2 ${educationLevel === 'thpt' ? 'bg-[#306ee8] text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <span className="material-symbols-outlined text-[16px] sm:text-[18px]">menu_book</span> THPT Quốc Gia
            </button>
            <button
              onClick={() => setEducationLevel('university')}
              className={`flex-1 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1 sm:gap-2 ${educationLevel === 'university' ? 'bg-[#7f13ec] text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <span className="material-symbols-outlined text-[16px] sm:text-[18px]">school</span> Đại Học
            </button>
          </div>
        </header>

        <main className="flex-1 relative z-10 pt-2">
          {/* Categories */}
          <div className="flex gap-2 p-4 overflow-x-auto no-scrollbar">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`shrink-0 px-4 py-1.5 sm:px-5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors ${activeCategory === cat.value
                  ? 'bg-[#306ee8] text-white shadow-lg shadow-[#306ee8]/25'
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
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                  {featured.map(doc => (
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
                        {doc.category && (
                          <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-400/70 bg-amber-500/10 rounded px-1.5 py-0.5 w-fit mt-1 inline-block">
                            {CATEGORIES.find(c => c.value === doc.category)?.label || doc.category}
                          </span>
                        )}
                      </div>
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-auto w-full py-1.5 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-colors border border-amber-500/20"
                      >
                        <span className="material-symbols-outlined text-[14px]">download</span> Tải về
                      </a>
                    </div>
                  ))}
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
              filteredDocs.map(doc => (
                <div key={doc.id} className="bg-white/5 backdrop-blur-md border border-white/10 p-2.5 sm:p-3 rounded-2xl flex flex-col gap-2.5 sm:gap-3 hover:bg-white/10 transition-colors cursor-pointer group">
                  <div className="aspect-[4/3] rounded-xl bg-[#306ee8]/20 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-overlay bg-gradient-to-br from-indigo-500 to-purple-500 group-hover:scale-110 transition-transform duration-500"></div>
                    <span className="material-symbols-outlined text-3xl sm:text-4xl text-white drop-shadow-md relative z-10">picture_as_pdf</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <h3 className="font-bold text-sm line-clamp-2 leading-snug">{doc.title}</h3>
                    {doc.uploaded_by ? (
                      <Link to={`/profile/${doc.uploaded_by}`} className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline">
                        {doc.author_name}
                      </Link>
                    ) : (
                      <p className="text-[11px] text-slate-400">{doc.author_name}</p>
                    )}
                    {doc.category && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#306ee8]/80 bg-[#306ee8]/10 rounded px-1.5 py-0.5 w-fit mt-0.5">
                        {CATEGORIES.find(c => c.value === doc.category)?.label || doc.category}
                      </span>
                    )}
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-1">{doc.description}</p>
                  </div>
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-1.5 sm:py-2 bg-[#306ee8]/20 hover:bg-[#306ee8]/40 text-blue-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-colors border border-[#306ee8]/20 mt-auto"
                  >
                    <span className="material-symbols-outlined text-[14px] sm:text-[16px]">download</span> Tải về
                  </a>
                </div>
              ))
            )}
          </div>
        </main>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
