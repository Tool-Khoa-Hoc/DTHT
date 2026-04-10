import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const TITLE_MAX_LENGTH = 200;
const CONTENT_MAX_LENGTH = 10000;
const AUTOSAVE_DEBOUNCE_MS = 1500;

export default function Notes() {
    const { user } = useAuth();
    const [notes, setNotes] = useState([]);
    const [activeNoteId, setActiveNoteId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const activeNote = notes.find(n => n.id === activeNoteId);
    const debounceTimerRef = useRef(null);

    useEffect(() => {
        if (!user) return;
        fetchNotes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const fetchNotes = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('user_notes')
                .select('*')
                .eq('user_id', user.id)
                .order('updated_at', { ascending: false });

            if (error) throw error;
            setNotes(data || []);
            if (data?.length > 0 && !activeNoteId) {
                setActiveNoteId(data[0].id);
            }
        } catch (err) {
            console.error('Error fetching notes:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateNote = async () => {
        setIsSaving(true);
        try {
            const newNote = {
                user_id: user.id,
                title: 'Ghi chú mới',
                content: ''
            };
            const { data, error } = await supabase
                .from('user_notes')
                .insert([newNote])
                .select()
                .single();

            if (error) throw error;
            
            setNotes(prev => [data, ...prev]);
            setActiveNoteId(data.id);
        } catch (err) {
            console.error('Error creating note:', err);
            alert('Lỗi tạo ghi chú. Vui lòng thử lại!');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteNote = async (id, e) => {
        if (e) {
            e.stopPropagation();
        }
        if (!window.confirm('Bạn có chắc chắn muốn xóa ghi chú này?')) return;
        
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('user_notes')
                .delete()
                .eq('id', id)
                .eq('user_id', user.id);

            if (error) throw error;
            
            setNotes(prev => prev.filter(n => n.id !== id));
            if (activeNoteId === id) {
                setActiveNoteId(null);
            }
        } catch (err) {
            console.error('Error deleting note:', err);
            alert('Lỗi xóa ghi chú. Vui lòng thử lại!');
        } finally {
            setIsSaving(false);
        }
    };

    const persistNoteChanges = async (id, updates) => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('user_notes')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id)
                .eq('user_id', user.id);
                
            if (error) throw error;
        } catch (err) {
            console.error('Error saving note:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateNote = (id, field, value) => {
        let finalValue = value;
        // Kiểm soát ký tự nhập vào để tránh spam payload
        if (field === 'title' && value.length > TITLE_MAX_LENGTH) {
            finalValue = value.substring(0, TITLE_MAX_LENGTH);
            alert(`Tiêu đề tối đa ${TITLE_MAX_LENGTH} ký tự.`);
        }
        if (field === 'content' && value.length > CONTENT_MAX_LENGTH) {
            finalValue = value.substring(0, CONTENT_MAX_LENGTH);
            alert(`Nội dung tối đa ${CONTENT_MAX_LENGTH} ký tự.`);
        }

        // Cập nhật state ngay lập tức
        setNotes(prev => prev.map(n => 
            n.id === id ? { ...n, [field]: finalValue, updated_at: new Date().toISOString() } : n
        ).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))); // Sort lên đầu ngay

        // Debounce gọi API cập nhật Database để tối ưu
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            persistNoteChanges(id, { [field]: finalValue });
        }, AUTOSAVE_DEBOUNCE_MS);
    };

    const filteredNotes = notes.filter(n => 
        n.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        n.content?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatDate = (isoString) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0f080a] flex items-center justify-center p-6">
                <div className="flex flex-col items-center gap-3">
                    <span className="material-symbols-outlined animate-spin text-4xl text-[#fe5f36]">sync</span>
                    <p className="text-slate-400 font-medium">Đang tải ghi chú...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f080a] text-slate-200 font-display flex flex-col md:flex-row relative">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#fe5f36]/5 blur-[120px] rounded-full pointer-events-none" />

            {/* Cột trái: Danh sách Ghi chú */}
            <aside className="w-full md:w-[320px] lg:w-[380px] shrink-0 border-r border-white/10 bg-white/5 backdrop-blur-md flex flex-col h-[40vh] md:h-screen z-10">
                <div className="p-5 border-b border-white/10 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#fe5f36]/20 to-pink-500/20 flex items-center justify-center border border-white/10">
                                <span className="material-symbols-outlined text-transparent bg-clip-text bg-gradient-to-r from-[#fe5f36] to-pink-500 text-sm">
                                    edit_note
                                </span>
                            </div>
                            <h2 className="text-xl font-black text-white tracking-tight">Ghi Chú Cá Nhân</h2>
                        </div>
                        <button 
                            onClick={handleCreateNote}
                            disabled={isSaving}
                            className="w-8 h-8 rounded-full bg-[#fe5f36]/10 text-[#fe5f36] hover:bg-[#fe5f36] hover:text-white transition-colors flex items-center justify-center disabled:opacity-50"
                            title="Tạo ghi chú mới"
                        >
                            <span className="material-symbols-outlined text-xl">add</span>
                        </button>
                    </div>

                    <div className="relative group">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg group-focus-within:text-[#fe5f36] transition-colors">
                            search
                        </span>
                        <input
                            type="text"
                            placeholder="Tìm kiếm nội dung..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-[#fe5f36]/50 transition-colors placeholder:text-slate-600"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
                    {filteredNotes.length === 0 ? (
                        <div className="text-center py-10 text-slate-500 text-sm">
                            {searchTerm ? 'Không tìm thấy ghi chú phù hợp' : 'Chưa có ghi chú nào. Hãy tạo mới nhé!'}
                        </div>
                    ) : (
                        filteredNotes.map(note => (
                            <div 
                                key={note.id}
                                onClick={() => setActiveNoteId(note.id)}
                                className={`p-4 rounded-2xl cursor-pointer transition-all border ${activeNoteId === note.id ? 'bg-[#fe5f36]/10 border-[#fe5f36]/30 shadow-lg' : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/10'}`}
                            >
                                <div className="flex justify-between items-start gap-2 mb-1">
                                    <h3 className={`font-bold truncate text-sm flex-1 ${activeNoteId === note.id ? 'text-[#fe5f36]' : 'text-slate-200'}`}>
                                        {note.title || 'Ghi chú không tên'}
                                    </h3>
                                    <button 
                                        onClick={(e) => handleDeleteNote(note.id, e)}
                                        className="text-slate-500 hover:text-red-400 transition-colors"
                                        title="Xóa ghi chú"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">delete</span>
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-2">
                                    {note.content || '...'}
                                </p>
                                <div className="text-[10px] text-slate-600 font-medium">
                                    {formatDate(note.updated_at)}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </aside>

            {/* Cột phải: Khung Editor */}
            <main className="flex-1 flex flex-col h-[60vh] md:h-screen relative z-10">
                {activeNote ? (
                    <div className="flex flex-col h-full bg-gradient-to-b from-white/[0.02] to-transparent m-2 md:m-4 md:ml-0 rounded-3xl border border-white/5 shadow-2xl flex-1 backdrop-blur-xl transition-all overflow-hidden">
                        <header className="px-6 py-4 flex items-center justify-between border-b border-white/5 shrink-0">
                            <input 
                                type="text"
                                value={activeNote.title}
                                onChange={(e) => handleUpdateNote(activeNote.id, 'title', e.target.value)}
                                placeholder="Nhập tiêu đề..."
                                className="bg-transparent border-none text-xl md:text-2xl font-black text-white focus:outline-none focus:ring-0 w-full placeholder:text-slate-600 truncate"
                            />
                            {isSaving && (
                                <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                                    <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                                    Đang lưu...
                                </div>
                            )}
                        </header>
                        
                        <div className="flex-1 p-6 relative">
                            <textarea
                                value={activeNote.content}
                                onChange={(e) => handleUpdateNote(activeNote.id, 'content', e.target.value)}
                                placeholder="Viết những gì bạn cần nhớ vào đây nhé..."
                                className="w-full h-full bg-transparent border-none text-slate-300 text-[15px] leading-relaxed resize-none focus:outline-none focus:ring-0 placeholder:text-slate-600 selection:bg-[#fe5f36]/30 custom-scrollbar"
                            />
                            <div className="absolute bottom-4 right-6 text-[10px] text-slate-600 font-medium pointer-events-none">
                                {activeNote.content?.length || 0} / {CONTENT_MAX_LENGTH} ký tự
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center flex-1 m-4 text-slate-500">
                        <span className="material-symbols-outlined text-6xl text-slate-700 mb-4 opacity-50">note_alt</span>
                        <p className="font-medium text-sm">Chọn một ghi chú bên trái để xem hoặc tạo mới</p>
                    </div>
                )}
            </main>
            
            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
            `}</style>
        </div>
    );
}
