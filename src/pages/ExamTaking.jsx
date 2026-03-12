import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import RichTextRenderer from '../components/exam/RichTextRenderer';

// Note: Using a simple generic renderer for now, will modularize later.
export default function ExamTaking() {
    const { subjectFolder, id } = useParams();
    const navigate = useNavigate();
    const [examData, setExamData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState(0); // in seconds
    const [answers, setAnswers] = useState({}); // Stores user answers

    useEffect(() => {
        // Fetch exam data
        fetch(`/data/exams/${subjectFolder}/${id}.json`)
            .then(res => {
                if (!res.ok) throw new Error('Exam not found');
                return res.json();
            })
            .then(data => {
                setExamData(data);
                setTimeLeft(data.time * 60);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                alert("Không tìm thấy đề thi hoặc có lỗi tải dữ liệu!");
                navigate('/exam-room');
            });
    }, [subjectFolder, id, navigate]);

    useEffect(() => {
        // Countdown timer logic
        if (!loading && timeLeft > 0) {
            const timer = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        handleAutoSubmit();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [loading, timeLeft]);

    const handleAutoSubmit = () => {
        alert("Hết giờ làm bài! Hệ thống tự động thu bài.");
        navigate(`/exam/${subjectFolder}/${id}/result`, { state: { examData, answers } });
    };

    const handleManualSubmit = () => {
        if (window.confirm("Bạn có chắc chắn muốn nộp bài? Bạn không thể thay đổi đáp án sau khi nộp.")) {
            navigate(`/exam/${subjectFolder}/${id}/result`, { state: { examData, answers } });
        }
    };

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleAnswerChange = (questionId, value, subId = null) => {
        setAnswers(prev => {
            const currentObj = prev[questionId] || {};
            if (subId) {
                // For True/False cluster
                return { ...prev, [questionId]: { ...currentObj, [subId]: value } };
            }
            // For Single Choice & Short Answer
            return { ...prev, [questionId]: value };
        });
    };

    // Calculate total questions for the grid
    const allQuestions = examData?.parts?.flatMap(p => p.questions) || [];

    const getStatusBlock = (qType, qId, qObj) => {
        const ans = answers[qId];
        if (qType === 'true_false') {
             // check if all statements are answered
             const stIds = qObj.statements.map(s => s.id);
             const answeredCount = stIds.filter(id => ans && ans[id] !== undefined).length;
             return answeredCount === stIds.length ? 'bg-blue-500 text-white border-blue-600' : 
                    answeredCount > 0 ? 'bg-amber-400 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-300';
        }
        return (ans !== undefined && ans !== '') ? 'bg-blue-500 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300';
    };


    if (loading) return <div className="min-h-screen bg-[#f8f6f6] flex items-center justify-center text-slate-600 font-bold">Đang tải đề thi...</div>;

    return (
        <div className="min-h-screen bg-[#f8f6f6] text-slate-800 font-display flex flex-col">
            {/* Minimal Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/exam-room')} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 transition-colors text-slate-600">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-lg font-black text-slate-800">{examData.title}</h1>
                        <p className="text-xs text-slate-500 font-medium">{examData.subject} • {examData.time} phút</p>
                    </div>
                </div>
                
                {/* Mobile Timer View */}
                <div className="md:hidden font-mono font-black text-xl text-[#fe5f36]">
                    {formatTime(timeLeft)}
                </div>
            </header>

            <div className="flex-1 flex flex-col md:flex-row max-w-[1600px] w-full mx-auto relative">
                
                {/* Left Area: Main Question Content */}
                <div className="flex-1 p-4 md:p-8 overflow-y-auto h-[calc(100vh-73px)] pb-32 md:pb-8">
                    <div className="max-w-3xl mx-auto space-y-12">
                        {examData.parts.map((part, pIndex) => (
                            <div key={part.id} className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
                                <div className="mb-6 pb-4 border-b border-slate-100 mt-2">
                                    <h2 className="text-2xl font-black text-[#fe5f36]">{part.name}</h2>
                                    <p className="text-sm font-medium text-slate-500 mt-2 italic">{part.description}</p>
                                </div>

                                <div className="space-y-10">
                                    {part.questions.map((q, qIndex) => (
                                        <div key={q.id} id={`q-${q.id}`} className="scroll-mt-24">
                                            <div className="flex gap-4">
                                                <div className="w-10 h-10 shrink-0 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black text-lg border border-blue-100">
                                                    {qIndex + 1}
                                                </div>
                                                <div className="flex-1">
                                                    {/* Render rich text content simply for now */}
                                                    <div className="text-base font-medium leading-relaxed mb-4">
                                                        <RichTextRenderer content={q.content} />
                                                    </div>
                                                    
                                                    {/* Answer Components depending on Type */}
                                                    {q.type === 'single_choice' && (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            {q.options.map((opt, optIdx) => {
                                                                const labels = ['A', 'B', 'C', 'D'];
                                                                const isChecked = answers[q.id] === optIdx;
                                                                return (
                                                                    <label key={optIdx} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${isChecked ? 'bg-blue-50 border-blue-500 text-blue-800 font-bold' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                                                                        <input type="radio" name={q.id} className="hidden" onChange={() => handleAnswerChange(q.id, optIdx)} checked={isChecked} />
                                                                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition-colors ${isChecked ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'}`}>{labels[optIdx]}</span>
                                                                        <span><RichTextRenderer content={opt} /></span>
                                                                    </label>
                                                                )
                                                            })}
                                                        </div>
                                                    )}

                                                    {q.type === 'true_false' && (
                                                        <div className="space-y-3">
                                                            {q.statements.map((stmt, stmtIdx) => {
                                                                const labels = ['a', 'b', 'c', 'd'];
                                                                const currentAns = answers[q.id]?.[stmt.id];
                                                                return (
                                                                    <div key={stmt.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
                                                                        <div className="flex gap-3">
                                                                            <span className="font-bold text-slate-500">{labels[stmtIdx]})</span>
                                                                            <span className="font-medium text-slate-800"><RichTextRenderer content={stmt.content} /></span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 shrink-0 sm:ml-4">
                                                                            <button onClick={() => handleAnswerChange(q.id, true, stmt.id)} className={`px-4 py-1.5 rounded-lg text-sm font-bold border transition-colors ${currentAns === true ? 'bg-green-500 text-white border-green-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}`}>Đúng</button>
                                                                            <button onClick={() => handleAnswerChange(q.id, false, stmt.id)} className={`px-4 py-1.5 rounded-lg text-sm font-bold border transition-colors ${currentAns === false ? 'bg-red-500 text-white border-red-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}`}>Sai</button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {q.type === 'short_answer' && (
                                                        <div className="mt-2">
                                                            <input type="text" 
                                                                placeholder="Nhập đáp án của bạn..." 
                                                                value={answers[q.id] || ''}
                                                                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                                                className="w-full md:w-1/2 p-3 pb-2 border-b-2 border-slate-300 bg-slate-50 rounded-t-lg font-bold text-lg text-center focus:outline-none focus:border-[#fe5f36] transition-colors"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Area: Navigation Sidebar */}
                <div className="hidden md:block w-[320px] shrink-0 border-l border-slate-200 bg-white shadow-xl h-[calc(100vh-73px)] sticky top-[73px] flex flex-col items-center p-6 justify-between">
                    
                    <div className="w-full">
                        {/* Timer */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6 shadow-[0_0_20px_rgba(254,95,54,0.1)] relative overflow-hidden text-center group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#fe5f36]/20 blur-3xl rounded-full" />
                            <p className="text-slate-400 font-medium text-xs tracking-wider uppercase mb-1">Thời gian còn lại</p>
                            <div className={`font-mono font-black text-4xl tracking-tight transition-colors ${timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                                {formatTime(timeLeft)}
                            </div>
                        </div>

                        {/* Grid nav */}
                        <div className="space-y-6 overflow-y-auto max-h-[50vh] pr-2 custom-scrollbar">
                            {examData.parts.map((p, pIdx) => (
                                <div key={p.id}>
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{p.name}</h3>
                                    <div className="grid grid-cols-5 gap-2">
                                        {p.questions.map((q, qIdx) => {
                                            const statusClass = getStatusBlock(q.type, q.id, q);
                                            return (
                                                <button 
                                                    key={q.id}
                                                    onClick={() => {
                                                        const el = document.getElementById(`q-${q.id}`);
                                                        if (el) el.scrollIntoView({behavior: 'smooth', block: 'start'});
                                                    }}
                                                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border-2 transition-transform hover:scale-105 ${statusClass}`}
                                                >
                                                    {qIdx + 1}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="w-full pt-6">
                        <button onClick={handleManualSubmit} className="w-full py-4 rounded-full bg-gradient-to-r from-[#fe5f36] to-pink-600 text-white font-black text-lg shadow-xl shadow-[#fe5f36]/30 hover:scale-[1.02] active:scale-95 transition-all text-center flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined">send</span> Thu bài
                        </button>
                    </div>

                </div>

            </div>
        </div>
    );
}
