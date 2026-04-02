import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const COUNTDOWN_MINUTES = 15;
const BANK_CODE = 'vietcombank';
const BANK_LABEL = 'Vietcombank';
const ACCOUNT_NO = '9356026163';
const ACCOUNT_NAME = 'NGUYEN THANH TAM';
const FIXED_TRANSFER_CONTENT = 'Mo khoa tai lieu hoc';
const PACKAGE_FALLBACKS = {
    '1m': { id: '1m', label: '1 Tháng', price: 39000, days: 30 },
    '3m': { id: '3m', label: '3 Tháng', price: 79000, days: 90 },
    '1y': { id: '1y', label: '1 Năm', price: 149000, days: 365 },
};

const toPositiveInteger = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }
    return Math.round(parsed);
};

export default function PaymentWaiting() {
    const { orderId } = useParams();
    const { state } = useLocation();
    const navigate = useNavigate();
    const { user, refreshProfile } = useAuth();

    const [timeLeft, setTimeLeft] = useState(COUNTDOWN_MINUTES * 60);
    const [status, setStatus] = useState('waiting'); // 'waiting' | 'success' | 'expired'
    const [order, setOrder] = useState(null);
    const [loadingOrder, setLoadingOrder] = useState(true);
    const realtimeRef = useRef(null);

    const pkg = useMemo(() => {
        if (!order) {
            return state?.pkg || null;
        }

        const fallbackPkg = PACKAGE_FALLBACKS[order.package_id] || {};
        const fallbackStatePkg = state?.pkg || {};

        return {
            ...fallbackPkg,
            ...fallbackStatePkg,
            id: order.package_id || fallbackPkg.id || fallbackStatePkg.id,
            price: toPositiveInteger(order.amount)
                ?? toPositiveInteger(fallbackStatePkg.price)
                ?? toPositiveInteger(fallbackPkg.price),
            days: toPositiveInteger(order.vip_days)
                ?? toPositiveInteger(fallbackStatePkg.days)
                ?? toPositiveInteger(fallbackPkg.days),
        };
    }, [order, state?.pkg]);

    const resolvedAmount = useMemo(() => (
        toPositiveInteger(pkg?.price)
        ?? toPositiveInteger(order?.amount)
        ?? toPositiveInteger(state?.pkg?.price)
        ?? null
    ), [order?.amount, pkg?.price, state?.pkg?.price]);

    const transferContent = FIXED_TRANSFER_CONTENT;
    const paymentImageUrl = useMemo(() => {
        const search = new URLSearchParams({
            addInfo: transferContent,
            accountName: ACCOUNT_NAME,
            ...(resolvedAmount ? { amount: String(resolvedAmount) } : {}),
        });

        return `https://img.vietqr.io/image/${BANK_CODE}-${ACCOUNT_NO}-compact2.jpg?${search.toString()}`;
    }, [resolvedAmount, transferContent]);

    useEffect(() => {
        const loadOrder = async () => {
            if (!user || !orderId) {
                setLoadingOrder(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('orders')
                    .select('id, user_id, package_id, amount, vip_days, status')
                    .eq('id', orderId)
                    .eq('user_id', user.id)
                    .single();

                if (error) throw error;
                setOrder(data);
            } catch (error) {
                console.error('[PaymentWaiting] Load order error:', error);
            } finally {
                setLoadingOrder(false);
            }
        };

        loadOrder();
    }, [orderId, user]);

    // Đồng hồ đếm ngược 15 phút
    useEffect(() => {
        if (status !== 'waiting') return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setStatus('expired');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [status]);

    // Supabase Realtime: lắng nghe khi is_vip chuyển thành true
    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel(`vip-payment-${orderId}`)
            .on('postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${user.id}`,
                },
                async (payload) => {
                    if (payload.new?.is_vip === true) {
                        // Quyền truy cập đã được kích hoạt.
                        await refreshProfile?.();
                        setStatus('success');
                        setTimeout(() => navigate('/payment/success'), 1500);
                    }
                }
            )
            .subscribe();

        realtimeRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, orderId, navigate, refreshProfile]);

    const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    const formatPrice = (p) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);

    if (loadingOrder) {
        return (
            <div className="min-h-screen bg-[#0f080a] flex items-center justify-center text-white">
                <div className="text-center">
                    <span className="material-symbols-outlined animate-spin text-4xl text-[#fe5f36] mb-3">sync</span>
                    <p className="text-slate-400">Đang kiểm tra đơn hàng...</p>
                </div>
            </div>
        );
    }

    if (!pkg || !order || order.status !== 'pending') {
        return (
            <div className="min-h-screen bg-[#0f080a] flex items-center justify-center text-white">
                <div className="text-center">
                    <p className="text-slate-400 mb-4">Phiên thanh toán không hợp lệ.</p>
                    <button onClick={() => navigate('/pricing')} className="text-[#fe5f36] hover:underline">
                        Quay lại chọn gói đăng ký
                    </button>
                </div>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="min-h-screen bg-[#0f080a] flex items-center justify-center">
                <div className="text-center text-white">
                    <span className="material-symbols-outlined text-7xl text-green-400 animate-bounce">check_circle</span>
                    <h2 className="text-3xl font-black mt-4">Đang xác nhận mở khóa...</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f080a] text-white font-display flex flex-col items-center justify-center px-4 py-10">
            <div className="w-full max-w-lg">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-black mb-1">Chuyển khoản để mở khóa</h1>
                    <p className="text-slate-400 text-sm">Sử dụng ảnh chuyển khoản bên dưới để đăng ký khóa học hoặc mở khóa tài liệu</p>
                </div>

                {/* Main card */}
                <div className="bg-[#1a0f12]/80 backdrop-blur border border-white/10 rounded-3xl p-6 shadow-2xl">
                    {/* Payment image */}
                    <div className="bg-white rounded-[28px] p-3 mb-5 shadow-lg shadow-black/10 flex justify-center overflow-hidden">
                        <img
                            src={paymentImageUrl}
                            alt="Ảnh chuyển khoản Vietcombank"
                            className="w-full max-w-[280px] rounded-[22px] object-contain"
                        />
                    </div>

                    {/* Transfer info */}
                    <div className="space-y-3 mb-5">
                        {[
                            { label: 'Người thụ hưởng', value: ACCOUNT_NAME },
                            { label: 'Số tài khoản', value: ACCOUNT_NO, copy: true },
                            { label: 'Ngân hàng', value: BANK_LABEL },
                            { label: 'Số tiền', value: formatPrice(resolvedAmount || 0), highlight: true },
                            { label: 'Nội dung CK', value: transferContent, copy: true, highlight: true },
                        ].map(row => (
                            <div key={row.label} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
                                <span className="text-slate-400 text-sm">{row.label}</span>
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm font-bold ${row.highlight ? 'text-[#fe5f36]' : 'text-white'}`}>
                                        {row.value}
                                    </span>
                                    {row.copy && (
                                        <button
                                            onClick={() => navigator.clipboard.writeText(row.value)}
                                            title="Sao chép"
                                            className="text-slate-500 hover:text-white transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[15px]">content_copy</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Status area */}
                    {status === 'waiting' ? (
                        <div className="text-center bg-white/5 rounded-2xl p-4 border border-white/10">
                            <div className="flex items-center justify-center gap-2 mb-1">
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                <p className="text-sm font-semibold text-amber-300">Đang chờ xác nhận thanh toán...</p>
                            </div>
                            <p className={`font-mono text-3xl font-black ${timeLeft < 120 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                                {formatTime(timeLeft)}
                            </p>
                            <p className="text-slate-500 text-xs mt-1">Hết hạn sau {COUNTDOWN_MINUTES} phút</p>
                        </div>
                    ) : (
                        <div className="text-center bg-red-500/10 rounded-2xl p-4 border border-red-500/20">
                            <p className="text-red-400 font-bold text-sm mb-2">Phiên thanh toán đã hết hạn</p>
                            <button
                                onClick={() => navigate('/pricing')}
                                className="text-[#fe5f36] text-sm hover:underline"
                            >
                                Tạo lại đơn hàng mới
                            </button>
                        </div>
                    )}
                </div>

                {/* Note */}
                <div className="mt-4 text-center text-slate-500 text-xs space-y-1">
                    <p>📌 Dùng đúng tỷ lệ ảnh để có thể quét mã QR chính xác trên app ngân hàng.</p>
                    <p>📋 <strong className="text-slate-400">Nội dung chuyển khoản:</strong> {transferContent}</p>
                    <p>📞 Sau khi chuyển khoản xong, vui lòng liên hệ qua Zalo admin <strong className="text-slate-300">0862370152</strong> để yêu cầu truy cập tài liệu.</p>
                </div>

                <button
                    onClick={() => navigate('/pricing')}
                    className="mt-6 w-full text-slate-500 text-sm hover:text-white transition-colors py-2"
                >
                    ← Quay lại chọn gói khác
                </button>
            </div>
        </div>
    );
}
