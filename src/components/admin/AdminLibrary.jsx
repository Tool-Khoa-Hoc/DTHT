import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { assertSafeExternalUrl } from '../../utils/urlSecurity';

const CATEGORIES = [
  { label: 'Toán', value: 'toan', icon: 'calculate', color: 'from-blue-500 to-indigo-600' },
  { label: 'Vật Lý', value: 'ly', icon: 'experiment', color: 'from-amber-500 to-orange-600' },
  { label: 'Hóa Học', value: 'hoa', icon: 'science', color: 'from-green-500 to-emerald-600' },
  { label: 'Sinh Học', value: 'sinh', icon: 'biotech', color: 'from-teal-500 to-cyan-600' },
  { label: 'Ngữ Văn', value: 'van', icon: 'menu_book', color: 'from-rose-500 to-pink-600' },
  { label: 'Tiếng Anh', value: 'anh', icon: 'language', color: 'from-sky-500 to-blue-600' },
  { label: 'Lịch Sử', value: 'su', icon: 'history_edu', color: 'from-yellow-600 to-amber-700' },
  { label: 'Địa Lý', value: 'dia', icon: 'public', color: 'from-lime-500 to-green-600' },
  { label: 'GDCD', value: 'gdcd', icon: 'gavel', color: 'from-purple-500 to-violet-600' },
  { label: 'Tin Học', value: 'tin', icon: 'computer', color: 'from-cyan-500 to-sky-600' },
  { label: 'Giải Tích', value: 'giai_tich', icon: 'functions', color: 'from-indigo-500 to-purple-600' },
  { label: 'Lập Trình', value: 'lap_trinh', icon: 'code', color: 'from-slate-500 to-gray-600' },
  { label: 'Kiến Trúc', value: 'kien_truc', icon: 'architecture', color: 'from-orange-500 to-red-500' },
  { label: 'Kinh Tế', value: 'kinh_te', icon: 'trending_up', color: 'from-emerald-500 to-teal-600' },
  { label: 'Khác', value: 'khac', icon: 'folder', color: 'from-gray-400 to-slate-500' },
];

