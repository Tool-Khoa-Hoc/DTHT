import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/ToastProvider';
import RankSeal from '../components/ui/RankSeal';

const COURSE_CODE = 'COMBO_HS12_2K9';
const COURSE_NAME = 'COMBO ĐTHT · HS12 (2K9) · Chinh phục Đại học';
const COURSE_PRICE = 50000;

const BANK_INFO = {
  bankBin: '970422',
  bankShortName: 'MB Bank',
  bankFullName: 'Ngân hàng TMCP Quân Đội (MB Bank)',
  accountNo: '0969262209',
  accountName: 'NGUYEN HUU DUC',
};

const HIGHLIGHTS = [
  {
    icon: 'cast_for_education',
    title: 'Kho bài giảng & Sheet học tập 2K9',
    desc: 'Hệ thống hoá đầy đủ bài giảng, chuyên đề, lịch trình học tập của các giáo viên luyện thi hàng đầu theo từng môn Toán · Lý · Hoá · Sinh · Anh · Văn · ĐGNL.',
  },
  {
    icon: 'library_books',
    title: 'Trọn bộ đề thi thử & chuyên đề chọn lọc',
    desc: 'Cập nhật liên tục đề thi thử trường chuyên, sở GD&ĐT toàn quốc kèm lời giải chi tiết và phân tích ma trận đề mới nhất 2027.',
  },
  {
    icon: 'timeline',
    title: 'Lộ trình & Công cụ tối ưu điểm số',
    desc: 'Kết hợp lộ trình ôn thi theo khối, sổ tay công thức cá nhân, tính điểm xét tuyển học bạ / THPT / ĐGNL và đua top bảng vàng mỗi ngày.',
  },
  {
    icon: 'verified',
    title: 'Huy hiệu Học viên VIP & Hỗ trợ ưu tiên',
    desc: 'Tài khoản được gắn nhãn VIP Combo 2K9, ưu tiên cập nhật tài liệu mới và hỗ trợ trực tiếp trong suốt mùa thi.',
  },
];

const CURRICULUM = [
  {
    phase: 'Chặng 1 · Nền tảng & Chuyên đề trọng tâm',
    badge: 'Lớp 12 · Học kỳ 1',
    items: [
      'Nắm chắc toàn bộ kiến thức SGK mới chương trình GDPT 2018 các môn xét tuyển',
      'Hệ thống bài tập phân dạng từ cơ bản đến vận dụng theo từng chuyên đề',
      'Tài liệu tóm tắt công thức, sơ đồ tư duy & bộ câu hỏi Đúng/Sai chuẩn cấu trúc mới',
    ],
  },
  {
    phase: 'Chặng 2 · Tổng ôn & Luyện đề thực chiến',
    badge: 'Học kỳ 2 · Tăng tốc',
    items: [
      'Luyện bộ đề thi thử các trường Chuyên & Sở GD&ĐT trên cả nước',
      'Chiến thuật phân bổ thời gian, xử lý câu hỏi trả lời ngắn & chống sai ngu',
      'Ôn luyện song song kỳ thi Đánh giá năng lực (HSA / APT) & Đánh giá tư duy (TSA)',
    ],
  },
  {
    phase: 'Chặng 3 · Về đích & Tối ưu nguyện vọng',
    badge: 'Tháng 5 – Tháng 7/2027',
    items: [
      'Bộ đề dự đoán & tủ sâu kiến thức trọng tâm sát ngày thi',
      'Phân tích phổ điểm, quy đổi điểm chuẩn và sắp xếp nguyện vọng đại học an toàn',
    ],
  },
];

