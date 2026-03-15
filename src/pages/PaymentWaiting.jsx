import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const COUNTDOWN_MINUTES = 15;
const VIETQR_API = 'https://api.vietqr.io/v2/generate';
const BANK_ID = import.meta.env.VITE_BANK_ID || 'MB';
const ACCOUNT_NO = import.meta.env.VITE_ACCOUNT_NO || '0000000000';
const ACCOUNT_NAME = import.meta.env.VITE_ACCOUNT_NAME || 'TRAM SINH VIEN';
const PACKAGE_FALLBACKS = {
    '1m': { id: '1m', label: '1 Tháng', price: 39000, days: 30 },
    '3m': { id: '3m', label: '3 Tháng', price: 79000, days: 90 },
    '1y': { id: '1y', label: '1 Năm', price: 149000, days: 365 },
};

export default function PaymentWaiting() {
    const { orderId } = useParams();
    const { state } = useLocation();
    const navigate = useNavigate();
    const { user, refreshProfile } = useAuth();

    const [qrUrl, setQrUrl] = useState(null);
    const [timeLeft, setTimeLeft] = useState(COUNTDOWN_MINUTES * 60);
    const [status, setStatus] = useState('waiting'); // 'waiting' | 'success' | 'expired'
    const [order, setOrder] = useState(null);
    const [loadingOrder, setLoadingOrder] = useState(true);
    const realtimeRef = useRef(null);

    const bankId = BANK_ID;
    const accountNo = ACCOUNT_NO;
    const accountName = ACCOUNT_NAME;
    const pkg = useMemo(() => (
        order
            ? {
                ...(PACKAGE_FALLBACKS[order.package_id] || {}),
                id: order.package_id,
                price: order.amount,
                days: order.vip_days,
            }
            : state?.pkg
    ), [order, state?.pkg]);
    const transferContent = user && order ? `TSV ${user.id} ${order.id}` : state?.transferContent;

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

    // Tạo VietQR code
    const generateQR = useCallback(async () => {
        try {
            const res = await fetch(VIETQR_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-client-id': 'antigravity', 'x-api-key': 'sandbox' },
                body: JSON.stringify({
                    accountNo,
                    accountName,
                    acqId: bankId,
                    amount: pkg?.price,
                    addInfo: transferContent,
                    format: 'text',
                    template: 'compact',
                }),
            });
            const data = await res.json();
            if (data?.data?.qrDataURL) {
                setQrUrl(data.data.qrDataURL);
            } else {
                // Fallback: dùng URL trực tiếp từ VietQR
                const fallbackUrl = `https://api.vietqr.io/${bankId}/${accountNo}/${pkg?.price}/${encodeURIComponent(transferContent || '')}/qr_only.jpg`;
                setQrUrl(fallbackUrl);
            }
        } catch {
            const fallbackUrl = `https://api.vietqr.io/${bankId}/${accountNo}/${pkg?.price}/${encodeURIComponent(transferContent || '')}/qr_only.jpg`;
            setQrUrl(fallbackUrl);
        }
    }, [accountName, accountNo, bankId, pkg?.price, transferContent]);

    useEffect(() => {
        if (!pkg || !transferContent) return;
        generateQR();
    }, [pkg, transferContent, generateQR]);

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
                        // VIP đã được kích hoạt!
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
                        Quay lại trang Nâng cấp VIP
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
                    <h2 className="text-3xl font-black mt-4">Đang kích hoạt VIP...</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f080a] text-white font-display flex flex-col items-center justify-center px-4 py-10">
            <div className="w-full max-w-lg">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-black mb-1">Quét mã để thanh toán</h1>
                    <p className="text-slate-400 text-sm">Sau khi chuyển khoản thành công, trang sẽ tự động cập nhật</p>
                </div>

                {/* Main card */}
                <div className="bg-[#1a0f12]/80 backdrop-blur border border-white/10 rounded-3xl p-6 shadow-2xl">
                    {/* QR Code */}
                    <div className="bg-white rounded-2xl p-4 flex items-center justify-center mb-5 aspect-square max-w-[240px] mx-auto">
                        {qrUrl ? (
                            <img src={qrUrl} alt="VietQR Payment" className="w-full h-full object-contain" />
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-slate-400">
                                <span className="material-symbols-outlined animate-spin text-3xl">sync</span>
                                <p className="text-xs">Đang tạo mã QR...</p>
                            </div>
                        )}
                    </div>

                    {/* Transfer info */}
                    <div className="space-y-3 mb-5">
                        {[
                            { label: 'Ngân hàng', value: bankId },
                            { label: 'Số tài khoản', value: accountNo, copy: true },
                            { label: 'Tên tài khoản', value: accountName },
                            { label: 'Số tiền', value: formatPrice(pkg.price), highlight: true },
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
                                <p className="text-sm font-semibold text-amber-300">Đang chờ thanh toán...</p>
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
                    <p>⚡ VIP được kích hoạt tự động trong vòng &lt;60 giây sau khi transfer.</p>
                    <p>📋 <strong className="text-slate-400">QUAN TRỌNG:</strong> Nhập đúng nội dung chuyển khoản để hệ thống nhận diện tự động.</p>
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
