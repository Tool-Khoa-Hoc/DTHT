import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useExamAccess } from '../hooks/useExamAccess';
import { useExamEngine } from '../hooks/useExamEngine';
import ExamTakingHeader from '../components/exam/ExamTakingHeader';
import ExamRightPanel from '../components/exam/ExamRightPanel';
import SecurePdfViewer from '../components/exam/SecurePdfViewer';

const FREE_DAILY_LIMIT = 3;

export default function ExamTaking() {
    const { subjectFolder, examPath } = useParams();
    const navigate = useNavigate();
    const { user, profile } = useAuth();

    const { loading: accessLoading, allowed, reason } = useExamAccess(examPath);
    
    // Exam Engine Hook
    const {
        examData,
        loading,
        answers,
        timeLeft,
        isSubmitting,
        submitted,
        handleAnswerChange,
        handleManualSubmit
    } = useExamEngine(subjectFolder, examPath, user, allowed);

    // Split pane states
    const [leftWidth, setLeftWidth] = useState(68);
    const [isDraggingSize, setIsDraggingSize] = useState(false);

    const startDragSize = useCallback((e) => {
        setIsDraggingSize(true);
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
    }, []);

    useEffect(() => {
        if (!isDraggingSize) return;

        const onMouseMove = (e) => {
            let clientX = e.clientX;
            if (e.type === 'touchmove') clientX = e.touches[0].clientX;
            const newWidth = (clientX / window.innerWidth) * 100;
            setLeftWidth(Math.max(20, Math.min(newWidth, 80)));
        };

        const onMouseUp = () => {
            setIsDraggingSize(false);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('touchmove', onMouseMove);
        window.addEventListener('touchend', onMouseUp);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('touchmove', onMouseMove);
            window.removeEventListener('touchend', onMouseUp);
        };
    }, [isDraggingSize]);

    // ─── Screen: Đang tải ────────────────────────────────────
    if (accessLoading || (allowed && (loading || !examData))) {
        return (
            <div className="min-h-screen bg-[#f8f6f6] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-slate-600">
                    <span className="material-symbols-outlined animate-spin text-4xl text-[#fe5f36]">sync</span>
                    <p className="font-semibold">{accessLoading ? 'Đang kiểm tra quyền truy cập...' : 'Đang đồng bộ dữ liệu phòng thi...'}</p>
                </div>
            </div>
        );
    }

    // ─── Screen: Bị chặn (giới hạn đề) ─────────────────────
    if (!allowed) {
        const accessTitle = reason === 'daily_limit'
            ? `Đã đạt giới hạn ${FREE_DAILY_LIMIT} đề hôm nay`
            : reason === 'error'
                ? 'Không thể kiểm tra quyền truy cập'
                : 'Không có quyền truy cập';

        const accessDescription = reason === 'daily_limit'
            ? `User Free chỉ được mở ${FREE_DAILY_LIMIT} đề mới mỗi ngày. Bạn có thể làm lại bất kỳ đề nào đã làm trước đó, hoặc nâng cấp VIP để không giới hạn.`
            : reason === 'error'
                ? 'Đã xảy ra lỗi khi kiểm tra quyền truy cập đề thi. Vui lòng thử lại sau.'
                : 'Vui lòng đăng nhập để làm bài thi.';

        return (
            <div className="min-h-screen bg-[#0f080a] flex items-center justify-center px-4">
                <div className="max-w-md w-full bg-[#1a0f12]/90 backdrop-blur border border-white/10 rounded-3xl p-8 text-center text-white shadow-2xl">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[#fe5f36]/20 to-[#7f13ec]/20 flex items-center justify-center border border-white/10">
                        <span className="material-symbols-outlined text-4xl text-[#fe5f36]">lock</span>
                    </div>
                    <h2 className="text-2xl font-black mb-3">{accessTitle}</h2>
                    <p className="text-slate-400 text-sm leading-relaxed mb-8">{accessDescription}</p>
                    <div className="flex flex-col gap-3">
                        <Link
                            to="/pricing"
                            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#fe5f36] to-pink-600 text-white font-black text-sm flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-lg shadow-[#fe5f36]/30"
                        >
                            <span className="material-symbols-outlined text-[18px]">workspace_premium</span>
                            Nâng cấp VIP – Không giới hạn
                        </Link>
                        <Link to="/exam-room" className="text-slate-400 text-sm hover:text-white transition-colors">
                            ← Quay lại Phòng thi
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const documentUrl = examData?.documentUrl || examData?.document_url || examData?.pdfUrl || examData?.pdf_url || null;

    return (
        <div className="h-screen overflow-hidden bg-[#f8f6f6] text-slate-800 font-display flex flex-col">
            <ExamTakingHeader examData={examData} timeLeft={timeLeft} />

            <div className="flex-1 flex flex-col md:flex-row w-full relative overflow-hidden">
                {/* Premium Mode Left Pane */}
                <div style={{ width: `calc(${leftWidth}%)` }} className="h-full hidden md:block">
                    <SecurePdfViewer 
                        url={documentUrl} 
                        userEmail={user?.email} 
                        userName={profile?.full_name || user?.user_metadata?.full_name} 
                    />
                </div>
                
                {/* Glassmorphism Resizer */}
                <div 
                    className="hidden md:flex flex-col items-center justify-center w-3 bg-slate-200/50 hover:bg-red-400 active:bg-red-500 cursor-col-resize transition-colors z-20 shrink-0 backdrop-blur-sm border-x border-white/20" 
                    onMouseDown={startDragSize}
                    onTouchStart={startDragSize}
                    title="Kéo độ rộng"
                >
                    <div className="w-1 h-8 bg-slate-400 rounded-full"></div>
                </div>

                {/* Document Mode Right Pane (Answer Sheet) */}
                <ExamRightPanel 
                    examData={examData}
                    answers={answers}
                    timeLeft={timeLeft}
                    isSubmitting={isSubmitting}
                    handleAnswerChange={handleAnswerChange}
                    handleManualSubmit={handleManualSubmit}
                    documentUrl={documentUrl}
                    user={user}
                    profile={profile}
                    leftWidth={leftWidth}
                />
            </div>
        </div>
    );
}
