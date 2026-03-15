import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const PACKAGES = [
    {
        id: '1m',
        label: '1 Tháng',
        price: 39000,
        days: 30,
        badge: null,
        color: 'from-blue-500 to-indigo-600',
        perDay: '~1.300đ/ngày',
        features: ['Không giới hạn đề mới', 'Video chữa bài giáo viên', 'Ưu tiên hỗ trợ'],
    },
    {
        id: '3m',
        label: '3 Tháng',
        price: 79000,
        days: 90,
        badge: 'Phổ biến nhất',
        color: 'from-[#fe5f36] to-pink-600',
        perDay: '~880đ/ngày',
        features: ['Không giới hạn đề mới', 'Video chữa bài giáo viên', 'Ưu tiên hỗ trợ', 'Tiết kiệm 38%'],
    },
    {
        id: '1y',
        label: '1 Năm',
        price: 149000,
        days: 365,
        badge: 'Tiết kiệm nhất',
        color: 'from-amber-500 to-orange-600',
        perDay: '~408đ/ngày',
        features: ['Không giới hạn đề mới', 'Video chữa bài giáo viên', 'Ưu tiên hỗ trợ', 'Tiết kiệm 68%'],
    },
];

export default function Pricing() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(null); // package ID đang xử lý

    const handleSelectPackage = async (pkg) => {
        if (!user) {
            navigate('/auth');
            return;
        }
        if (loading) return;
        setLoading(pkg.id);

        try {
            // 1. Tạo Order trong DB
            const { data: order, error } = await supabase
                .from('orders')
                .insert({
                    user_id: user.id,
                    package_id: pkg.id,
                    amount: pkg.price,
                    vip_days: pkg.days,
                    status: 'pending',
                })
                .select('id')
                .single();

            if (error || !order) throw new Error(error?.message || 'Không thể tạo đơn hàng');

            // 2. Chuyển sang trang chờ thanh toán với thông tin đơn
            navigate(`/payment/waiting/${order.id}`, {
                state: {
                    pkg,
                },
            });
        } catch (err) {
            console.error('[Pricing] Error:', err);
            alert('Có lỗi xảy ra: ' + err.message);
        } finally {
            setLoading(null);
        }
    };

    const formatPrice = (price) =>
        new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);

    return (
        <div className="bg-[#0f080a] min-h-screen text-white font-display relative overflow-hidden pb-20">
            {/* Gradient blobs */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#fe5f36]/10 blur-[150px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#7f13ec]/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 max-w-5xl mx-auto px-4 pt-12">
                {/* Header */}
                <div className="text-center mb-14">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold mb-5 uppercase tracking-wider">
                        <span className="material-symbols-outlined text-[16px]">workspace_premium</span>
                        Nâng cấp VIP
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">
                        Mở khóa toàn bộ<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#fe5f36] to-pink-500">
                            Phòng Thi & Video Giải
                        </span>
                    </h1>
                    <p className="text-slate-400 text-base max-w-xl mx-auto">
                        User VIP được làm không giới hạn đề mới mỗi ngày và xem toàn bộ video chữa bài chi tiết từ giáo viên.
                    </p>
                </div>

                {/* Package cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    {PACKAGES.map((pkg) => (
                        <div
                            key={pkg.id}
                            className={`relative rounded-3xl p-6 flex flex-col border transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${
                                pkg.badge === 'Phổ biến nhất'
                                    ? 'bg-gradient-to-br from-[#1a0f12] to-[#2a0f18] border-[#fe5f36]/40 shadow-xl shadow-[#fe5f36]/10'
                                    : 'bg-[#1a0f12]/80 border-white/10'
                            }`}
                        >
                            {/* Badge */}
                            {pkg.badge && (
                                <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-black text-white bg-gradient-to-r ${pkg.color} shadow-lg whitespace-nowrap`}>
                                    {pkg.badge}
                                </div>
                            )}

                            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${pkg.color} flex items-center justify-center mb-5 shadow-lg`}>
                                <span className="material-symbols-outlined text-white text-[22px]">workspace_premium</span>
                            </div>

                            <h2 className="text-xl font-black mb-1">{pkg.label}</h2>
                            <p className="text-slate-500 text-xs mb-4">{pkg.perDay}</p>

                            <div className="mb-6">
                                <span className="text-4xl font-black text-white">{formatPrice(pkg.price)}</span>
                            </div>

                            <ul className="space-y-2.5 mb-8 flex-1">
                                {pkg.features.map((f, i) => (
                                    <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                                        <span className="material-symbols-outlined text-green-400 text-[16px]">check_circle</span>
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => handleSelectPackage(pkg)}
                                disabled={loading === pkg.id}
                                className={`w-full py-3.5 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70
                                    bg-gradient-to-r ${pkg.color} text-white hover:scale-[1.02] active:scale-[0.98] shadow-lg`}
                            >
                                {loading === pkg.id ? (
                                    <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                                ) : (
                                    <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
                                )}
                                {loading === pkg.id ? 'Đang tạo...' : 'Thanh toán ngay'}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Trust badges */}
                <div className="flex flex-wrap items-center justify-center gap-6 text-slate-500 text-xs">
                    {[
                        { icon: 'shield', text: 'Thanh toán bảo mật' },
                        { icon: 'autorenew', text: 'Kích hoạt tự động' },
                        { icon: 'support_agent', text: 'Hỗ trợ 24/7' },
                        { icon: 'verified', text: 'Cam kết hoàn tiền' },
                    ].map(b => (
                        <div key={b.icon} className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-[#fe5f36]">{b.icon}</span>
                            {b.text}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
