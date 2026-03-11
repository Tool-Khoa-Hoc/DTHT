import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Navigate } from 'react-router-dom';

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

export default function Collaborator() {
    const { user, profile } = useAuth();

    // Library Form State
    const [docId, setDocId] = useState(null); // null means adding new
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [fileUrl, setFileUrl] = useState('');
    const [authorName, setAuthorName] = useState('');
    const [category, setCategory] = useState('khac');
    const [customCategory, setCustomCategory] = useState('');
    const [educationLevel, setEducationLevel] = useState('thpt'); // 'thpt' | 'university'
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // List State
    const [documents, setDocuments] = useState([]);
    const [loadingDocs, setLoadingDocs] = useState(true);

    // Security Check: Kick out non-collaborators AND non-admins
    if (profile?.role !== 'collaborator' && profile?.role !== 'admin') {
        return <Navigate to="/home" />;
    }

    useEffect(() => {
        fetchMyDocuments();
    }, [user]);

    const fetchMyDocuments = async () => {
        setLoadingDocs(true);
        try {
            if (!user) return;
            // Only fetch documents uploaded by this user
            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .eq('uploaded_by', user.id)
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

        const finalCategory = category === 'khac' && customCategory.trim() !== '' ? customCategory.trim() : category;

        try {
            if (docId) {
                // Update existing document (RLS ensures they can only update their own)
                const { error } = await supabase
                    .from('documents')
                    .update({
                        title,
                        description,
                        file_url: fileUrl,
                        author_name: authorName || profile?.display_name || 'Khuyết danh',
                        category: finalCategory,
                        education_level: educationLevel
                    })
                    .eq('id', docId); // Note: uploaded_by = uid() is enforced by RLS

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
                            author_name: authorName || profile?.display_name || 'Khuyết danh',
                            uploaded_by: user.id,
                            is_public: true,
                            category: finalCategory,
                            education_level: educationLevel
                        }
                    ]);

                if (error) throw error;
                setMessage({ type: 'success', text: 'Tài liệu đã được đăng tải thành công!' });
            }

            // Reset form & refresh list
            resetForm();
            fetchMyDocuments();
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
        setCategory('khac');
        setCustomCategory('');
        setEducationLevel('thpt');
    };

    const handleEdit = (doc) => {
        setDocId(doc.id);
        setTitle(doc.title);
        setDescription(doc.description || '');
        setFileUrl(doc.file_url);
        setAuthorName(doc.author_name || '');
        
        const isPredefined = CATEGORIES.some(c => c.value === doc.category);
        if (!isPredefined && doc.category) {
            setCategory('khac');
            setCustomCategory(doc.category);
        } else {
            setCategory(doc.category || 'khac');
            setCustomCategory('');
        }
        setEducationLevel(doc.education_level || 'thpt');

        // Scroll to form automatically
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa tài liệu này suy nghĩ kỹ nhé?")) return;

        try {
            const { error } = await supabase.from('documents').delete().eq('id', id);
            if (error) throw error;
            setDocuments(documents.filter(d => d.id !== id));
            if (docId === id) resetForm(); // If deleting what is currently being edited
        } catch (error) {
            alert("Lỗi khi xóa tài liệu: " + error.message);
        }
    };

    return (
        <div className="bg-[#f8f6f6] dark:bg-[#1a0f12] font-display text-slate-900 dark:text-white min-h-screen pb-24">
            {/* Header */}
            <header className="relative z-30 px-6 py-4 bg-white/50 dark:bg-[#201216]/80 backdrop-blur-md border-b border-[#10b981]/10 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#10b981]/20 flex items-center justify-center text-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                        <span className="material-symbols-outlined">menu_book</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-[#10b981]">Truyền Đạo Sư</h1>
                        <p className="text-xs text-slate-500 font-medium">Khu vực đăng tải tài liệu bí kíp</p>
                    </div>
                </div>
            </header>

            <main className="w-full max-w-3xl mx-auto px-4 pt-8">
                <div className="bg-white dark:bg-[#201216] border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-xl border-t-4 border-t-[#10b981]">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold flex items-center gap-2 text-[#10b981]">
                            <span className="material-symbols-outlined">{docId ? 'edit_document' : 'upload_file'}</span>
                            {docId ? 'Cập nhật tài liệu' : 'Chia sẻ tài liệu mới'}
                        </h2>
                        {docId && (
                            <button onClick={resetForm} className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">close</span> Hủy sửa
                            </button>
                        )}
                    </div>

                    {message.text && (
                        <div className={`p-4 rounded-xl mb-6 text-sm font-medium ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'}`}>
                            {message.text}
                        </div>
                    )}

                    <form onSubmit={handleLibrarySubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-300">Tiêu đề tài liệu / Khóa học <span className="text-red-500">*</span></label>
                            <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#10b981]/50 focus:border-[#10b981] transition-all text-slate-900 dark:text-white" placeholder="VD: Khóa học Lập trình Web Cơ bản" />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-300">Mô tả ngắn</label>
                            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="3" className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#10b981]/50 focus:border-[#10b981] transition-all text-slate-900 dark:text-white resize-none" placeholder="Nhập nội dung mô tả..."></textarea>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-300">Tên tác giả</label>
                            <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#10b981]/50 focus:border-[#10b981] transition-all text-slate-900 dark:text-white" placeholder={`Mặc định hiển thị: ${profile?.display_name || 'Khuyết danh'}`} />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300">Danh mục / Môn học <span className="text-red-500">*</span></label>
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                {CATEGORIES.map(cat => (
                                    <button key={cat.value} type="button" onClick={() => setCategory(cat.value)} className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all text-xs font-semibold ${category === cat.value ? 'border-[#10b981] bg-[#10b981]/10 text-[#10b981]' : 'border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/3 text-slate-500 dark:text-slate-400 hover:border-[#10b981]/40 hover:text-[#10b981]'}`}>
                                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${cat.color} flex items-center justify-center`}><span className="material-symbols-outlined text-white text-base">{cat.icon}</span></div>
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                            {category === 'khac' && (
                                <div className="mt-3">
                                    <input 
                                        value={customCategory} 
                                        onChange={(e) => setCustomCategory(e.target.value)} 
                                        className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-[#10b981]/50 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#10b981]/50 focus:border-[#10b981] transition-all text-slate-900 dark:text-white" 
                                        placeholder="Nhập tên môn học / danh mục khác..." 
                                    />
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300">Phân loại cấp học <span className="text-red-500">*</span></label>
                            <div className="flex gap-4">
                                <label className="flex-1 cursor-pointer">
                                    <input type="radio" name="collabEduLevel" value="thpt" checked={educationLevel === 'thpt'} onChange={(e) => setEducationLevel(e.target.value)} className="hidden peer" />
                                    <div className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-semibold peer-checked:border-[#10b981] peer-checked:bg-[#10b981]/10 peer-checked:text-[#10b981] border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:border-[#10b981]/50">
                                        <span className="material-symbols-outlined text-[20px]">menu_book</span> THPT Quốc Gia
                                    </div>
                                </label>
                                <label className="flex-1 cursor-pointer">
                                    <input type="radio" name="collabEduLevel" value="university" checked={educationLevel === 'university'} onChange={(e) => setEducationLevel(e.target.value)} className="hidden peer" />
                                    <div className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-semibold peer-checked:border-[#10b981] peer-checked:bg-[#10b981]/10 peer-checked:text-[#10b981] border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:border-[#10b981]/50">
                                        <span className="material-symbols-outlined text-[20px]">school</span> Đại Học
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-300">Link Google Drive / Video / Tài liệu <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none"><span className="material-symbols-outlined text-slate-400">link</span></div>
                                <input required type="url" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-[#10b981]/50 focus:border-[#10b981] transition-all text-slate-900 dark:text-white" placeholder="https://drive.google.com/..." />
                            </div>
                        </div>

                        <div className="pt-4">
                            <button type="submit" disabled={loading} className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:hover:scale-100 flex items-center justify-center gap-2">
                                {loading ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">{docId ? 'save' : 'cloud_upload'}</span>}
                                {loading ? 'Đang xử lý...' : (docId ? 'Cập nhật tài liệu' : 'Đăng tải tài liệu')}
                            </button>
                        </div>
                    </form>

                    {/* List of My Documents */}
                    <div className="mt-12">
                        <h3 className="text-md font-bold mb-4 flex items-center gap-2 border-t border-slate-200 dark:border-white/10 pt-8">
                            <span className="material-symbols-outlined text-emerald-500">inventory_2</span>
                            Tài liệu của tôi
                        </h3>

                        {loadingDocs ? (
                            <div className="flex justify-center py-8"><span className="material-symbols-outlined animate-spin text-[#10b981]">sync</span></div>
                        ) : documents.length === 0 ? (
                            <p className="text-center text-sm text-slate-500 italic py-8 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl bg-slate-50/50 dark:bg-white/5">Bạn chưa đăng tải bí kíp nào.</p>
                        ) : (
                            <div className="space-y-3">
                                {documents.map(doc => {
                                    const catInfo = CATEGORIES.find(c => c.value === doc.category) || CATEGORIES[CATEGORIES.length - 1];
                                    return (
                                        <div key={doc.id} className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 hover:border-[#10b981]/30 transition-all group">
                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${doc.is_featured ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                                                        {doc.is_featured ? 'Nổi bật' : (catInfo?.label || doc.category)}
                                                    </span>
                                                    <h4 className="font-bold text-sm truncate text-emerald-600 dark:text-emerald-400" title={doc.title}>{doc.title}</h4>
                                                </div>
                                                <p className="text-xs text-slate-500 truncate">{doc.description || 'Không có mô tả'}</p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 border-t sm:border-t-0 border-slate-200 dark:border-white/10 pt-3 sm:pt-0">
                                                <button
                                                    onClick={() => handleEdit(doc)}
                                                    title="Sửa"
                                                    className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-[#10b981]/10 hover:text-[#10b981] flex items-center justify-center transition-colors"
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
            </main>
        </div>
    );
}
