import React from 'react';
import AnswerSheet2025 from './AnswerSheet2025';
import SecurePdfViewer from './SecurePdfViewer';
import { formatTime } from './ExamTakingHeader';
import { getQuestionKey, isQuestionAnswered } from '../../hooks/useExamEngine';

export default function ExamRightPanel({
    examData,
    answers,
    timeLeft,
    isSubmitting,
    handleAnswerChange,
    handleManualSubmit,
    documentUrl,
    user,
    profile,
    leftWidth
}) {
    const allQuestions = examData?.parts?.flatMap((part) => part.questions.map((question) => ({
        partId: part.id,
        question,
    }))) || [];
    
    const answeredQuestionsCount = allQuestions.filter(({ partId, question }) => (
        isQuestionAnswered(question, answers[getQuestionKey(partId, question.id)])
    )).length;

    return (
        <div style={{ width: leftWidth !== undefined ? `calc(${100 - leftWidth}%)` : '100%' }} className="h-full bg-[#fcecf0] flex flex-col w-full md:w-auto relative shadow-2xl relative z-10 transition-all">
            {/* Mobile PDF section */}
            <div className="md:hidden h-[50vh] w-full border-b-2 border-red-200 shrink-0">
                <SecurePdfViewer 
                    url={documentUrl} 
                    userEmail={user?.email} 
                    userName={profile?.full_name || user?.user_metadata?.full_name} 
                />
            </div>

            {/* Sticky Top Status Bar for Right Pane */}
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-red-200 px-6 py-4 flex items-center justify-between z-30 shadow-sm shrink-0">
                <div className="flex flex-col">
                    <h2 className="text-xl font-black text-slate-800">Phiếu Trắc Nghiệm</h2>
                    <p className="text-sm font-bold text-slate-500 mt-1">Đã làm: <span className="text-red-500">{answeredQuestionsCount}</span> / {allQuestions.length} câu</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-2 text-center shadow-inner hidden md:block">
                    <p className="text-red-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Thời gian</p>
                    <div className={`font-mono font-black text-xl tracking-tight leading-none ${timeLeft < 300 ? 'text-red-600 animate-pulse' : 'text-red-500'}`}>
                        {formatTime(timeLeft)}
                    </div>
                </div>
            </div>

            {/* Bubble Sheet container */}
            <div className="flex-1 overflow-y-auto overscroll-y-contain scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
                <AnswerSheet2025 
                    examData={examData} 
                    answers={answers} 
                    handleAnswerChange={handleAnswerChange} 
                />
                
                <div className="max-w-md mx-auto mt-4 mb-20 px-4 md:px-0">
                    <button
                        onClick={handleManualSubmit}
                        disabled={isSubmitting}
                        className="w-full py-5 rounded-xl bg-gradient-to-r from-red-500 to-[#fe5f36] text-white font-black text-lg shadow-xl shadow-red-500/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                        {isSubmitting ? <><span className="material-symbols-outlined animate-spin text-white">sync</span> Đang nộp bài...</> : <><span className="material-symbols-outlined text-white">send</span> Hoàn tất & Nộp bài</>}
                    </button>
                </div>
            </div>
            
            {/* Mobile: fixed bottom submit bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-4 z-40">
                <button
                    onClick={handleManualSubmit}
                    disabled={isSubmitting}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#fe5f36] to-pink-600 text-white font-black flex items-center justify-center gap-2 disabled:opacity-70"
                >
                    {isSubmitting ? 'Đang nộp...' : 'Nộp bài'}
                </button>
            </div>
        </div>
    );
}