export default function AdminLibrary({ isActive }) {
  const { user } = useAuth();
// Library Form State
  const [docId, setDocId] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [publishDate, setPublishDate] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [major, setMajor] = useState('');
  const [category, setCategory] = useState('khac');
  const [isFeatured, setIsFeatured] = useState(false);
  const [educationLevel, setEducationLevel] = useState('thpt');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);


  useEffect(() => {
    if (isActive) {
      fetchDocuments();
    }
  }, [isActive]);

  const fetchDocuments = async () => {
    setLoadingDocs(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, file_url, category, education_level, uploaded_by, author_name, created_at, is_featured, publish_date, major, document_reports(id, reason, created_at, document_id, reported_by, documents(id, title, author_name))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents', error);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleLibrarySubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const safeFileUrl = assertSafeExternalUrl(fileUrl);

      if (docId) {
        // Update existing document
        const { error } = await supabase
          .from('documents')
          .update({
            title,
            description,
            file_url: safeFileUrl,
            author_name: authorName || 'Khuyết danh',
            category: educationLevel === 'university' ? (category || 'Chuyên ngành') : category,
            major: educationLevel === 'university' ? major : null,
            is_featured: isFeatured,
            education_level: educationLevel,
            publish_date: publishDate || null
          })
          .eq('id', docId);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Tài liệu đã được cập nhật thành công!' });
      } else {
        // Insert new document
        const { error } = await supabase
          .from('documents')
          .insert([
            {
              title,
              description,
              file_url: safeFileUrl,
              author_name: authorName || 'Khuyết danh',
              uploaded_by: user.id,
              is_public: true,
              category: educationLevel === 'university' ? (category || 'Chuyên ngành') : category,
              major: educationLevel === 'university' ? major : null,
              is_featured: isFeatured,
              education_level: educationLevel,
              publish_date: publishDate || null
            }
          ]);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Tài liệu đã được đăng tải thành công!' });
      }

      // Reset form & refresh list
      resetForm();
      fetchDocuments();
    } catch (error) {
      console.error('Error saving document:', error);
      setMessage({ type: 'error', text: 'Có lỗi xảy ra: ' + error.message });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa tài liệu này vĩnh viễn?")) return;

    try {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
      setDocuments(documents.filter(d => d.id !== id));
      if (docId === id) resetForm(); // If deleting what is currently being edited
    } catch (error) {
      alert("Lỗi khi xóa tài liệu: " + error.message);
    }
  };

  const toggleFeatured = async (id, currentStatus) => {
    try {
      const { error } = await supabase
        .from('documents')
        .update({ is_featured: !currentStatus })
        .eq('id', id);
      if (error) throw error;
      setDocuments(documents.map(d => d.id === id ? { ...d, is_featured: !currentStatus } : d));
      if (docId === id) setIsFeatured(!currentStatus);
    } catch (error) {
      alert("Lỗi khi cập nhật trạng thái: " + error.message);
    }
  };

  const handleEdit = (doc) => {
    setDocId(doc.id);
    setTitle(doc.title);
    setDescription(doc.description || '');
    setFileUrl(doc.file_url);
    setAuthorName(doc.author_name || '');
    setMajor(doc.major || '');
    setCategory(doc.category || 'khac');
    setIsFeatured(doc.is_featured || false);
    setEducationLevel(doc.education_level || 'thpt');
    setPublishDate(doc.publish_date || '');

    // Scroll to form automatically
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setDocId(null);
    setTitle('');
    setDescription('');
    setFileUrl('');
    setAuthorName('');
    setMajor('');
    setCategory('khac');
    setIsFeatured(false);
    setEducationLevel('thpt');
    setPublishDate('');
  };


  if (!isActive) return null;

  return (
    <>
      
          <div className="bg-white dark:bg-[#201216] border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2 text-[#7f13ec]">
                <span className="material-symbols-outlined">{docId ? 'edit_document' : 'upload_file'}</span>
                {docId ? 'Cập nhật tài liệu' : 'Thêm tài liệu mới'}
              </h2>
              {docId && (
                <button onClick={resetForm} className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">close</span> Hủy sửa
                </button>
              )}
            </div>

            {message.text && (
              <div className={`p-4 rounded-xl mb-6 text-sm font-medium ${message.type === 'success' ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'}`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleLibrarySubmit} className="space-y-5">
              {/* Form fields... (reusing existing UI) */}
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-300">Tiêu đề tài liệu <span className="text-red-500">*</span></label>
                <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#7f13ec]/50 focus:border-[#7f13ec] transition-all text-slate-900 dark:text-white" placeholder="VD: Đề thi Giải tích 1 HK231" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-300">Mô tả ngắn</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="3" className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#7f13ec]/50 focus:border-[#7f13ec] transition-all text-slate-900 dark:text-white resize-none" placeholder="Nhập nội dung mô tả..."></textarea>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-300">Tác giả / Nguồn tài liệu</label>
                <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#7f13ec]/50 focus:border-[#7f13ec] transition-all text-slate-900 dark:text-white" placeholder="VD: Nguyễn Văn A hoặc PĐT Bách Khoa" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-300">Ngày - tháng - năm <span className="text-slate-400 font-normal">(Tùy chọn)</span></label>
                <input type="date" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#7f13ec]/50 focus:border-[#7f13ec] transition-all text-slate-900 dark:text-white dark:[color-scheme:dark]" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300">Phân loại cấp học <span className="text-red-500">*</span></label>
                <div className="flex gap-4">
                  <label className="flex-1 cursor-pointer">
                    <input type="radio" name="educationLevel" value="thpt" checked={educationLevel === 'thpt'} onChange={(e) => setEducationLevel(e.target.value)} className="hidden peer" />
                    <div className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-semibold peer-checked:border-[#306ee8] peer-checked:bg-[#306ee8]/10 peer-checked:text-[#306ee8] border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:border-[#306ee8]/50">
                      <span className="material-symbols-outlined text-[20px]">menu_book</span> THPT Quốc Gia
                    </div>
                  </label>
                  <label className="flex-1 cursor-pointer">
                    <input type="radio" name="educationLevel" value="university" checked={educationLevel === 'university'} onChange={(e) => setEducationLevel(e.target.value)} className="hidden peer" />
                    <div className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-semibold peer-checked:border-[#7f13ec] peer-checked:bg-[#7f13ec]/10 peer-checked:text-[#7f13ec] border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:border-[#7f13ec]/50">
                      <span className="material-symbols-outlined text-[20px]">school</span> Đại Học
                    </div>
                  </label>
                </div>
              </div>

              {educationLevel === 'university' && (
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-300">Trường / Ngành học <span className="text-red-500">*</span></label>
                  <input required value={major} onChange={(e) => setMajor(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#7f13ec]/50 focus:border-[#7f13ec] transition-all text-slate-900 dark:text-white" placeholder="VD: ĐH Bách Khoa, CNTT, Y Dược..." />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300">{educationLevel === 'university' ? 'Tên Môn học / Học phần ' : 'Danh mục / Môn học '}<span className="text-red-500">*</span></label>
                {educationLevel === 'university' ? (
                  <input required value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#7f13ec]/50 focus:border-[#7f13ec] transition-all text-slate-900 dark:text-white" placeholder="VD: Giải tích 1, Toán cao cấp..." />
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {CATEGORIES.map(cat => (
                      <button key={cat.value} type="button" onClick={() => setCategory(cat.value)} className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all text-xs font-semibold ${category === cat.value ? 'border-[#7f13ec] bg-[#7f13ec]/10 text-[#7f13ec]' : 'border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/3 text-slate-500 dark:text-slate-400 hover:border-[#7f13ec]/40 hover:text-[#7f13ec]'}`}>
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${cat.color} flex items-center justify-center`}><span className="material-symbols-outlined text-white text-base">{cat.icon}</span></div>
                        {cat.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-300">Link Google Drive / Tải về <span className="text-red-500">*</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none"><span className="material-symbols-outlined text-slate-400">link</span></div>
                  <input required type="url" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-[#7f13ec]/50 focus:border-[#7f13ec] transition-all text-slate-900 dark:text-white" placeholder="https://drive.google.com/..." />
                </div>
              </div>

              <div onClick={() => setIsFeatured(!isFeatured)} className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${isFeatured ? 'border-amber-500 bg-amber-500/10' : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/3 hover:border-amber-400/50'}`}>
                <div className="flex items-center gap-3">
                  <span className={`material-symbols-outlined text-2xl ${isFeatured ? 'text-amber-400' : 'text-slate-400'}`}>star</span>
                  <div>
                    <p className={`font-semibold text-sm ${isFeatured ? 'text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>Ghim làm Tài liệu nổi bật</p>
                    <p className="text-xs text-slate-500">Hiển thị ở đầu trang Tài Liệu Học Free</p>
                  </div>
                </div>
                <div className={`w-12 h-6 rounded-full transition-all relative ${isFeatured ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${isFeatured ? 'left-6' : 'left-0.5'}`} />
                </div>
              </div>

              <div className="pt-4">
                <button type="submit" disabled={loading} className="w-full py-4 bg-[#7f13ec] text-white rounded-xl font-bold text-lg shadow-lg shadow-[#7f13ec]/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:hover:scale-100 flex items-center justify-center gap-2">
                  {loading ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">{docId ? 'save' : 'cloud_upload'}</span>}
                  {loading ? 'Đang xử lý...' : (docId ? 'Cập nhật tài liệu' : 'Đăng tải tài liệu')}
                </button>
              </div>
            </form>

            {/* List of Documents */}
            <div className="mt-12">
              <h3 className="text-md font-bold mb-4 flex items-center gap-2 border-t border-slate-200 dark:border-white/10 pt-8">
                <span className="material-symbols-outlined text-slate-400">format_list_bulleted</span>
                Danh sách tài liệu hệ thống
              </h3>

              {loadingDocs ? (
                <div className="flex justify-center py-8"><span className="material-symbols-outlined animate-spin text-[#7f13ec]">sync</span></div>
              ) : documents.length === 0 ? (
                <p className="text-center text-sm text-slate-500 italic py-6">Chưa có tài liệu nào.</p>
              ) : (
                <div className="space-y-3">
                  {documents.map(doc => {
                    const catInfo = CATEGORIES.find(c => c.value === doc.category) || CATEGORIES[CATEGORIES.length - 1];
                    return (
                      <div key={doc.id} className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 hover:border-[#7f13ec]/30 transition-all group">
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${doc.is_featured ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                              {doc.is_featured ? 'Nổi bật' : catInfo.label}
                            </span>
                            <h4 className="font-bold text-sm truncate" title={doc.title}>{doc.title}</h4>
                          </div>
                          <p className="text-xs text-slate-500 truncate">{doc.description || 'Không có mô tả'}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 border-t sm:border-t-0 border-slate-200 dark:border-white/10 pt-3 sm:pt-0">
                          <button
                            onClick={() => toggleFeatured(doc.id, doc.is_featured)}
                            title={doc.is_featured ? "Bỏ ghim" : "Ghim nổi bật"}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${doc.is_featured ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 hover:text-amber-500'}`}
                          >
                            <span className="material-symbols-outlined text-[18px]">star</span>
                          </button>
                          <button
                            onClick={() => handleEdit(doc)}
                            title="Sửa"
                            className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-[#7f13ec]/10 hover:text-[#7f13ec] flex items-center justify-center transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            title="Xóa"
                            className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-red-500/10 hover:text-red-500 flex items-center justify-center transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        
    </>
  );
}
