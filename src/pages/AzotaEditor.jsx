import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { parseDocx } from '../utils/docxParser';
import { linesToExam } from '../utils/examStructure';
import RichTextRenderer from '../components/exam/RichTextRenderer';

export default function AzotaEditor() {
    const { user, profile } = useAuth();
    const isAdmin = profile?.role === 'admin';

    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [examData, setExamData] = useState(null);
    const [rawMarkup, setRawMarkup] = useState('');
    const [assets, setAssets] = useState({ images: {}, math: {} });
    
    // Exam Settings
    const [examTitle, setExamTitle] = useState('Đề thi chưa đặt tên');
    const [durationStr, setDurationStr] = useState('45');
    const [password, setPassword] = useState('');

    const handleFileUpload = async (e) => {
        const uploadedFile = e.target.files[0];
        if (!uploadedFile) return;
        setFile(uploadedFile);
        setLoading(true);

        try {
            // 1. Parse DOCX into [!tags] 
            const { lines, assets: extractedAssets } = await parseDocx(uploadedFile);
            setAssets(extractedAssets);

            // 2. Group into structured JSON (Questions, Choices)
            const structuredExam = linesToExam(lines, extractedAssets);
            setExamData(structuredExam);

            // 3. Keep the extracted raw lines as the editable source of truth.
            setRawMarkup(lines.join('\n').trim());

        } catch (error) {
            console.error('Error parsing docx:', error);
            alert("Lỗi khi đọc file: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkupChange = (e) => {
        const newMarkup = e.target.value;
        setRawMarkup(newMarkup);
        
        // Re-parse the text back into structured JSON in real-time
        const lines = newMarkup.split('\n');
        const updatedExam = linesToExam(lines, assets);
        setExamData(updatedExam);
    };

    const handleSaveExam = async () => {
        if (!examData) return;
        setLoading(true);
        try {
            // In a full implementation, we would upload base64 images to Supabase Storage here
            // and replace [img:$...$] tags with real CDN URLs.
            // For now, we save raw JSON logic modeled after the old importer.

            const { data, error } = await supabase.from('exams').insert({
                title: examTitle || "Đề thi mới",
                content: examData,         // structured JSON
                raw_markup: rawMarkup,     // Source of truth
                created_by: user.id,
                time_limit: parseInt(durationStr, 10) * 60 || 2700,
                password: password || null,
                is_published: true
            }).select();

            if (error) throw error;
            alert("Lưu đề thi thành công! ID: " + data[0].id);
            setExamData(null);
            setRawMarkup('');
            setFile(null);
        } catch (error) {
            console.error(error);
            alert("Lỗi khi lưu: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isAdmin) {
        return <div className="p-8 text-center text-red-500 font-bold">Chỉ Admin mới có quyền truy cập Azota Editor.</div>;
    }

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100 overflow-hidden">
            {/* Sidebar / Upload Panel */}
            <div className="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col z-10 shrink-0 shadow-sm">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
                     <span className="material-symbols-outlined text-purple-600 dark:text-purple-400">edit_document</span>
                     <h1 className="font-bold text-lg">Azota Editor</h1>
                </div>

                <div className="p-5 flex-1 overflow-y-auto space-y-6">
                    {!examData ? (
                        <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-pointer relative group">
                             <input 
                                type="file" 
                                accept=".docx" 
                                onChange={handleFileUpload} 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                                disabled={loading}
                             />
                             {loading ? (
                                <span className="material-symbols-outlined animate-spin text-4xl text-purple-500 mb-3">sync</span>
                             ) : (
                                <span className="material-symbols-outlined text-4xl text-slate-400 group-hover:text-purple-500 transition-colors mb-3">upload_file</span>
                             )}
                             <p className="font-bold text-sm">
                               {loading ? 'Đang xử lý Word...' : 'Tải lên DOCX'}
                             </p>
                             <p className="text-xs text-slate-500 mt-2 text-balance leading-relaxed">
                                Kéo thả hoặc bấm để chọn file Word. Hỗ trợ đầy đủ MathType, OMML và Ảnh.
                             </p>
                        </div>
                    ) : (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Tên đề thi</label>
                                <input 
                                    value={examTitle} onChange={e => setExamTitle(e.target.value)}
                                    className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-medium"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Thời gian (phút)</label>
                                    <input 
                                        type="number" value={durationStr} onChange={e => setDurationStr(e.target.value)}
                                        className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Mật khẩu (Tùy chọn)</label>
                                    <input 
                                        type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Bỏ trống nếu công khai"
                                        className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                                <div className="text-xs text-slate-500 font-bold mb-3 flex items-center justify-between">
                                    <span>Tài nguyên trích xuất</span>
                                    <span className="bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full text-[10px]">{Object.keys(assets.images).length} Ảnh | {Object.keys(assets.math).length} Toán</span>
                                </div>
                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                    {Object.entries(assets.images).slice(0, 10).map(([id, img]) => (
                                        <div key={id} className="w-12 h-12 shrink-0 rounded border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 flex items-center justify-center" title={id}>
                                            <img src={img.source} className="max-w-full max-h-full object-contain" alt="Extracted resource" />
                                        </div>
                                    ))}
                                    {Object.keys(assets.images).length > 10 && (
                                        <div className="w-12 h-12 shrink-0 rounded border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-xs text-slate-500 font-bold bg-slate-50 dark:bg-slate-900">
                                            +{Object.keys(assets.images).length - 10}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Footer Actions */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex gap-2">
                     {examData && (
                         <>
                            <button 
                                onClick={() => { setExamData(null); setRawMarkup(''); setFile(null); }}
                                className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                            >
                                Hủy
                            </button>
                            <button 
                                onClick={handleSaveExam}
                                disabled={loading}
                                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                            >
                                {loading ? <span className="material-symbols-outlined animate-spin text-[18px]">sync</span> : <span className="material-symbols-outlined text-[18px]">save</span>}
                                Lưu đề thi
                            </button>
                         </>
                     )}
                </div>
            </div>

            {/* Main Split View Editor */}
            {examData ? (
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Panel: Raw Text / Markup */}
                    <div className="flex-1 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e1e1e]">
                        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#252526] text-xs font-mono font-bold text-slate-500 dark:text-slate-400 flex justify-between items-center">
                            <span>MARKUP.TXT (Raw Editor)</span>
                            <span className="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 px-2 py-0.5 rounded text-[10px]">Auto-Sync</span>
                        </div>
                        <textarea 
                            value={rawMarkup}
                            onChange={handleMarkupChange}
                            className="flex-1 w-full bg-transparent resize-none outline-none p-6 font-mono text-[13px] leading-relaxed text-slate-800 dark:text-slate-300 whitespace-pre-wrap"
                            spellCheck="false"
                            placeholder="Nhập nội dung đề thi vào đây..."
                        />
                    </div>

                    {/* Right Panel: Rendered UI Preview (Azota Style) */}
                    <div className="flex-1 flex flex-col bg-[#f0f2f5] dark:bg-black">
                        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm flex items-center gap-2">
                             <span className="material-symbols-outlined text-[16px] text-green-500">visibility</span>
                             HÌNH ẢNH HIỂN THỊ TRÊN WEB (Student View)
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 md:p-8">
                            <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 md:p-10">
                                <h1 className="text-2xl font-bold text-center mb-8 pb-4 border-b border-slate-100 dark:border-slate-800">
                                    {examTitle.toUpperCase()}
                                </h1>
                                
                                <div className="space-y-8">
                                    {examData.instruction && (
                                        <div className="italic text-slate-600 dark:text-slate-400 mb-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border-l-4 border-purple-500">
                                            {examData.instruction}
                                        </div>
                                    )}

                                    {examData.questions.map((q, qIndex) => (
                                        <div key={q.qid || qIndex} className="question-block">
                                            {q.section && (
                                                <h3 className="font-bold text-lg mt-8 mb-4 text-purple-600 dark:text-purple-400">{q.section}</h3>
                                            )}
                                            
                                            <div className="flex mb-3 text-[15px] leading-relaxed">
                                                <span className="font-bold mr-2 whitespace-nowrap">Câu {q.source_number || qIndex + 1}:</span>
                                                <div className="flex-1 min-w-0">
                                                    <RichTextRenderer content={q.stem} assets={assets} />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pl-0 md:pl-10 mt-4">
                                                {q.choices.map((c, cIndex) => {
                                                    const isCorrect = q.answer && c.label === q.answer;
                                                    return (
                                                        <div key={cIndex} className={`flex items-start gap-2 p-3 rounded-lg border transition-colors cursor-pointer 
                                                                ${isCorrect ? 'bg-green-50 dark:bg-green-500/10 border-green-500/50 text-green-700 dark:text-green-400' : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-500/50'}`
                                                        }>
                                                            <div className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold border 
                                                                ${isCorrect ? 'bg-green-500 border-green-500 text-white' : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300'}`
                                                            }>
                                                                {c.label}
                                                            </div>
                                                            <div className="flex-1 min-w-0 mt-0.5 text-sm">
                                                                <RichTextRenderer content={c.content} assets={assets} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
                     <span className="material-symbols-outlined text-6xl mb-4 text-slate-300 dark:text-slate-700">splitscreen</span>
                     <h2 className="text-xl font-bold mb-2 text-slate-500">Chưa có dữ liệu đề thi</h2>
                     <p className="text-center max-w-md text-sm">
                        Tải lên một file Word (.docx) ở cột bên trái để công cụ Parser phía Client phân tích và hiển thị đồng thời cả giao diện Preview lẫn cửa sổ chỉnh sửa Markup.
                     </p>
                </div>
            )}
        </div>
    );
}
