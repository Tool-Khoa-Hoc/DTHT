import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Navigate } from 'react-router-dom';
import AdmissionsAdmin from './AdmissionsAdmin';

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

export default function Admin() {
  const { user, profile } = useAuth();

  const [mainTab, setMainTab] = useState('library'); // 'library' | 'admissions'

  // Library Form State
  const [docId, setDocId] = useState(null); // null means adding new
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [publishDate, setPublishDate] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [major, setMajor] = useState('');
  const [category, setCategory] = useState('khac');
  const [isFeatured, setIsFeatured] = useState(false);
  const [educationLevel, setEducationLevel] = useState('thpt'); // 'thpt' | 'university'
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // List State
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  // Thống Soái State
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  // Collaborator State
  const [collabSearchTerm, setCollabSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [loadingCollabs, setLoadingCollabs] = useState(false);

  // Security Check: Kick out non-admins
  if (profile?.role !== 'admin') {
    return <Navigate to="/home" />;
  }

  useEffect(() => {
    if (mainTab === 'library') {
      fetchDocuments();
    } else if (mainTab === 'thongsoai') {
      fetchCandidates();
    } else if (mainTab === 'collaborators') {
      fetchCollaborators();
    }
  }, [mainTab]);

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

  const fetchCandidates = async () => {
    setLoadingCandidates(true);
    try {
      const { data: camps } = await supabase.from('campaigns').select('user_id').eq('is_completed', true);
      if (camps) {
        const counts = {};
        camps.forEach(c => Object.assign(counts, { [c.user_id]: (counts[c.user_id] || 0) + 1 }));

        const eligibleIds = Object.keys(counts).filter(id => counts[id] >= 50);

        if (eligibleIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, display_name, email, role, avatar_url, created_at').in('id', eligibleIds);
          if (profiles) {
            setCandidates(profiles.map(p => ({ ...p, completedCount: counts[p.id] })).sort((a, b) => b.completedCount - a.completedCount));
          }
        } else {
          setCandidates([]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const approveBangChu = async (userId, currentStatus) => {
    try {
      const { error } = await supabase.from('profiles').update({ is_approved_bang_chu: !currentStatus }).eq('id', userId);
      if (error) throw error;
      setCandidates(candidates.map(c => c.id === userId ? { ...c, is_approved_bang_chu: !currentStatus } : c));
    } catch (err) {
      alert('Lỗi: ' + err.message);
    }
  };

  const fetchCollaborators = async () => {
    setLoadingCollabs(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'collaborator');
      if (error) throw error;
      setCollaborators(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCollabs(false);
    }
  };

  const searchUsers = async (e) => {
    e.preventDefault();
    if (!collabSearchTerm.trim()) return;
    setLoadingCollabs(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, display_name, full_name, role, avatar_url')
        .or(`email.ilike.%${collabSearchTerm}%,display_name.ilike.%${collabSearchTerm}%,full_name.ilike.%${collabSearchTerm}%`)
        .neq('role', 'admin') // don't show admins
        .limit(10);
      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCollabs(false);
    }
  };

  const setCollaboratorRole = async (userId, makeCollaborator) => {
    try {
      const newRole = makeCollaborator ? 'collaborator' : 'user';
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      // Update local state
      if (makeCollaborator) {
        toast('Đã thăng cấp thành Truyền Đạo Sư');
      } else {
        toast('Đã giáng cấp thành người dùng thường');
      }

      // Refresh list
      fetchCollaborators();
      if (collabSearchTerm) {
        // Trigger search again to update results UI
        setSearchResults(searchResults.map(u => u.id === userId ? { ...u, role: newRole } : u));
      }
    } catch (err) {
      alert('Lỗi: ' + err.message);
    }
  };

  const toast = (msg) => {
    setMessage({ type: 'success', text: msg });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleLibrarySubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      if (docId) {
        // Update existing document
        const { error } = await supabase
          .from('documents')
          .update({
            title,
            description,
            file_url: fileUrl,
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
              file_url: fileUrl,
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

  return (
    <div className="bg-[#f8f6f6] dark:bg-[#1a0f12] font-display text-slate-900 dark:text-white min-h-screen pb-24">
      {/* Header */}
      <header className="relative z-30 px-6 py-4 bg-white/50 dark:bg-[#201216]/80 backdrop-blur-md border-b border-[#7f13ec]/10 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#7f13ec]/20 flex items-center justify-center text-[#7f13ec] shadow-[0_0_15px_rgba(127,19,236,0.3)]">
            <span className="material-symbols-outlined">admin_panel_settings</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Quản trị viên hệ thống</h1>
            <p className="text-xs text-slate-500 font-medium">Bảng điều khiển admin quyền lực</p>
          </div>
        </div>

        {/* Main Tabs Segmented Control */}
        <div className="flex bg-slate-200 dark:bg-[#1a0f12] p-1 rounded-xl w-full max-w-4xl overflow-x-auto scrollbar-hide">
          <button onClick={() => setMainTab('library')} className={`whitespace-nowrap flex-1 px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${mainTab === 'library' ? 'bg-white dark:bg-[#2a1a1f] shadow-sm text-[#7f13ec]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>
            <span className="material-symbols-outlined text-[18px]">library_books</span> Quản lý Tài Liệu Học Free
          </button>
          <button onClick={() => setMainTab('collaborators')} className={`whitespace-nowrap flex-1 px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${mainTab === 'collaborators' ? 'bg-white dark:bg-[#2a1a1f] shadow-sm text-[#10b981]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>
            <span className="material-symbols-outlined text-[18px]">group_add</span> Truyền Đạo Sư
          </button>
          <button onClick={() => setMainTab('admissions')} className={`whitespace-nowrap flex-1 px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${mainTab === 'admissions' ? 'bg-white dark:bg-[#2a1a1f] shadow-sm text-[#7f13ec]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>
            <span className="material-symbols-outlined text-[18px]">school</span> Hệ thống Tuyển sinh
          </button>
          <button onClick={() => setMainTab('thongsoai')} className={`whitespace-nowrap flex-1 px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${mainTab === 'thongsoai' ? 'bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/40 dark:to-orange-900/20 border-red-200 dark:border-red-900/50 shadow-sm text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>
            <span className="material-symbols-outlined text-[18px]">local_fire_department</span> Sắc phong Bang Chủ
          </button>
        </div>
      </header>

      <main className="w-full max-w-3xl mx-auto px-4 pt-8">
        {mainTab === 'library' && (
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
        )}

        {/* New Admissions System Tab Content */}
        {mainTab === 'admissions' && (
          <AdmissionsAdmin />
        )}

        {/* Thong Soai Tab */}
        {mainTab === 'thongsoai' && (
          <div className="bg-white dark:bg-[#201216] border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black text-red-600 dark:text-red-400 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-3xl">local_fire_department</span>
                Sắc phong Bang Chủ
              </h2>
              <p className="text-sm font-medium text-slate-500 mt-2">Duyệt những Phó Bang Chủ rèn luyện xuất sắc (50+ chiến dịch) thăng cấp thành Bang Chủ.</p>
            </div>

            {loadingCandidates ? (
              <div className="flex justify-center py-8"><span className="material-symbols-outlined animate-spin text-red-500 text-3xl">sync</span></div>
            ) : candidates.length === 0 ? (
              <div className="text-center bg-slate-50 dark:bg-[#1a0f12] p-8 rounded-2xl border border-slate-200 dark:border-white/5 shadow-inner">
                <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-700 mb-3">group_off</span>
                <p className="font-bold text-slate-500">Chưa có ai đủ điều kiện (&gt;= 50 chiến dịch).</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {candidates.map(candidate => (
                  <div key={candidate.id} className="flex flex-col sm:flex-row items-center gap-4 p-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1a0f12] hover:shadow-md transition-shadow">
                    <img src={candidate.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} className="w-16 h-16 rounded-xl border-2 border-amber-400 shadow-sm" alt="avatar" />
                    <div className="flex-1 text-center sm:text-left">
                      <h3 className="font-bold text-xl text-slate-800 dark:text-white mb-1">{candidate.display_name || candidate.full_name || 'Ẩn danh'}</h3>
                      <p className="text-sm font-bold text-amber-600 dark:text-amber-500 bg-amber-100 dark:bg-amber-900/30 inline-block px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800/50">
                        ⚡ Đã cày {candidate.completedCount} chiến dịch
                      </p>
                    </div>
                    <button
                      onClick={() => approveBangChu(candidate.id, candidate.is_approved_bang_chu)}
                      className={`px-5 py-3 rounded-2xl font-black flex items-center gap-2 transition-all shadow-md shrink-0 ${candidate.is_approved_bang_chu ? 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300 hover:bg-red-100 hover:text-red-600 border border-slate-300 dark:border-white/20' : 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-amber-500/30 hover:scale-105 active:scale-95 border border-amber-500'}`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{candidate.is_approved_bang_chu ? 'cancel' : 'workspace_premium'}</span>
                      {candidate.is_approved_bang_chu ? 'Thu hồi sắc phong' : 'Sắc phong Bang Chủ'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Collaborators Tab */}
        {mainTab === 'collaborators' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#201216] border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold flex items-center gap-2 text-[#10b981] mb-2">
                <span className="material-symbols-outlined">person_search</span>
                Tìm kiếm User để cấp quyền
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Tìm kiếm qua Tên, Email hoặc Nickname để thêm/xóa quyền Truyền Đạo Sư (Cộng tác viên).</p>

              {message.text && (
                <div className={`p-4 rounded-xl mb-6 text-sm font-medium ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'}`}>
                  {message.text}
                </div>
              )}

              <form onSubmit={searchUsers} className="flex gap-2">
                <input
                  required
                  value={collabSearchTerm}
                  onChange={e => setCollabSearchTerm(e.target.value)}
                  className="flex-1 bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#10b981]/50 focus:border-[#10b981] transition-all"
                  placeholder="Nhập email, tên..."
                />
                <button type="submit" className="bg-[#10b981] hover:bg-[#059669] text-white px-6 rounded-xl font-bold transition-colors flex items-center gap-2">
                  {loadingCollabs ? <span className="material-symbols-outlined animate-spin text-[20px]">sync</span> : <span className="material-symbols-outlined text-[20px]">search</span>}
                  Tìm kiếm
                </button>
              </form>

              {searchResults.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h3 className="font-bold text-sm text-slate-500">Kết quả tìm kiếm:</h3>
                  {searchResults.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1a0f12]">
                      <div className="flex items-center gap-4">
                        <img src={user.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} className="w-12 h-12 rounded-lg" alt="avatar" />
                        <div>
                          <div className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            {user.display_name || user.full_name || 'Khuyết danh'}
                            {user.role === 'collaborator' && <span className="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded border border-emerald-200 uppercase font-black">TĐ. Sư</span>}
                          </div>
                          <div className="text-xs text-slate-500">{user.email}</div>
                        </div>
                      </div>

                      <button
                        onClick={() => setCollaboratorRole(user.id, user.role !== 'collaborator')}
                        className={`px-4 py-2 font-bold text-sm flex items-center gap-2 rounded-lg transition-colors border ${user.role === 'collaborator' ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-900/50' : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/50'}`}
                      >
                        {user.role === 'collaborator' ? 'Hủy sách phong' : 'Sắc phong Truyền Đạo Sư'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-[#201216] border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold flex items-center gap-2 text-[#10b981] mb-6">
                <span className="material-symbols-outlined">groups</span>
                Danh sách Truyền Đạo Sư hiện tại
              </h2>

              {loadingCollabs && searchResults.length === 0 ? (
                <div className="flex justify-center py-4"><span className="material-symbols-outlined animate-spin text-[#10b981]">sync</span></div>
              ) : collaborators.length === 0 ? (
                <p className="text-center text-slate-500 py-6 italic border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-white/5">Hệ thống chưa có Truyền Đạo Sư nào.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {collaborators.map(user => (
                    <div key={user.id} className="flex flex-col p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-900/10">
                      <div className="flex items-center gap-4 mb-4">
                        <img src={user.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} className="w-12 h-12 rounded-lg border border-emerald-200" alt="avatar" />
                        <div>
                          <div className="font-bold text-slate-800 dark:text-white">{user.display_name || user.full_name || 'Khuyết danh'}</div>
                          <div className="text-xs text-slate-500">{user.email}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => setCollaboratorRole(user.id, false)}
                        className="w-full py-2 bg-white dark:bg-[#1a0f12] text-red-500 border border-slate-200 dark:border-white/10 rounded-lg text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        Hủy quyền
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
