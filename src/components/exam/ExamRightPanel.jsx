import React from 'react';
import AnswerSheet2025 from './AnswerSheet2025';
import DocumentRenderer from './DocumentRenderer';
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
        <div
            style={{ width: leftWidth !== undefined ? `calc(${100 - leftWidth}%)` : '100%' }}
            className="relative z-10 flex h-full w-full flex-col bg-[#fff3f6] shadow-2xl transition-all md:w-auto"
        >
            <div className="h-[50vh] w-full shrink-0 border-b-2 border-rose-100 md:hidden">
                <DocumentRenderer
                    url={documentUrl}
                    userEmail={user?.email}
                    userName={profile?.full_name || user?.user_metadata?.full_name}
                />
            </div>

            <div className="sticky top-0 z-30 flex shrink-0 items-center justify-between gap-4 border-b border-rose-100 bg-white/95 px-6 py-5 shadow-sm backdrop-blur-xl md:px-7">
                <div className="min-w-0">
                    <h2 className="text-xl font-black text-slate-800 md:text-[1.75rem]">Phiếu Trắc Nghiệm</h2>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                        Đã làm: <span className="text-red-500">{answeredQuestionsCount}</span> / {allQuestions.length} câu
                    </p>
                </div>

                <div className="hidden rounded-3xl border border-rose-200 bg-rose-50 px-5 py-3 text-center shadow-inner md:block">
                    <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-400">Thời gian</p>
                    <div className={`font-mono text-xl font-black leading-none tracking-tight ${timeLeft < 300 ? 'animate-pulse text-red-600' : 'text-red-500'}`}>
                        {formatTime(timeLeft)}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-y-contain scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
                <AnswerSheet2025
                    examData={examData}
                    answers={answers}
                    handleAnswerChange={handleAnswerChange}
                />

                <div className="mx-auto mb-20 mt-4 max-w-md px-4 md:px-0">
                    <button
                        onClick={handleManualSubmit}
                        disabled={isSubmitting}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-[#fe5f36] py-5 text-lg font-black text-white shadow-xl shadow-red-500/30 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-70"
                    >
                        {isSubmitting ? (
                            <>
                                <span className="material-symbols-outlined animate-spin text-white">sync</span>
                                Đang nộp bài...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-white">send</span>
                                Hoàn tất & Nộp bài
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white px-6 py-4 md:hidden">
                <button
                    onClick={handleManualSubmit}
                    disabled={isSubmitting}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#fe5f36] to-pink-600 py-3.5 font-black text-white disabled:opacity-70"
                >
                    {isSubmitting ? 'Đang nộp...' : 'Nộp bài'}
                </button>
            </div>
        </div>
    );
}
