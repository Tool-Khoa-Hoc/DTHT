import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { getComboHs12Course } from '../content/courseCatalog';
import { useToast } from '../components/ui/ToastProvider';
import RankSeal from '../components/ui/RankSeal';
import SectionHeading from '../components/ui/SectionHeading';

const COURSE_PRICE = 50000;

const BANK_INFO = {
  bankBin: '970422',
  bankShortName: 'MB Bank',
  bankFullNameVi: 'Ngân hàng TMCP Quân Đội (MB Bank)',
  bankFullNameEn: 'Military Commercial Joint Stock Bank (MB Bank)',
  accountNo: '0969262209',
  accountName: 'NGUYEN HUU DUC',
};

const VIP_HIGHLIGHTS = [
  {
    icon: 'cast_for_education',
    titleVi: 'Kho bài giảng & Sheet học tập 2K9',
    titleEn: 'Curated Lecture Sheets & Syllabi (Class of 2027)',
    descVi:
      'Hệ thống hoá đầy đủ bài giảng, chuyên đề, lịch trình học tập của các giáo viên luyện thi hàng đầu theo từng môn Toán · Lý · Hoá · Sinh · Anh · Văn · ĐGNL.',
    descEn:
      'Systematized lesson sheets, topic guides, and schedules from top instructors across Math · Physics · Chemistry · Biology · English · Literature · HSA/V-ACT.',
  },
  {
    icon: 'library_books',
    titleVi: 'Trọn bộ đề thi thử & chuyên đề chọn lọc',
    titleEn: 'Complete Specialized Mock Exams & Topic Workbooks',
    descVi:
      'Cập nhật liên tục đề thi thử trường chuyên, sở GD&ĐT toàn quốc kèm lời giải chi tiết và phân tích ma trận đề mới nhất 2027.',
    descEn:
      'Continuously updated mock exams from specialized high schools and provincial boards nationwide, complete with solutions and 2027 blueprint analysis.',
  },
  {
    icon: 'timeline',
    titleVi: 'Lộ trình & Công cụ tối ưu điểm số',
    titleEn: 'Admission Roadmaps & Score Optimization Suite',
    descVi:
      'Kết hợp lộ trình ôn thi theo khối, sổ tay công thức cá nhân, tính điểm xét tuyển học bạ / THPT / ĐGNL và đua top bảng vàng mỗi ngày.',
    descEn:
      'Combines exam-group roadmaps, personal formula notebooks, transcript/National/HSA score converters, and daily Honor Roll motivation.',
  },
  {
    icon: 'verified',
    titleVi: 'Huy hiệu Học viên VIP & Hỗ trợ ưu tiên',
    titleEn: 'VIP Scholar Badge & Priority Academic Support',
    descVi:
      'Tài khoản được gắn nhãn VIP Combo 2K9, ưu tiên cập nhật tài liệu mới và hỗ trợ trực tiếp trong suốt mùa thi.',
    descEn:
      'Receive the VIP Combo 2K9 scholar badge, early access to newly added materials, and priority support throughout the exam season.',
  },
];

