import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function PaymentSuccess() {
    const { profile } = useAuth();

    return (
        <div className="min-h-screen bg-[#0f080a] text-white font-display flex items-center justify-center px-4">
            <div className="max-w-md w-full text-center">
                {/* Celebration icon */}
                <div className="relative inline-flex mb-8">
                    <div className="w-28 h-28 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-2xl shadow-amber-500/30 animate-pulse">
                        <span className="material-symbols-outlined text-6xl text-white">workspace_premium</span>
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/40">
                        <span className="material-symbols-outlined text-[18px] text-white">check</span>
                    </div>
                </div>

                <h1 className="text-3xl font-black mb-3">
                    Chào mừng VIP! 🎉
                </h1>
                <p className="text-slate-400 mb-2">
                    Tài khoản <strong className="text-white">{profile?.display_name || 'của bạn'}</strong> đã được nâng cấp thành công.
                </p>
                {profile?.vip_expired_at && (
                    <p className="text-amber-400 text-sm font-semibold mb-8">
                        VIP có hiệu lực đến: {new Date(profile.vip_expired_at).toLocaleDateString('vi-VN', {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                        })}
                    </p>
                )}

                {/* Benefits recap */}
                <div className="bg-[#1a0f12]/80 border border-amber-500/20 rounded-3xl p-6 mb-8 text-left space-y-3">
                    {[
                        { icon: 'all_inclusive', text: 'Không giới hạn đề mới mỗi ngày' },
                        { icon: 'play_circle', text: 'Truy cập toàn bộ video chữa bài' },
                        { icon: 'bolt', text: 'VIP đã được kích hoạt ngay lập tức' },
                    ].map(b => (
                        <div key={b.icon} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-amber-400 text-[18px]">{b.icon}</span>
                            </div>
                            <span className="text-slate-300 text-sm font-medium">{b.text}</span>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col gap-3">
                    <Link
                        to="/exam-room"
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#fe5f36] to-pink-600 text-white font-black text-sm flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-lg shadow-[#fe5f36]/30"
                    >
                        <span className="material-symbols-outlined text-[18px]">quiz</span>
                        Vào Phòng Thi ngay
                    </Link>
                    <Link
                        to="/profile"
                        className="text-slate-400 text-sm hover:text-white transition-colors"
                    >
                        Xem trang cá nhân →
                    </Link>
                </div>
            </div>
        </div>
    );
}
