import React from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';

export default function ExamResult() {
    const location = useLocation();
    const navigate = useNavigate();
    const { examData, answers } = location.state || {};

    if (!examData) {
         return (
             <div className="min-h-screen bg-[#f8f6f6] flex flex-col items-center justify-center">
                 <h2 className="text-xl font-bold mb-4">Không tìm thấy kết quả hợp lệ.</h2>
                 <Link to="/exam-room" className="px-6 py-2 bg-blue-500 text-white rounded-lg">Quay lại</Link>
             </div>
         );
    }

    // 2025 THPTQG Scoring Logic
    let totalScore = 0;
    const details = { part1: { correct: 0, total: 0 }, part2: { correct: 0, total: 0 }, part3: { correct: 0, total: 0 } };

    examData.parts.forEach(part => {
        part.questions.forEach(q => {
             if (q.type === 'single_choice') {
                 details.part1.total += 1;
                 if (answers[q.id] === q.answer) {
                     totalScore += q.points ?? 0.25;
                     details.part1.correct += 1;
                 }
             } else if (q.type === 'true_false') {
                 details.part2.total += 1;
                 const qAnswers = answers[q.id] || {};
                 let correctCount = 0;
                 q.statements.forEach((stmt, idx) => {
                     if (qAnswers[stmt.id] === q.answers[idx]) {
                         correctCount += 1;
                     }
                 });
                 if (correctCount === 1) { totalScore += 0.1; }
                 else if (correctCount === 2) { totalScore += 0.25; }
                 else if (correctCount === 3) { totalScore += 0.5; }
                 else if (correctCount === 4) { 
                     totalScore += 1.0; 
                     details.part2.correct += 1; // Only count as fully correct if 4/4
                 }
             } else if (q.type === 'short_answer') {
                 details.part3.total += 1;
                 const userAns = (answers[q.id] || '').trim().toLowerCase();
                 // Note: proper logic should parse number or string correctly, this is simple string match
                 if (userAns === String(q.answer).toLowerCase()) {
                     totalScore += q.points ?? 0.25; // Default short answer to 0.25, Math should explicitly set "points": 0.5 in JSON
                     details.part3.correct += 1;
                 }
             }
        });
    });

    return (
        <div className="min-h-screen bg-[#f8f6f6] text-slate-800 font-display py-12 px-4">
            <div className="max-w-3xl mx-auto space-y-8">
                {/* Score Card */}
                <div className="bg-white rounded-3xl p-8 text-center shadow-xl border border-slate-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 blur-3xl rounded-full" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 blur-3xl rounded-full" />
                    
                    <div className="relative z-10">
                        <span className="material-symbols-outlined text-6xl text-[#fe5f36] mb-4">gpp_good</span>
                        <h1 className="text-3xl font-black text-slate-900 mb-2">Hoàn thành bài thi!</h1>
                        <p className="text-slate-500 font-medium mb-8">{examData.title}</p>
                        
                        <div className="inline-block p-1 rounded-[2rem] bg-gradient-to-r from-[#fe5f36] to-pink-500 mb-8">
                            <div className="bg-white rounded-[1.8rem] px-12 py-8">
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Điểm tổng kết</p>
                                <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#fe5f36] to-pink-600">
                                    {totalScore.toFixed(2).replace(/\.00$/, '')}<span className="text-3xl text-slate-300 ml-2">/10</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap justify-center gap-4">
                            {details.part1.total > 0 && (
                                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl w-40">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">P.I: Trắc nghiệm</p>
                                    <p className="text-xl font-black text-blue-600">{details.part1.correct}/{details.part1.total} <span className="text-sm text-slate-500 font-medium">câu đúng</span></p>
                                </div>
                            )}
                            {details.part2.total > 0 && (
                                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl w-40">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">P.II: Đúng/Sai</p>
                                    <p className="text-xl font-black text-amber-600">{details.part2.correct}/{details.part2.total} <span className="text-sm text-slate-500 font-medium">câu đúng hết</span></p>
                                </div>
                            )}
                            {details.part3.total > 0 && (
                                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl w-40">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">P.III: Trả lời ngắn</p>
                                    <p className="text-xl font-black text-emerald-600">{details.part3.correct}/{details.part3.total} <span className="text-sm text-slate-500 font-medium">câu đúng</span></p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4 justify-center">
                    <button onClick={() => navigate('/exam-room')} className="px-8 py-4 rounded-2xl bg-white border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors shadow-sm">
                        Quay lại danh sách đề
                    </button>
                    <button onClick={() => alert("Tính năng xem chi tiết đáp án đang được phát triển!")} className="px-8 py-4 rounded-2xl bg-slate-900 border-2 border-slate-900 text-white font-bold hover:bg-slate-800 transition-colors shadow-xl shadow-slate-900/20">
                        Xem chi tiết đáp án
                    </button>
                </div>
            </div>
        </div>
    );
}