const CURRICULUM_STAGES = [
  {
    phaseVi: 'Chặng 1 · Nền tảng & Chuyên đề trọng tâm',
    phaseEn: 'Stage 1 · Core Foundations & Anchor Topics',
    badgeVi: 'Lớp 12 · Học kỳ 1',
    badgeEn: 'Grade 12 · Semester 1',
    itemsVi: [
      'Nắm chắc toàn bộ kiến thức SGK mới chương trình GDPT 2018 các môn xét tuyển',
      'Hệ thống bài tập phân dạng từ cơ bản đến vận dụng theo từng chuyên đề',
      'Tài liệu tóm tắt công thức, sơ đồ tư duy & bộ câu hỏi Đúng/Sai chuẩn cấu trúc mới',
    ],
    itemsEn: [
      'Master every core chapter of the reformed 2018 curriculum across your admission subjects',
      'Practice graded problem sets progressing from fundamentals to advanced application',
      'Formula compendiums, mindmaps, and True/False & Short-Answer sets matching the new exam format',
    ],
  },
  {
    phaseVi: 'Chặng 2 · Tổng ôn & Luyện đề thực chiến',
    phaseEn: 'Stage 2 · Comprehensive Review & Mock Sprints',
    badgeVi: 'Học kỳ 2 · Tăng tốc',
    badgeEn: 'Semester 2 · Accelerate',
    itemsVi: [
      'Luyện bộ đề thi thử các trường Chuyên & Sở GD&ĐT trên cả nước',
      'Chiến thuật phân bổ thời gian, xử lý câu hỏi trả lời ngắn & chống sai ngu',
      'Ôn luyện song song kỳ thi Đánh giá năng lực (HSA / V-ACT) & Đánh giá tư duy (TSA)',
    ],
    itemsEn: [
      'Tackle full-length mock papers from specialized high schools and provincial departments',
      'Time-allocation tactics, short-answer precision drills, and careless-error prevention',
      'Parallel preparation for Competency Assessment (HSA / V-ACT) and Thinking Skills (TSA)',
    ],
  },
  {
    phaseVi: 'Chặng 3 · Về đích & Tối ưu nguyện vọng',
    phaseEn: 'Stage 3 · Final Sprint & Wishlist Optimization',
    badgeVi: 'Tháng 5 – Tháng 7/2027',
    badgeEn: 'May – July 2027',
    itemsVi: [
      'Bộ đề dự đoán & tủ sâu kiến thức trọng tâm sát ngày thi',
      'Phân tích phổ điểm, quy đổi điểm chuẩn và sắp xếp nguyện vọng đại học an toàn',
    ],
    itemsEn: [
      'High-yield final mock sets and targeted revision checklists before exam day',
      'Score distribution analysis, cutoff conversion, and strategic university wishlist ordering',
    ],
  },
];

