import React, { useState, useEffect } from 'react';

export default function WelcomeModal() {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        // Checking if the user has already seen the modal in this session/browser
        const hasSeenNotice = localStorage.getItem('hasSeenWelcomeNotice_v1');
        if (!hasSeenNotice) {
            setIsOpen(true);
        }
    }, []);

    const handleClose = () => {
        setIsOpen(false);
        localStorage.setItem('hasSeenWelcomeNotice_v1', 'true');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#1a0f12] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10 animate-[scale-in_0.3s_ease-out]">
                {/* Header Decoration */}
                <div className="h-24 bg-gradient-to-r from-[#fe5f36] via-[#e36488] to-[#7f13ec] relative">
                    <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-white dark:bg-[#1a0f12] rounded-full flex items-center justify-center p-1.5 shadow-lg">
                        <div className="w-full h-full bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/20">
                            <span className="material-symbols-outlined text-4xl text-amber-500">campaign</span>
                        </div>
                    </div>
                </div>

                <div className="pt-12 pb-6 px-6 text-center">
                    <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">
                        Thông báo hệ thống
                    </h3>
                    
                    <div className="space-y-3 text-sm font-medium text-slate-600 dark:text-slate-400 mb-8 bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                        <p>
                            Chào mừng bạn đến với <strong className="text-[#fe5f36] font-black">Trạm Học Sinh Sinh Viên!</strong>
                        </p>
                        <p>
                            Hiện tại, hệ thống trang web đang trong quá trình nâng cấp và hoàn thiện. Đặc biệt, tính năng <b className="text-[#3b82f6]">Phòng Thi</b> đang được gấp rút cập nhật để mang lại trải nghiệm tốt nhất.
                        </p>
                        <p className="italic text-xs mt-2 text-slate-500">
                            Nếu xảy ra lỗi trong quá trình sử dụng, kính mong quý khách thông cảm!
                        </p>
                    </div>

                    <button 
                        onClick={handleClose}
                        className="w-full bg-gradient-to-r from-[#fe5f36] to-pink-600 text-white font-bold py-3.5 rounded-xl hover:shadow-lg hover:shadow-[#fe5f36]/30 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined">check_circle</span>
                        Tôi đã hiểu
                    </button>
                </div>
            </div>
        </div>
    );
}