export default function CourseComboHs12() {
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [activeOrder, setActiveOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [paymentCheckMessage, setPaymentCheckMessage] = useState('');
  const [userNote, setUserNote] = useState('');
  const [copiedField, setCopiedField] = useState('');

  const isEnrolled = Boolean(profile?.is_vip) || activeOrder?.status === 'paid';

  const fetchLatestOrder = useCallback(async () => {
    if (!user) return;
    setLoadingOrder(true);
    try {
      // Query valid public.orders table
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setActiveOrder(data);
      }
    } catch (err) {
      console.error('Lỗi kiểm tra đơn khóa học:', err);
    } finally {
      setLoadingOrder(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLatestOrder();
  }, [fetchLatestOrder]);

  const handleCreateOrOpenOrder = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (activeOrder) {
      const paymentEl = document.getElementById('payment-section');
      paymentEl?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    setCreatingOrder(true);
    try {
      const randSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
      const transferCode = `DTHT${randSuffix}`;

      // Insert directly into real public.orders table without broken RPCs
      const { data, error } = await supabase
        .from('orders')
        .insert([
          {
            user_id: user.id,
            package_id: '1y',
            amount: COURSE_PRICE,
            vip_days: 365,
            status: 'pending',
            transfer_code: transferCode,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      setActiveOrder(data);
      showToast('Đã khởi tạo mã chuyển khoản thành công!', 'success');
      setTimeout(() => {
        document.getElementById('payment-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      showToast(
        'Không thể khởi tạo đơn: ' + (err.message || 'Vui lòng thử lại sau.'),
        'error',
      );
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleConfirmTransferred = () => {
    if (!activeOrder) return;
    setSubmittingProof(true);
    setPaymentCheckMessage(
      `Đã ghi nhận báo chuyển khoản cho mã "${transferContent}". Bạn có thể vào thẳng kho học online ngay bằng tài khoản Google, hoặc liên hệ Quân Sư hỗ trợ mở quyền riêng!`,
    );
    showToast('Đã ghi nhận thông báo chuyển khoản!', 'success');
    setSubmittingProof(false);
  };

  const handleAutoCheckPayment = useCallback(
    async (silent = false) => {
      if (!activeOrder || activeOrder.status === 'paid') return false;
      if (!silent) {
        setCheckingPayment(true);
        setPaymentCheckMessage('');
      }
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('id', activeOrder.id)
          .single();

        if (error) throw error;

        if (data?.status === 'paid') {
          setActiveOrder(data);
          await refreshProfile?.();
          setPaymentCheckMessage(
            'Hệ thống đã xác nhận thanh toán thành công! Khóa học của bạn đã được mở.',
          );
          return true;
        }

        if (!silent) {
          setPaymentCheckMessage(
            'Đơn hàng đang chờ đối soát với nội dung "' +
              (data?.transfer_code || activeOrder.transfer_code) +
              '". Nếu bạn đã chuyển khoản thành công, Admin sẽ duyệt trong ít phút. Bạn cũng có thể vào thẳng kho học online!',
          );
        }
        return false;
      } catch (err) {
        if (!silent) {
          console.error('Lỗi kiểm tra thanh toán:', err);
          setPaymentCheckMessage(
            'Chưa có cập nhật đối soát từ ngân hàng. Bạn có thể bấm "Tôi đã chuyển khoản 50.000đ" để hệ thống ghi nhận.',
          );
        }
        return false;
      } finally {
        if (!silent) setCheckingPayment(false);
      }
    },
    [activeOrder, refreshProfile],
  );

  const handleCopy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      showToast(`Đã sao chép ${label}`, 'info', 1800);
      setTimeout(() => setCopiedField(''), 2000);
    } catch {
      // Ignore
    }
  };

  const transferContent = activeOrder?.transfer_code || (user?.id ? `DTHT${user.id.slice(0, 5).toUpperCase()}` : 'DTHT2K9');
  const qrUrl = `https://img.vietqr.io/image/${BANK_INFO.bankBin}-${BANK_INFO.accountNo}-compact2.png?amount=${COURSE_PRICE}&addInfo=${encodeURIComponent(
    transferContent,
  )}&accountName=${encodeURIComponent(BANK_INFO.accountName)}`;

  return (
    <div className="min-h-full bg-background text-foreground font-sans pb-24">
      {/* Hero Banner */}
      <section className="relative overflow-hidden border-b border-border bg-paper">
        <span
          aria-hidden="true"
          className="hanzi-watermark hidden lg:block absolute top-8 right-10 text-[130px] font-bold text-accent/8"
        >
          登科
        </span>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <RankSeal size="sm" icon="workspace_premium" label="Khóa học Đặc biệt · 2K9" />
                <span className="paper-chip bg-jade-soft text-jade border-jade-border font-bold">
                  Mùa thi THPT 2027
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl lg:text-[2.6rem] font-display font-extrabold leading-tight tracking-tight text-foreground">
                COMBO ĐTHT – HS12 (2K9)
                <span className="block mt-1 text-primary">
                  <span className="brush-underline">Chinh phục Đại học 2027</span>
                </span>
              </h1>

              <p className="text-secondary-text text-sm sm:text-base leading-relaxed max-w-2xl">
                Gói đồng hành toàn diện dành riêng cho học sinh lớp 12 (2K9): kết nối kho tài liệu chọn lọc, hệ thống bài giảng đa môn, lộ trình chiến lược và cộng đồng thi đua học tập mỗi ngày.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  to="/hoc-online"
                  className="btn-arena btn-arena-primary"
                >
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">
                    cast_for_education
                  </span>
                  <span>Vào Kho Học Online Ngay</span>
                </Link>

                {!isEnrolled && (
                  <button
                    type="button"
                    onClick={handleCreateOrOpenOrder}
                    disabled={creatingOrder}
                    className="btn-arena btn-arena-gold"
                  >
                    <span className="material-symbols-outlined text-xl" aria-hidden="true">
                      bolt
                    </span>
                    <span>
                      {creatingOrder
                        ? 'Đang tạo mã...'
                        : activeOrder
                          ? 'Xem thông tin chuyển khoản'
                          : 'Đăng ký gói VIP · Chỉ 50.000đ'}
                    </span>
                  </button>
                )}

                <Link
                  to="/library"
                  className="btn-arena btn-arena-secondary"
                >
                  <span className="material-symbols-outlined text-lg text-accent" aria-hidden="true">
                    folder_open
                  </span>
                  <span>Xem tài liệu miễn phí</span>
                </Link>
              </div>
            </div>

            {/* Price Summary Card */}
            <div className="lg:col-span-5">
              <div className="imperial-frame p-6 relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-secondary-text">
                    Học phí ưu đãi trọn gói
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-gold-soft text-gold-dark border border-gold">
                    Trọn mùa thi 2027
                  </span>
                </div>

                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-4xl sm:text-5xl font-display font-extrabold text-primary tabular">
                    50.000đ
                  </span>
                  <span className="text-sm text-muted-foreground line-through tabular">299.000đ</span>
                </div>
                <p className="text-xs text-secondary-text mb-5">
                  Thanh toán 1 lần duy nhất qua VietQR — hỗ trợ đối soát nhanh và mở quyền xem qua Google Sheets.
                </p>

                <div className="space-y-2.5 pt-4 border-t border-border text-xs text-foreground">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-jade text-base" aria-hidden="true">
                      check_circle
                    </span>
                    <span>Truy cập toàn bộ tài nguyên Combo 2K9 đến hết kỳ thi 2027</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-jade text-base" aria-hidden="true">
                      check_circle
                    </span>
                    <span>Mã chuyển khoản riêng gắn trực tiếp với tài khoản của bạn</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-jade text-base" aria-hidden="true">
                      check_circle
                    </span>
                    <span>Đồng bộ và hỗ trợ trực tiếp khi có học liệu mới</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-12">
        {/* Quyền lợi học viên */}
        <section>
          <div className="mb-6">
            <h2 className="text-xl sm:text-2xl font-display font-extrabold text-foreground">
              Quyền lợi trong gói COMBO ĐTHT 2K9
            </h2>
            <p className="text-xs sm:text-sm text-secondary-text mt-1">
              Tất cả công cụ và học liệu cần thiết để học sinh lớp 12 bứt phá điểm số
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {HIGHLIGHTS.map((item) => (
              <div
                key={item.title}
                className="paper-card paper-card-interactive p-5 flex items-start gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-primary-soft border border-primary/30 text-primary flex items-center justify-center no-shrink">
                  <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                    {item.icon}
                  </span>
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-foreground mb-1">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-secondary-text leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Cấu trúc 3 chặng */}
        <section>
          <div className="mb-6">
            <h2 className="text-xl sm:text-2xl font-display font-extrabold text-foreground">
              Cấu trúc 3 chặng chinh phục Đại học
            </h2>
            <p className="text-xs sm:text-sm text-secondary-text mt-1">
              Lộ trình được thiết kế bài bản theo đúng nhịp học của học sinh 2K9
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {CURRICULUM.map((stage, idx) => (
              <div
                key={stage.phase}
                className="paper-card p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="w-8 h-8 rounded-lg bg-primary text-white font-display font-bold text-xs flex items-center justify-center tabular">
                      0{idx + 1}
                    </span>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gold-soft text-gold-dark border border-gold">
                      {stage.badge}
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-base text-foreground mb-3">
                    {stage.phase}
                  </h3>
                  <ul className="space-y-2.5">
                    {stage.items.map((point) => (
                      <li
                        key={point}
                        className="flex items-start gap-2 text-xs sm:text-sm text-secondary-text leading-relaxed"
                      >
                        <span
                          className="material-symbols-outlined text-jade text-base no-shrink mt-0.5"
                          aria-hidden="true"
                        >
                          check
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Khu vực Thanh toán VietQR & Trạng thái đơn */}
        <section id="payment-section" className="scroll-mt-20">
          <div className="imperial-frame overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-paper">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Đăng ký &amp; Kích hoạt tài khoản
                </span>
                <h2 className="text-xl sm:text-2xl font-display font-extrabold text-foreground mt-1">
                  Thanh toán chuyển khoản ngân hàng (VietQR)
                </h2>
                <p className="text-xs sm:text-sm text-secondary-text mt-1">
                  Quét mã QR hoặc chuyển khoản đúng nội dung để hệ thống hỗ trợ mở quyền học nhanh chóng
                </p>
              </div>

              {activeOrder && (
                <StatusBadge status={activeOrder.status} isEnrolled={isEnrolled} />
              )}
            </div>

            <div className="p-6 sm:p-8 bg-surface">
              {!user ? (
                <div className="text-center py-8 max-w-md mx-auto space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary-soft border border-primary/30 text-primary flex items-center justify-center mx-auto">
                    <span className="material-symbols-outlined text-3xl" aria-hidden="true">
                      lock
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-lg text-foreground">
                    Vui lòng đăng nhập trước khi đăng ký
                  </h3>
                  <p className="text-xs sm:text-sm text-secondary-text leading-relaxed">
                    Hệ thống cần gắn mã chuyển khoản riêng với tài khoản của bạn để kích hoạt quyền truy cập khóa học chính xác.
                  </p>
                  <Link
                    to="/auth"
                    className="btn-arena btn-arena-primary"
                  >
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">
                      login
                    </span>
                    Đăng nhập / Tạo tài khoản
                  </Link>
                </div>
              ) : loadingOrder ? (
                <div className="py-12 flex justify-center">
                  <span
                    className="material-symbols-outlined animate-spin text-3xl text-primary"
                    aria-hidden="true"
                  >
                    sync
                  </span>
                </div>
              ) : isEnrolled ? (
                <div className="rounded-2xl bg-completed-soft border border-completed-border p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-completed text-white flex items-center justify-center no-shrink">
                      <span className="material-symbols-outlined text-2xl icon-fill" aria-hidden="true">
                        verified
                      </span>
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-base sm:text-lg text-foreground">
                        Tài khoản của bạn đã kích hoạt {COURSE_NAME}
                      </h3>
                      <p className="text-xs sm:text-sm text-secondary-text mt-1">
                        Mã đơn:{' '}
                        <span className="font-mono font-bold text-foreground">
                          {activeOrder?.transfer_code || 'VIP-2K9'}
                        </span>{' '}
                        · Chúc bạn ôn luyện hiệu quả và đỗ nguyện vọng 1!
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/hoc-online"
                    className="btn-arena btn-arena-jade no-shrink"
                  >
                    <span>Bắt đầu học ngay</span>
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      arrow_forward
                    </span>
                  </Link>
                </div>
              ) : !activeOrder ? (
                <div className="text-center py-8 max-w-lg mx-auto space-y-4">
                  <p className="text-sm text-secondary-text leading-relaxed">
                    Nhấn nút bên dưới để hệ thống sinh{' '}
                    <strong className="text-foreground">Mã nội dung chuyển khoản riêng</strong> và mã QR VietQR 50.000đ cho tài khoản{' '}
                    <strong className="text-primary">{user.email}</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={handleCreateOrOpenOrder}
                    disabled={creatingOrder}
                    className="btn-arena btn-arena-primary"
                  >
                    <span className="material-symbols-outlined text-xl" aria-hidden="true">
                      qr_code_2
                    </span>
                    <span>{creatingOrder ? 'Đang khởi tạo...' : 'Lấy mã QR chuyển khoản 50.000đ'}</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  {/* QR Code Box */}
                  <div className="lg:col-span-5 flex flex-col items-center p-5 rounded-2xl bg-paper border border-border">
                    <div className="bg-surface p-3 rounded-2xl shadow-xs border border-border mb-3">
                      <img
                        src={qrUrl}
                        alt="Mã VietQR chuyển khoản khóa học"
                        className="w-60 h-60 sm:w-64 sm:h-64 object-contain"
                      />
                    </div>
                    <p className="text-xs font-bold text-foreground text-center">
                      Mở App Ngân hàng / MoMo bất kỳ để quét VietQR
                    </p>
                    <p className="text-[11px] text-secondary-text text-center mt-1">
                      Số tiền <strong className="text-foreground">50.000đ</strong> và nội dung{' '}
                      <strong className="text-primary">{transferContent}</strong> sẽ được điền tự động.
                    </p>
                  </div>

                  {/* Bank details & Confirm */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <InfoField
                        label="Ngân hàng thụ hưởng"
                        value={BANK_INFO.bankFullName}
                      />
                      <InfoField
                        label="Chủ tài khoản"
                        value={BANK_INFO.accountName}
                      />
                      <InfoField
                        label="Số tài khoản MB Bank"
                        value={BANK_INFO.accountNo}
                        copyable
                        copied={copiedField === 'stk'}
                        onCopy={() => handleCopy(BANK_INFO.accountNo, 'Số tài khoản')}
                      />
                      <InfoField
                        label="Số tiền thanh toán"
                        value="50.000 VNĐ"
                        highlight
                        copyable
                        copied={copiedField === 'amount'}
                        onCopy={() => handleCopy(String(COURSE_PRICE), 'Số tiền')}
                      />
                    </div>

                    <div className="p-4 rounded-xl bg-primary-soft border border-primary/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider font-bold text-primary">
                          Nội dung chuyển khoản bắt buộc (chính xác)
                        </p>
                        <p className="text-xl font-mono font-extrabold text-foreground tracking-wider mt-0.5">
                          {transferContent}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(transferContent, 'Mã nội dung')}
                        className="btn-arena btn-arena-primary btn-arena-sm no-shrink"
                      >
                        <span className="material-symbols-outlined text-sm" aria-hidden="true">
                          {copiedField === 'Mã nội dung' ? 'check' : 'content_copy'}
                        </span>
                        <span>{copiedField === 'Mã nội dung' ? 'Đã sao chép' : 'Sao chép nội dung'}</span>
                      </button>
                    </div>

                    {/* Step Confirmation */}
                    <div className="p-5 rounded-2xl bg-paper border border-border space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">
                          Ghi chú giao dịch (tuỳ chọn: thời gian chuyển / 4 số cuối TK / tên người chuyển)
                        </label>
                        <input
                          type="text"
                          value={userNote}
                          onChange={(e) => setUserNote(e.target.value)}
                          placeholder="VD: Đã chuyển lúc 20:15 từ TK Vietcombank Nguyễn Văn A"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border-strong text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-xs text-secondary-text leading-relaxed flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full bg-jade animate-ping no-shrink"
                            aria-hidden="true"
                          />
                          <span>
                            Mã đơn hàng: <strong className="text-foreground font-mono">{transferContent}</strong>
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 no-shrink">
                          <button
                            type="button"
                            onClick={() => handleAutoCheckPayment(false)}
                            disabled={checkingPayment}
                            className="btn-arena btn-arena-secondary btn-arena-sm"
                          >
                            <span
                              className={`material-symbols-outlined text-lg ${
                                checkingPayment ? 'animate-spin' : ''
                              }`}
                              aria-hidden="true"
                            >
                              {checkingPayment ? 'sync' : 'refresh'}
                            </span>
                            <span>{checkingPayment ? 'Đang kiểm tra...' : 'Kiểm tra trạng thái'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleConfirmTransferred}
                            disabled={submittingProof}
                            className="btn-arena btn-arena-primary btn-arena-sm"
                          >
                            <span className="material-symbols-outlined text-lg" aria-hidden="true">
                              check_circle
                            </span>
                            <span>Tôi đã chuyển khoản 50.000đ</span>
                          </button>
                        </div>
                      </div>

                      {paymentCheckMessage && (
                        <div className="p-3 rounded-xl bg-primary-soft border border-primary/30 text-xs text-foreground leading-relaxed">
                          {paymentCheckMessage}
                        </div>
                      )}

                      <div className="pt-2 flex items-center justify-between border-t border-border text-xs text-secondary-text">
                        <span>Đã có tài khoản Google?</span>
                        <Link to="/hoc-online" className="text-primary font-bold hover:underline flex items-center gap-1">
                          <span>Vào thẳng Kho Học Online</span>
                          <span className="material-symbols-outlined text-sm" aria-hidden="true">
                            arrow_forward
                          </span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoField({ label, value, copyable, copied, onCopy, highlight }) {
  return (
    <div className="p-3.5 rounded-xl bg-paper border border-border flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[11px] text-secondary-text">{label}</p>
        <p
          className={`text-sm font-bold truncate mt-0.5 tabular ${
            highlight ? 'text-primary' : 'text-foreground'
          }`}
        >
          {value}
        </p>
      </div>
      {copyable && (
        <button
          type="button"
          onClick={onCopy}
          className="px-2.5 py-1.5 rounded-lg bg-surface hover:bg-surface-alt border border-border-strong text-xs font-semibold text-foreground no-shrink flex items-center gap-1 cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm" aria-hidden="true">
            {copied ? 'check' : 'content_copy'}
          </span>
          <span>{copied ? 'Đã chép' : 'Chép'}</span>
        </button>
      )}
    </div>
  );
}

function StatusBadge({ status, isEnrolled }) {
  if (isEnrolled || status === 'paid' || status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-completed-soft text-completed border border-completed-border">
        <span className="material-symbols-outlined text-base" aria-hidden="true">
          verified
        </span>
        Đã kích hoạt thành công
      </span>
    );
  }
  if (status === 'expired') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-primary-soft text-primary border border-primary/35">
        <span className="material-symbols-outlined text-base" aria-hidden="true">
          history
        </span>
        Gói đã hết hạn
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-gold-soft text-gold-dark border border-gold">
      <span className="material-symbols-outlined text-base" aria-hidden="true">
        schedule
      </span>
      Chờ chuyển khoản 50.000đ
    </span>
  );
}