export default function CourseComboHs12() {
  const { user, profile, refreshProfile } = useAuth();
  const { lang, isEn, t, pick } = useLanguage();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const course = getComboHs12Course(lang);
  const courseDisplayName = pick(
    'COMBO ĐTHT · HS12 (2K9) · Chinh phục Đại học',
    'DTHT COMBO · Grade 12 (2K9) · University Prep',
  );

  const [activeOrder, setActiveOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [paymentStatusNotice, setPaymentStatusNotice] = useState(null);
  const [userNote, setUserNote] = useState('');
  const [copiedField, setCopiedField] = useState('');

  const isEnrolled =
    Boolean(profile?.is_vip) || activeOrder?.status === 'paid';

  const transferContent =
    activeOrder?.transfer_code ||
    (user?.id ? `DTHT${user.id.slice(0, 5).toUpperCase()}` : 'DTHT2K9');

  const paymentCheckMessage = useMemo(() => {
    if (!paymentStatusNotice) return '';
    return t(paymentStatusNotice.key, paymentStatusNotice.params);
  }, [paymentStatusNotice, t]);

  const fetchLatestOrder = useCallback(async () => {
    if (!user) return;
    setLoadingOrder(true);
    try {
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
      const randSuffix = Math.random()
        .toString(36)
        .substring(2, 7)
        .toUpperCase();
      const transferCode = `DTHT${randSuffix}`;

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
      showToast(t('comboCoursePage.toasts.orderCreated'), 'success');
      setTimeout(() => {
        document
          .getElementById('payment-section')
          ?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      showToast(
        t('comboCoursePage.toasts.orderError', {
          reason: err.message || t('comboCoursePage.toasts.tryAgainLater'),
        }),
        'error',
      );
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleConfirmTransferred = () => {
    if (!activeOrder) return;
    setSubmittingProof(true);
    setPaymentStatusNotice({
      key: 'comboCoursePage.messages.confirmedTransfer',
      params: { code: transferContent },
    });
    showToast(t('comboCoursePage.toasts.transferNoted'), 'success');
    setSubmittingProof(false);
  };

  const handleAutoCheckPayment = useCallback(
    async (silent = false) => {
      if (!activeOrder || activeOrder.status === 'paid') return false;
      if (!silent) {
        setCheckingPayment(true);
        setPaymentStatusNotice(null);
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
          setPaymentStatusNotice({
            key: 'comboCoursePage.messages.paymentVerified',
          });
          return true;
        }

        if (!silent) {
          setPaymentStatusNotice({
            key: 'comboCoursePage.messages.pendingVerification',
            params: { code: data?.transfer_code || activeOrder.transfer_code },
          });
        }
        return false;
      } catch (err) {
        if (!silent) {
          console.error('Lỗi kiểm tra thanh toán:', err);
          setPaymentStatusNotice({
            key: 'comboCoursePage.messages.noBankUpdateYet',
          });
        }
        return false;
      } finally {
        if (!silent) setCheckingPayment(false);
      }
    },
    [activeOrder, refreshProfile],
  );

  const handleCopy = async (text, fieldKey, labelText) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldKey);
      showToast(
        t('comboCoursePage.toasts.copiedField', { label: labelText }),
        'info',
        1800,
      );
      setTimeout(() => setCopiedField(''), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

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

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <div className="mb-5">
            <Link
              to="/home"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-secondary-text hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                arrow_back
              </span>
              <span>{t('nav.home')}</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <RankSeal
                  size="sm"
                  icon="workspace_premium"
                  label={t('comboCoursePage.heroSeal')}
                />
                <span className="paper-chip bg-jade-soft text-jade border-jade-border font-bold">
                  {t('comboCoursePage.seasonChip')}
                </span>
                <span className="paper-chip">{course.audience}</span>
              </div>

              <h1 className="text-2xl sm:text-4xl lg:text-[2.55rem] font-display font-extrabold leading-tight tracking-tight text-foreground">
                {t('comboCoursePage.heroBrandTitle')}
                <span className="block mt-1 text-primary">
                  <span className="brush-underline">
                    {t('comboCoursePage.heroBrandHighlight')}
                  </span>
                </span>
              </h1>

              <p className="text-secondary-text text-sm sm:text-base leading-relaxed max-w-2xl">
                {course.summary}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                {course.metrics.map((metric) => (
                  <div
                    key={`${metric.value}-${metric.label}`}
                    className="p-3 rounded-xl bg-surface border border-border"
                  >
                    <div className="font-display text-base font-extrabold text-primary tabular">
                      {metric.value}
                    </div>
                    <div className="text-[11px] text-secondary-text font-medium mt-0.5">
                      {metric.label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link to="/hoc-online" className="btn-arena btn-arena-primary">
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">
                    cast_for_education
                  </span>
                  <span>{t('comboCoursePage.openOnlineBtn')}</span>
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
                        ? t('comboCoursePage.creatingCodeBtn')
                        : activeOrder
                          ? t('comboCoursePage.viewTransferInfoBtn')
                          : t('comboCoursePage.registerVipBtn')}
                    </span>
                  </button>
                )}

                <Link to="/library" className="btn-arena btn-arena-secondary">
                  <span
                    className="material-symbols-outlined text-lg text-accent"
                    aria-hidden="true"
                  >
                    folder_open
                  </span>
                  <span>{t('comboCoursePage.freeLibraryBtn')}</span>
                </Link>
              </div>
            </div>

            {/* Price Summary Card */}
            <div className="lg:col-span-5">
              <div className="imperial-frame p-6 sm:p-8 relative overflow-hidden">
                <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-secondary-text">
                    {t('comboCoursePage.tuitionEyebrow')}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-gold-soft text-gold-dark border border-gold">
                    {t('comboCoursePage.tuitionSeasonBadge')}
                  </span>
                </div>

                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-4xl sm:text-5xl font-display font-extrabold text-primary tabular">
                    {pick('50.000đ', '50,000 VND')}
                  </span>
                  <span className="text-sm text-muted-foreground line-through tabular">
                    {pick('299.000đ', '299,000 VND')}
                  </span>
                </div>
                <p className="text-xs text-secondary-text mb-5 leading-relaxed">
                  {t('comboCoursePage.tuitionNote')}
                </p>

                <div className="space-y-2.5 pt-4 border-t border-border text-xs text-foreground">
                  <div className="flex items-start gap-2.5">
                    <span
                      className="material-symbols-outlined text-jade text-base shrink-0 mt-0.5"
                      aria-hidden="true"
                    >
                      check_circle
                    </span>
                    <span>{t('comboCoursePage.tuitionPerk1')}</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span
                      className="material-symbols-outlined text-jade text-base shrink-0 mt-0.5"
                      aria-hidden="true"
                    >
                      check_circle
                    </span>
                    <span>{t('comboCoursePage.tuitionPerk2')}</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span
                      className="material-symbols-outlined text-jade text-base shrink-0 mt-0.5"
                      aria-hidden="true"
                    >
                      check_circle
                    </span>
                    <span>{t('comboCoursePage.tuitionPerk3')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-12">
        {/* 5-Tier Package Comparison Grid from getComboHs12Course(lang) */}
        <section className="space-y-6">
          <SectionHeading
            eyebrow={t('comboCoursePage.packagesEyebrow')}
            title={t('comboCoursePage.packagesTitle')}
            subtitle={course.packageIntro}
            hanzi="策"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {course.learningPackages.map((pkg, idx) => {
              const isFlagship = pkg.id === 'full-combo';
              return (
                <article
                  key={pkg.id}
                  className={`paper-card paper-card-interactive p-5 sm:p-6 flex flex-col justify-between gap-4 border ${
                    isFlagship
                      ? 'border-gold bg-gold-soft/20 md:col-span-2 lg:col-span-2'
                      : 'border-border hover:border-border-strong'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold border ${
                          isFlagship
                            ? 'bg-primary text-on-primary border-primary-hover'
                            : 'bg-surface-alt text-foreground border-border'
                        }`}
                      >
                        <span className="tabular">0{idx + 1}</span>
                        <span>· {pkg.label}</span>
                      </span>

                      <div className="w-10 h-10 rounded-xl bg-primary-soft border border-primary/30 text-primary flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-xl" aria-hidden="true">
                          {pkg.icon}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-display text-lg font-extrabold text-foreground">
                        {pkg.name}
                      </h3>
                      <p className="text-xs font-semibold text-primary mt-0.5">
                        {pkg.subtitle}
                      </p>
                    </div>

                    <p className="text-xs sm:text-sm text-secondary-text leading-relaxed">
                      {pkg.goal}
                    </p>

                    <div className="p-3 rounded-xl bg-paper border border-border text-xs space-y-1.5">
                      <p className="text-secondary-text leading-relaxed">
                        <strong className="text-foreground">
                          {t('comboCoursePage.bestForLabel')}
                        </strong>{' '}
                        {pkg.bestFor}
                      </p>
                      <p className="text-secondary-text leading-relaxed">
                        <strong className="text-jade">
                          {t('comboCoursePage.nextStepLabel')}
                        </strong>{' '}
                        {pkg.action}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border">
                    {pkg.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-surface-alt text-secondary-text border border-border"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Core VIP Scholar Benefits */}
        <section className="space-y-6">
          <SectionHeading
            eyebrow={t('comboCoursePage.benefitsEyebrow')}
            title={t('comboCoursePage.benefitsTitle')}
            subtitle={t('comboCoursePage.benefitsSubtitle')}
            hanzi="利"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {VIP_HIGHLIGHTS.map((item) => (
              <div
                key={item.icon}
                className="paper-card paper-card-interactive p-5 flex items-start gap-4 border border-border hover:border-border-strong"
              >
                <div className="w-12 h-12 rounded-xl bg-primary-soft border border-primary/30 text-primary flex items-center justify-center no-shrink">
                  <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                    {item.icon}
                  </span>
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-foreground mb-1">
                    {pick(item.titleVi, item.titleEn)}
                  </h3>
                  <p className="text-xs sm:text-sm text-secondary-text leading-relaxed">
                    {pick(item.descVi, item.descEn)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3-Stage Curriculum */}
        <section className="space-y-6">
          <SectionHeading
            eyebrow={t('comboCoursePage.curriculumEyebrow')}
            title={t('comboCoursePage.curriculumTitle')}
            subtitle={t('comboCoursePage.curriculumSubtitle')}
            hanzi="程"
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {CURRICULUM_STAGES.map((stage, idx) => {
              const items = isEn ? stage.itemsEn : stage.itemsVi;
              return (
                <div
                  key={stage.phaseVi}
                  className="paper-card p-5 sm:p-6 flex flex-col justify-between border border-border hover:border-border-strong transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="w-8 h-8 rounded-lg bg-primary text-on-primary font-display font-bold text-xs flex items-center justify-center tabular">
                        0{idx + 1}
                      </span>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gold-soft text-gold-dark border border-gold">
                        {pick(stage.badgeVi, stage.badgeEn)}
                      </span>
                    </div>
                    <h3 className="font-display font-bold text-base text-foreground mb-3">
                      {pick(stage.phaseVi, stage.phaseEn)}
                    </h3>
                    <ul className="space-y-2.5">
                      {items.map((point) => (
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
              );
            })}
          </div>
        </section>

        {/* VietQR Bank Transfer & Order Status Section */}
        <section id="payment-section" className="scroll-mt-20">
          <div className="imperial-frame overflow-hidden p-6 sm:p-8 space-y-6">
            <div className="pb-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  {t('comboCoursePage.paymentEyebrow')}
                </span>
                <h2 className="text-xl sm:text-2xl font-display font-extrabold text-foreground mt-1">
                  {t('comboCoursePage.paymentTitle')}
                </h2>
                <p className="text-xs sm:text-sm text-secondary-text mt-1">
                  {t('comboCoursePage.paymentSubtitle')}
                </p>
              </div>

              {activeOrder && (
                <StatusBadge
                  status={activeOrder.status}
                  isEnrolled={isEnrolled}
                  t={t}
                />
              )}
            </div>

            <div>
              {!user ? (
                <div className="text-center py-8 px-4 rounded-2xl bg-paper border border-border max-w-md mx-auto space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary-soft border border-primary/30 text-primary flex items-center justify-center mx-auto">
                    <span className="material-symbols-outlined text-3xl" aria-hidden="true">
                      lock
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-lg text-foreground">
                    {t('comboCoursePage.loginRequiredTitle')}
                  </h3>
                  <p className="text-xs sm:text-sm text-secondary-text leading-relaxed">
                    {t('comboCoursePage.loginRequiredDesc')}
                  </p>
                  <Link to="/auth" className="btn-arena btn-arena-primary">
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">
                      login
                    </span>
                    <span>{t('comboCoursePage.loginRegisterBtn')}</span>
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
                      <span
                        className="material-symbols-outlined text-2xl icon-fill"
                        aria-hidden="true"
                      >
                        verified
                      </span>
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-base sm:text-lg text-foreground">
                        {t('comboCoursePage.activatedTitle', {
                          courseName: courseDisplayName,
                        })}
                      </h3>
                      <p className="text-xs sm:text-sm text-secondary-text mt-1">
                        {t('comboCoursePage.orderCodeLabel')}{' '}
                        <span className="font-mono font-bold text-foreground">
                          {activeOrder?.transfer_code || 'VIP-2K9'}
                        </span>{' '}
                        · {t('comboCoursePage.activatedWish')}
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/hoc-online"
                    className="btn-arena btn-arena-jade no-shrink"
                  >
                    <span>{t('comboCoursePage.startLearningBtn')}</span>
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      arrow_forward
                    </span>
                  </Link>
                </div>
              ) : !activeOrder ? (
                <div className="text-center py-8 px-5 rounded-2xl bg-paper border border-border max-w-lg mx-auto space-y-4">
                  <p className="text-sm text-secondary-text leading-relaxed">
                    {t('comboCoursePage.generateQrLead')}
                    <strong className="text-foreground">
                      {t('comboCoursePage.generateQrStrong')}
                    </strong>
                    {t('comboCoursePage.generateQrMid')}
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
                    <span>
                      {creatingOrder
                        ? t('comboCoursePage.generatingQrBtn')
                        : t('comboCoursePage.generateQrBtn')}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  {/* QR Code Box */}
                  <div className="lg:col-span-5 flex flex-col items-center p-5 rounded-2xl bg-paper border border-border">
                    <div className="bg-surface p-3 rounded-2xl shadow-xs border border-border mb-3">
                      <img
                        src={qrUrl}
                        alt={t('comboCoursePage.qrImgAlt')}
                        className="w-60 h-60 sm:w-64 sm:h-64 object-contain"
                      />
                    </div>
                    <p className="text-xs font-bold text-foreground text-center">
                      {t('comboCoursePage.qrScanGuide')}
                    </p>
                    <p className="text-[11px] text-secondary-text text-center mt-1 leading-relaxed">
                      {t('comboCoursePage.qrAutoFillHint', {
                        code: transferContent,
                      })}
                    </p>
                  </div>

                  {/* Bank details & Confirm */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <InfoField
                        label={t('comboCoursePage.bankNameLabel')}
                        value={pick(
                          BANK_INFO.bankFullNameVi,
                          BANK_INFO.bankFullNameEn,
                        )}
                        t={t}
                      />
                      <InfoField
                        label={t('comboCoursePage.accountHolderLabel')}
                        value={BANK_INFO.accountName}
                        t={t}
                      />
                      <InfoField
                        label={t('comboCoursePage.accountNumberLabel')}
                        value={BANK_INFO.accountNo}
                        copyable
                        copied={copiedField === 'accountNo'}
                        onCopy={() =>
                          handleCopy(
                            BANK_INFO.accountNo,
                            'accountNo',
                            t('comboCoursePage.toasts.fieldAccountNo'),
                          )
                        }
                        t={t}
                      />
                      <InfoField
                        label={t('comboCoursePage.amountLabel')}
                        value={pick('50.000 VNĐ', '50,000 VND')}
                        highlight
                        copyable
                        copied={copiedField === 'amount'}
                        onCopy={() =>
                          handleCopy(
                            String(COURSE_PRICE),
                            'amount',
                            t('comboCoursePage.toasts.fieldAmount'),
                          )
                        }
                        t={t}
                      />
                    </div>

                    <div className="p-4 rounded-xl bg-primary-soft border border-primary/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider font-bold text-primary">
                          {t('comboCoursePage.mandatoryMemoLabel')}
                        </p>
                        <p className="text-xl font-mono font-extrabold text-foreground tracking-wider mt-0.5">
                          {transferContent}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            transferContent,
                            'memo',
                            t('comboCoursePage.toasts.fieldMemo'),
                          )
                        }
                        className="btn-arena btn-arena-primary btn-arena-sm no-shrink"
                      >
                        <span className="material-symbols-outlined text-sm" aria-hidden="true">
                          {copiedField === 'memo' ? 'check' : 'content_copy'}
                        </span>
                        <span>
                          {copiedField === 'memo'
                            ? t('comboCoursePage.copiedBtn')
                            : t('comboCoursePage.copyMemoBtn')}
                        </span>
                      </button>
                    </div>

                    {/* Step Confirmation */}
                    <div className="p-5 rounded-2xl bg-paper border border-border space-y-4">
                      <div>
                        <label
                          htmlFor="transfer-user-note"
                          className="block text-xs font-bold text-foreground mb-1.5"
                        >
                          {t('comboCoursePage.noteLabel')}
                        </label>
                        <input
                          id="transfer-user-note"
                          type="text"
                          value={userNote}
                          onChange={(e) => setUserNote(e.target.value)}
                          placeholder={t('comboCoursePage.notePlaceholder')}
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
                            {t('comboCoursePage.orderCodeLabel')}{' '}
                            <strong className="text-foreground font-mono">
                              {transferContent}
                            </strong>
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
                            <span>
                              {checkingPayment
                                ? t('comboCoursePage.checkingBtn')
                                : t('comboCoursePage.checkStatusBtn')}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={handleConfirmTransferred}
                            disabled={submittingProof}
                            className="btn-arena btn-arena-primary btn-arena-sm"
                          >
                            <span
                              className="material-symbols-outlined text-lg"
                              aria-hidden="true"
                            >
                              check_circle
                            </span>
                            <span>{t('comboCoursePage.confirmTransferredBtn')}</span>
                          </button>
                        </div>
                      </div>

                      {paymentCheckMessage && (
                        <div className="p-3 rounded-xl bg-primary-soft border border-primary/30 text-xs text-foreground leading-relaxed">
                          {paymentCheckMessage}
                        </div>
                      )}

                      <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border text-xs text-secondary-text">
                        <span>{t('comboCoursePage.hasGooglePrompt')}</span>
                        <Link
                          to="/hoc-online"
                          className="text-primary font-bold hover:underline flex items-center gap-1"
                        >
                          <span>{t('comboCoursePage.goDirectOnlineLink')}</span>
                          <span
                            className="material-symbols-outlined text-sm"
                            aria-hidden="true"
                          >
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

function InfoField({ label, value, copyable, copied, onCopy, highlight, t }) {
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
          <span>
            {copied
              ? t('comboCoursePage.copiedShort')
              : t('comboCoursePage.copyShort')}
          </span>
        </button>
      )}
    </div>
  );
}

function StatusBadge({ status, isEnrolled, t }) {
  if (isEnrolled || status === 'paid' || status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-completed-soft text-completed border border-completed-border">
        <span className="material-symbols-outlined text-base" aria-hidden="true">
          verified
        </span>
        <span>{t('comboCoursePage.statusActivated')}</span>
      </span>
    );
  }
  if (status === 'expired') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-primary-soft text-primary border border-primary/35">
        <span className="material-symbols-outlined text-base" aria-hidden="true">
          history
        </span>
        <span>{t('comboCoursePage.statusExpired')}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-gold-soft text-gold-dark border border-gold">
      <span className="material-symbols-outlined text-base" aria-hidden="true">
        schedule
      </span>
      <span>{t('comboCoursePage.statusPending')}</span>
    </span>
  );
}
