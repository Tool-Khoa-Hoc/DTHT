import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getUserRank, RANK_TIERS } from '../utils/rankHelper';
import { getLevelFromExp, EXP_PER_MINUTE, getLevelAccent, formatStudyTime } from '../utils/levelHelper';
import { preloadRouteModule } from '../lib/routeModules';
import { getDocumentKindMeta } from '../lib/documents';
import { sanitizeExternalUrl } from '../utils/urlSecurity';
import Avatar from '../components/Avatar';
import WelcomeModal from '../components/WelcomeModal';
import SectionHeading from '../components/ui/SectionHeading';
import RankSeal from '../components/ui/RankSeal';
import ProgressBar from '../components/ui/ProgressBar';

const ARENA_GATES = [
  {
    to: '/library',
    preloadKey: 'Library',
    icon: 'menu_book',
    tag: 'KHO ĐỀ · PDF',
    hanzi: '書',
    title: 'Thư viện tài liệu',
    desc: 'Hơn 10.000 đề thi thử, chuyên đề và sơ đồ tư duy chọn lọc từ các trường chuyên toàn quốc.',
    cta: 'Vào kho đề',
    tone: 'primary',
  },
  {
    to: '/hoc-online',
    preloadKey: 'OnlineLearning',
    icon: 'cast_for_education',
    tag: '47 GIÁO VIÊN · SHEET',
    hanzi: '師',
    title: 'Học online',
    desc: 'Kho sheet bài giảng theo từng môn và giáo viên — mở nhanh, theo dõi tiến độ từng buổi.',
    cta: 'Mở kho sheet',
    tone: 'gold',
  },
  {
    to: '/roadmap',
    preloadKey: 'Roadmap',
    icon: 'route',
    tag: 'CHIẾN LƯỢC · 2K9',
    hanzi: '道',
    title: 'Lộ trình ôn thi',
    desc: 'Từng chặng từ nền tảng đến tổng ôn — phân bổ mục tiêu theo tuần và theo khối xét tuyển.',
    cta: 'Xem lộ trình',
    tone: 'jade',
  },
  {
    to: '/arena',
    preloadKey: 'StudyArena',
    icon: 'local_fire_department',
    tag: 'BẢNG VÀNG · QUÂN HÀM',
    hanzi: '榜',
    title: 'Đấu trường',
    desc: 'Tích luỹ EXP từ thời gian học thực tế, leo bậc quân hàm mỗi ngày cùng bạn bè.',
    cta: 'Vào đấu trường',
    tone: 'primary',
  },
];

const QUICK_TOOLS = [
  {
    to: '/gpa',
    preloadKey: 'GPACalculator',
    icon: 'calculate',
    title: 'Tính GPA',
    desc: 'Điểm trung bình học kỳ & mục tiêu học bạ',
    badge: 'bg-jade-soft text-jade border-jade-border',
  },
  {
    to: '/schools',
    preloadKey: 'SchoolFinder',
    icon: 'school',
    title: 'Tìm trường',
    desc: 'Gợi ý đại học theo điểm và khối thi',
    badge: 'bg-gold-soft text-gold-dark border-gold',
  },
  {
    to: '/admission',
    preloadKey: 'AdmissionCalculator',
    icon: 'trending_up',
    title: 'Điểm xét tuyển',
    desc: 'Quy đổi học bạ, ĐGNL và điểm thi THPT',
    badge: 'bg-primary-soft text-primary border-primary/30',
  },
  {
    to: '/notes',
    preloadKey: 'Notes',
    icon: 'edit_note',
    title: 'Ghi chú',
    desc: 'Sổ tay công thức & lỗi sai cần nhớ',
    badge: 'bg-surface-alt text-foreground border-border-strong',
  },
];

const GATE_TONE_CLASSES = {
  primary: {
    iconWrap: 'bg-primary-soft text-primary border-primary/30',
    tag: 'text-primary bg-primary-soft border-primary/25',
    hoverBorder: 'hover:border-primary/45',
  },
  gold: {
    iconWrap: 'bg-gold-soft text-gold-dark border-gold',
    tag: 'text-gold-dark bg-gold-soft border-gold',
    hoverBorder: 'hover:border-gold',
  },
  jade: {
    iconWrap: 'bg-jade-soft text-jade border-jade-border',
    tag: 'text-jade bg-jade-soft border-jade-border',
    hoverBorder: 'hover:border-jade/50',
  },
};

export default function Home() {
  const { user, profile, signInWithGoogle } = useAuth();
  const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false);
  const studyMinutes = profile?.total_study_minutes || 0;
  const studySeconds = Number(profile?.study_seconds) || studyMinutes * 60;
  const studyHours = (studySeconds / 3600).toFixed(1);

  // Compute Level & EXP (ưu tiên lấy profile?.exp trực tiếp từ DB vì đã gồm điểm thưởng chuỗi ngày học)
  const totalExp =
    typeof profile?.exp === 'number'
      ? profile.exp
      : Math.round((studySeconds / 60) * EXP_PER_MINUTE);
  const levelInfo = getLevelFromExp(totalExp);
  const levelAccent = getLevelAccent(levelInfo.level);
  const userRank = getUserRank(
    totalExp,
    profile?.role,
    profile?.is_approved_bang_chu || profile?.is_thong_soai,
    user?.id,
  );

  // Live Supabase highlights
  const [featuredDocs, setFeaturedDocs] = useState([]);
  const [topScholars, setTopScholars] = useState([]);
  const [loadingHighlights, setLoadingHighlights] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadHighlights() {
      setLoadingHighlights(true);
      try {
        // 1. Featured / Latest 4 documents
        const { data: docData } = await supabase
          .from('documents')
          .select('id, title, category, description, file_url, is_featured, created_at, author_name, education_level')
          .eq('is_public', true)
          .order('is_featured', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(4);

        if (isMounted && docData) {
          setFeaturedDocs(docData);
        }

        // 2. Sĩ tử tiêu biểu hôm nay (Phương án A: ưu tiên số phút học trong ngày + tự động lấp đầy đầu ngày)
        try {
          const { data: dailyData, error: rpcErr } = await supabase.rpc(
            'get_daily_top_scholars',
            { p_limit: 5, p_fallback: true },
          );

          if (!rpcErr && Array.isArray(dailyData) && dailyData.length > 0) {
            if (isMounted) setTopScholars(dailyData);
          } else {
            throw rpcErr || new Error('Empty daily RPC response');
          }
        } catch {
          // Fallback 1: truy vấn public_profile_view (có today_seconds hoặc exp/study_seconds)
          let viewRes = await supabase
            .from('public_profile_view')
            .select(
              'id, display_name, avatar_url, role, university, user_mode, target_gpa, target_thpt, is_approved_bang_chu, exp, study_seconds, study_streak, today_seconds, today_minutes, today_exp',
            )
            .order('today_seconds', { ascending: false, nullsFirst: false })
            .order('exp', { ascending: false, nullsFirst: false })
            .limit(5);

          if (viewRes.error) {
            viewRes = await supabase
              .from('public_profile_view')
              .select(
                'id, display_name, avatar_url, role, university, user_mode, target_gpa, target_thpt, is_approved_bang_chu, exp, study_seconds, study_streak',
              )
              .order('exp', { ascending: false, nullsFirst: false })
              .order('study_seconds', { ascending: false, nullsFirst: false })
              .limit(5);
          }

          if (viewRes.error) {
            viewRes = await supabase
              .from('public_profile_view')
              .select(
                'id, display_name, avatar_url, role, university, user_mode, target_gpa, target_thpt, is_approved_bang_chu',
              )
              .order('is_approved_bang_chu', { ascending: false })
              .limit(5);
          }

          if (isMounted && viewRes.data) {
            setTopScholars(viewRes.data);
          }
        }
      } catch (err) {
        console.error('Lỗi tải highlights trang chủ:', err);
      } finally {
        if (isMounted) setLoadingHighlights(false);
      }
    }

    loadHighlights();
    return () => {
      isMounted = false;
    };
  }, []);

  const displayName = profile?.display_name || profile?.full_name || (user?.email ? user.email.split('@')[0] : 'Chiến binh');

  return (
    <div className="min-h-full bg-background text-foreground font-sans selection:bg-primary/15 selection:text-primary">
      <WelcomeModal />

      {/* ═══════════════ 1. HERO — KHOA TRƯỜNG SÁNG ═══════════════ */}
      <section className="relative overflow-hidden border-b border-border bg-paper">
        <span
          aria-hidden="true"
          className="hanzi-watermark hidden lg:block absolute top-8 right-10 text-[140px] font-bold text-accent/8"
        >
          狀元
        </span>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-10 md:pt-12 md:pb-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-8 items-stretch">
            {/* Left column — Call to arms */}
            <div className="lg:col-span-7 flex flex-col justify-between">
              <div>
                <div className="mb-5">
                  <RankSeal
                    icon="local_fire_department"
                    label="Học tập & Chinh phục · Mùa thi 2027"
                  />
                </div>

                <h1 className="font-display text-3xl sm:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight leading-[1.1] text-foreground mb-4">
                  Rèn mỗi ngày.
                  <span className="block mt-1 text-primary">
                    <span className="brush-underline">Chinh phục kỳ thi.</span>
                  </span>
                </h1>

                <p className="text-secondary-text text-sm sm:text-base leading-relaxed max-w-xl mb-7">
                  Không gian học tập tập trung cho học sinh THPT: kho đề thi chọn lọc,
                  lộ trình rõ ràng, công cụ tính điểm chuẩn xác và bảng xếp hạng thi đua mỗi ngày.
                </p>

                <div className="flex flex-wrap items-center gap-3 mb-8">
                  <Link
                    to="/library"
                    onMouseEnter={() => preloadRouteModule('Library')}
                    onFocus={() => preloadRouteModule('Library')}
                    className="btn-arena btn-arena-primary"
                  >
                    <span className="material-symbols-outlined text-xl" aria-hidden="true">
                      menu_book
                    </span>
                    <span>Mở thư viện</span>
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">
                      arrow_forward
                    </span>
                  </Link>

                  <Link
                    to="/hoc-online"
                    onMouseEnter={() => preloadRouteModule('OnlineLearning')}
                    onFocus={() => preloadRouteModule('OnlineLearning')}
                    className="btn-arena btn-arena-gold"
                  >
                    <span className="material-symbols-outlined text-xl" aria-hidden="true">
                      cast_for_education
                    </span>
                    <span>Kho Học Online</span>
                  </Link>

                  <Link
                    to="/roadmap"
                    onMouseEnter={() => preloadRouteModule('Roadmap')}
                    onFocus={() => preloadRouteModule('Roadmap')}
                    className="btn-arena btn-arena-secondary"
                  >
                    <span className="material-symbols-outlined text-xl text-accent" aria-hidden="true">
                      route
                    </span>
                    <span>Xem lộ trình</span>
                  </Link>
                </div>
              </div>

              {/* Rank ladder strip */}
              <div className="paper-card p-4 bg-surface/90">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-secondary-text flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-accent" aria-hidden="true">
                      military_tech
                    </span>
                    Con đường thăng hạng
                  </span>
                  <Link
                    to="/arena"
                    onMouseEnter={() => preloadRouteModule('StudyArena')}
                    onFocus={() => preloadRouteModule('StudyArena')}
                    className="text-xs font-bold text-primary hover:text-primary-hover flex items-center gap-0.5"
                  >
                    Bảng xếp hạng
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      chevron_right
                    </span>
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {RANK_TIERS.map((tier) => {
                    const isCurrent = user && userRank.name === tier.name;
                    return (
                      <div
                        key={tier.name}
                        className={`flex flex-col items-center justify-center px-2 py-2 rounded-xl border text-center transition-all ${
                          isCurrent
                            ? 'bg-primary-soft border-primary ring-1 ring-primary/30 shadow-xs'
                            : 'bg-paper border-border'
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-lg mb-0.5 ${tier.color}`}
                          aria-hidden="true"
                        >
                          {tier.icon}
                        </span>
                        <span
                          className={`text-[11px] font-bold truncate w-full ${
                            isCurrent ? 'text-primary' : 'text-foreground'
                          }`}
                        >
                          {tier.name}
                        </span>
                        <span className="text-[9px] text-secondary-text tabular mt-0.5">
                          {tier.exclusiveBangChu
                            ? 'Độc tôn'
                            : `${tier.min.toLocaleString('vi-VN')} EXP`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right column — Warrior status / Guest invitation */}
            <div className="lg:col-span-5 flex">
              {user ? (
                <div className="w-full imperial-frame p-6 flex flex-col justify-between relative overflow-hidden">
                  <span
                    aria-hidden="true"
                    className="hanzi-watermark absolute -bottom-4 -right-2 text-8xl font-bold text-primary/6"
                  >
                    印
                  </span>

                  <div>
                    <div className="flex items-center justify-between gap-3 mb-5">
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-jade animate-pulse" aria-hidden="true" />
                        Hồ sơ chiến binh
                      </span>
                      <Link
                        to="/profile"
                        onMouseEnter={() => preloadRouteModule('Profile')}
                        onFocus={() => preloadRouteModule('Profile')}
                        className="text-xs font-bold text-secondary-text hover:text-primary flex items-center gap-1"
                      >
                        Chi tiết
                        <span className="material-symbols-outlined text-sm" aria-hidden="true">
                          open_in_new
                        </span>
                      </Link>
                    </div>

                    <div className="flex items-center gap-4 mb-6">
                      <div className="relative">
                        <Avatar
                          src={profile?.avatar_url}
                          name={displayName}
                          className="w-16 h-16 ring-2 ring-gold/60"
                          textSize="text-xl"
                        />
                        <div
                          className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-lg ${userRank.bg} ${userRank.border} border flex items-center justify-center shadow-xs`}
                        >
                          <span
                            className={`material-symbols-outlined text-base ${userRank.color}`}
                            aria-hidden="true"
                          >
                            {userRank.icon}
                          </span>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="font-display text-lg font-extrabold text-foreground truncate">
                          Chào {displayName}!
                        </h2>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-soft text-primary border border-primary/30">
                            <span className="material-symbols-outlined text-sm icon-fill" aria-hidden="true">
                              {userRank.icon}
                            </span>
                            <span>{userRank.name}</span>
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${levelAccent.badge}`}>
                            Cấp {levelInfo.level} · {levelInfo.exp} EXP
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress to next level */}
                    <div className="p-4 rounded-xl bg-paper border border-border mb-4">
                      <ProgressBar
                        value={levelInfo.progressPct}
                        max={100}
                        tone="primary"
                        label={`Công lực Cấp ${levelInfo.level} → Cấp ${levelInfo.level + 1}`}
                        sublabel={`${levelInfo.expIntoLevel}/${levelInfo.expForThisLevel} EXP`}
                      />
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="p-3 rounded-xl bg-paper border border-border text-center">
                        <div className="font-display text-lg font-extrabold text-foreground tabular">
                          {studyHours}h
                        </div>
                        <div className="text-[11px] text-secondary-text font-medium">Giờ tích luỹ</div>
                      </div>
                      <div className="p-3 rounded-xl bg-paper border border-border text-center">
                        <div className="font-display text-lg font-extrabold text-accent tabular">
                          {profile?.target_thpt ? `${profile.target_thpt}đ` : '27.0đ'}
                        </div>
                        <div className="text-[11px] text-secondary-text font-medium">Mục tiêu THPT</div>
                      </div>
                      <div className="p-3 rounded-xl bg-paper border border-border text-center">
                        <div className="font-display text-lg font-extrabold text-jade tabular">
                          {profile?.target_gpa ? profile.target_gpa : '8.5+'}
                        </div>
                        <div className="text-[11px] text-secondary-text font-medium">Mục tiêu GPA</div>
                      </div>
                    </div>
                  </div>

                  <Link
                    to="/arena"
                    onMouseEnter={() => preloadRouteModule('StudyArena')}
                    onFocus={() => preloadRouteModule('StudyArena')}
                    className="mt-5 w-full flex items-center justify-between px-4 py-3 rounded-xl bg-primary-soft hover:bg-primary/15 border border-primary/30 text-sm font-bold text-primary transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg" aria-hidden="true">
                        local_fire_department
                      </span>
                      Vào đấu trường tích điểm hôm nay
                    </span>
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      arrow_forward
                    </span>
                  </Link>
                </div>
              ) : (
                <div className="w-full imperial-frame p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden">
                  <span
                    aria-hidden="true"
                    className="hanzi-watermark absolute -bottom-4 -right-2 text-8xl font-bold text-primary/6"
                  >
                    登科
                  </span>

                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-soft border border-gold text-gold-dark text-xs font-bold mb-5">
                      <span className="material-symbols-outlined text-sm icon-fill" aria-hidden="true">
                        emoji_events
                      </span>
                      Bảng Phong Thần Cá Nhân
                    </div>

                    <h2 className="font-display text-2xl font-extrabold text-foreground mb-2 leading-snug">
                      Ghi danh để lưu giờ học &amp; thăng hạng chiến binh
                    </h2>
                    <p className="text-sm text-secondary-text leading-relaxed mb-6">
                      Tự động đếm thời gian ôn luyện khi bạn đọc đề, học online hoặc làm bài.
                      EXP tích lũy càng cao thì mức hạng Quân hàm càng cao!
                    </p>

                    <div className="space-y-2.5 mb-6">
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-paper border border-border">
                        <span
                          className="material-symbols-outlined text-primary text-xl"
                          aria-hidden="true"
                        >
                          verified
                        </span>
                        <span className="text-xs sm:text-sm text-foreground font-medium">
                          Mở toàn bộ kho tài liệu &amp; 47 sheet giáo viên
                        </span>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-paper border border-border">
                        <span
                          className="material-symbols-outlined text-accent text-xl"
                          aria-hidden="true"
                        >
                          military_tech
                        </span>
                        <span className="text-xs sm:text-sm text-foreground font-medium">
                          Theo dõi mục tiêu GPA, điểm chuẩn &amp; bảng xếp hạng tuần
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <button
                      type="button"
                      disabled={isGoogleRedirecting}
                      onClick={async () => {
                        setIsGoogleRedirecting(true);
                        try {
                          const { error } = await signInWithGoogle('/home');
                          if (error) setIsGoogleRedirecting(false);
                        } catch {
                          setIsGoogleRedirecting(false);
                        }
                      }}
                      className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-surface hover:bg-surface-alt border-2 border-border-strong hover:border-gold text-foreground font-bold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-60 shadow-xs"
                    >
                      <svg className="h-4 w-4 no-shrink" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                      <span>
                        {isGoogleRedirecting
                          ? 'Đang chuyển tới Google...'
                          : 'Tiếp tục nhanh với Google'}
                      </span>
                    </button>

                    <Link
                      to="/auth"
                      className="btn-arena btn-arena-primary w-full"
                    >
                      <span className="material-symbols-outlined text-lg" aria-hidden="true">
                        login
                      </span>
                      <span>Đăng nhập / Tạo tài khoản bằng Email</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ LIVE HIGHLIGHTS: TÀI LIỆU & BẢNG VÀNG SĨ TỬ ═══════════════ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Featured Documents (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  Tài nguyên tuyển chọn
                </span>
                <h2 className="font-display text-xl sm:text-2xl font-extrabold text-foreground">
                  Học liệu nổi bật &amp; mới nhất
                </h2>
              </div>
              <Link
                to="/library"
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <span>Xem tất cả</span>
                <span className="material-symbols-outlined text-sm" aria-hidden="true">
                  arrow_forward
                </span>
              </Link>
            </div>

            {loadingHighlights ? (
              <div className="py-12 flex justify-center">
                <span className="material-symbols-outlined animate-spin text-2xl text-primary" aria-hidden="true">
                  sync
                </span>
              </div>
            ) : featuredDocs.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {featuredDocs.map((doc) => {
                  const kind = getDocumentKindMeta(doc.title, doc.file_url);
                  const safeUrl = sanitizeExternalUrl(doc.file_url);

                  return (
                    <div
                      key={doc.id}
                      className="paper-card paper-card-interactive p-4 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${kind.badgeClass}`}>
                            {kind.label}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-alt text-secondary-text border border-border uppercase">
                            {doc.education_level || 'THPT'}
                          </span>
                          {doc.is_featured && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gold-soft text-gold-dark border border-gold">
                              Nổi bật
                            </span>
                          )}
                        </div>
                        <h3 className="font-display font-bold text-sm text-foreground line-clamp-2 mb-1">
                          {doc.title}
                        </h3>
                        <p className="text-xs text-secondary-text line-clamp-2">
                          {doc.description || 'Chuyên đề và tài liệu trọng tâm cho kỳ thi.'}
                        </p>
                      </div>

                      <div className="pt-3 mt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="truncate max-w-[120px]">{doc.author_name || 'Khuyết danh'}</span>
                        {safeUrl ? (
                          <a
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-primary hover:underline flex items-center gap-0.5"
                          >
                            <span>Mở học</span>
                            <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                              open_in_new
                            </span>
                          </a>
                        ) : (
                          <Link to="/library" className="font-bold text-primary hover:underline">
                            Xem chi tiết
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-secondary-text paper-card">
                Chưa có tài liệu nổi bật nào được đăng tải.
              </div>
            )}
          </div>

          {/* Top Scholars / Daily Study Minutes Leaderboard (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
                    Phong Thần Bảng
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-gold-soft text-gold-dark border border-gold">
                    <span
                      className="material-symbols-outlined text-[12px] text-primary"
                      aria-hidden="true"
                    >
                      local_fire_department
                    </span>
                    Top Phút Học Ngày
                  </span>
                </div>
                <h2 className="font-display text-xl sm:text-2xl font-extrabold text-foreground">
                  Sĩ tử tiêu biểu
                </h2>
              </div>
              <Link
                to="/arena"
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1 shrink-0"
              >
                <span>Bảng đấu trường</span>
                <span className="material-symbols-outlined text-sm" aria-hidden="true">
                  arrow_forward
                </span>
              </Link>
            </div>

            <div className="paper-card divide-y divide-border overflow-hidden">
              {topScholars.map((scholar, idx) => {
                const todaySec = Number(scholar.today_seconds) || 0;
                const todayMin =
                  Number(scholar.today_minutes) || Math.floor(Math.max(0, todaySec) / 60);
                const totalSec = Number(scholar.study_seconds) || 0;
                const totalExpVal = Number(scholar.exp) || 0;
                const sLv = getLevelFromExp(totalExpVal);
                const sRank = getUserRank(
                  totalExpVal,
                  scholar.role,
                  scholar.is_approved_bang_chu,
                  scholar.id,
                );
                const hasTodayStudy = Boolean(scholar.is_today) || todayMin > 0;

                return (
                  <Link
                    to={scholar.id ? `/profile/${scholar.id}` : '/arena'}
                    key={scholar.id || idx}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-surface-alt transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-6 text-center font-display font-extrabold text-sm shrink-0 tabular ${
                          idx === 0
                            ? 'text-primary'
                            : idx === 1
                              ? 'text-accent'
                              : idx === 2
                                ? 'text-gold-dark'
                                : 'text-muted-foreground'
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <Avatar
                        src={scholar.avatar_url}
                        name={scholar.display_name || 'Sĩ tử'}
                        className="w-9 h-9 border border-border shrink-0"
                        textSize="text-xs"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-display font-bold text-xs sm:text-sm text-foreground truncate">
                            {scholar.display_name || 'Sĩ tử giấu tên'}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${sRank.bg} ${sRank.color} ${sRank.border}`}
                          >
                            {sRank.name}
                          </span>
                          {totalExpVal > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-surface-alt text-secondary-text border border-border tabular">
                              Lv.{sLv.level}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {scholar.university || 'Sĩ tử THPTQG 2027'}
                          {scholar.study_streak > 0 ? ` · 🔥${scholar.study_streak} ngày` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="text-right no-shrink">
                      {hasTodayStudy ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-extrabold bg-jade-soft text-jade border border-jade-border tabular">
                            <span
                              className="material-symbols-outlined text-[13px]"
                              aria-hidden="true"
                            >
                              schedule
                            </span>
                            {todayMin >= 60
                              ? formatStudyTime(todaySec || todayMin * 60)
                              : `${todayMin} phút`}
                          </span>
                          <p className="text-[10px] text-secondary-text font-semibold mt-0.5 tabular">
                            Hôm nay
                            {Number(scholar.today_exp) > 0
                              ? ` · +${Number(scholar.today_exp).toLocaleString('vi-VN')} EXP`
                              : ''}
                          </p>
                        </div>
                      ) : totalSec >= 60 ? (
                        <div>
                          <span className="text-xs font-bold text-foreground tabular block">
                            {formatStudyTime(totalSec)}
                          </span>
                          <span className="text-[10px] text-muted-foreground tabular">
                            Tích luỹ · {totalExpVal.toLocaleString('vi-VN')} EXP
                          </span>
                        </div>
                      ) : totalExpVal > 0 ? (
                        <div>
                          <span className="text-xs font-bold text-accent tabular block">
                            {totalExpVal.toLocaleString('vi-VN')} EXP
                          </span>
                          <span className="text-[10px] text-muted-foreground">Công lực</span>
                        </div>
                      ) : scholar.target_thpt ? (
                        <span className="text-xs font-bold text-accent tabular">
                          {scholar.target_thpt}đ
                        </span>
                      ) : scholar.target_gpa ? (
                        <span className="text-xs font-bold text-jade tabular">
                          GPA {scholar.target_gpa}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Tích cực</span>
                      )}
                    </div>
                  </Link>
                );
              })}

              {topScholars.length === 0 && (
                <div className="p-6 text-center text-xs text-secondary-text">
                  Đang cập nhật bảng danh sách sĩ tử...
                </div>
              )}

              <Link
                to="/hoc-online"
                onMouseEnter={() => preloadRouteModule('OnlineLearning')}
                onFocus={() => preloadRouteModule('OnlineLearning')}
                className="px-4 py-2.5 bg-paper hover:bg-primary-soft/50 flex items-center justify-between text-[11px] font-bold text-primary transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">
                    bolt
                  </span>
                  Học tại Kho Học Online để ghi danh lên Bảng Vàng hôm nay
                </span>
                <span className="material-symbols-outlined text-sm" aria-hidden="true">
                  chevron_right
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ 2. BỐN CỔNG CHÍNH — LỐI VÀO ĐẤU TRƯỜNG ═══════════════ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        <SectionHeading
          eyebrow="Bốn mặt trận trọng điểm"
          title="Lối vào đấu trường"
          hanzi="門"
          className="mb-7"
          action={
            <span className="text-xs text-secondary-text hidden sm:inline font-medium">
              Chọn khu vực bạn muốn rèn luyện hôm nay
            </span>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {ARENA_GATES.map((gate) => {
            const tone = GATE_TONE_CLASSES[gate.tone] || GATE_TONE_CLASSES.primary;
            return (
              <Link
                key={gate.to}
                to={gate.to}
                onMouseEnter={() => preloadRouteModule(gate.preloadKey)}
                onFocus={() => preloadRouteModule(gate.preloadKey)}
                className={`group relative overflow-hidden paper-card paper-card-interactive p-6 flex flex-col justify-between ${tone.hoverBorder}`}
              >
                <span
                  aria-hidden="true"
                  className="hanzi-watermark absolute top-3 right-4 text-6xl font-bold text-accent/8"
                >
                  {gate.hanzi}
                </span>

                <div className="relative z-10">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl border flex items-center justify-center ${tone.iconWrap}`}
                    >
                      <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                        {gate.icon}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-extrabold tracking-[0.14em] px-2.5 py-1 rounded-full border ${tone.tag}`}
                    >
                      {gate.tag}
                    </span>
                  </div>

                  <h3 className="font-display text-xl font-extrabold text-foreground mb-2 group-hover:text-primary transition-colors">
                    {gate.title}
                  </h3>
                  <p className="text-sm text-secondary-text leading-relaxed mb-5">{gate.desc}</p>
                </div>

                <div className="relative z-10 flex items-center justify-between pt-3 border-t border-border text-xs font-bold text-foreground group-hover:text-primary">
                  <span>{gate.cta}</span>
                  <span
                    className="material-symbols-outlined text-base transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  >
                    arrow_forward
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8" aria-hidden="true">
        <div className="lattice-divider" />
      </div>

      {/* ═══════════════ 3. CÔNG CỤ NHANH — BÀN TÍNH & TRA CỨU ═══════════════ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-12">
        <SectionHeading
          eyebrow="Trợ thủ học vụ"
          title="Công cụ nhanh"
          hanzi="器"
          className="mb-6"
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {QUICK_TOOLS.map((tool) => (
            <Link
              key={tool.to}
              to={tool.to}
              onMouseEnter={() => preloadRouteModule(tool.preloadKey)}
              onFocus={() => preloadRouteModule(tool.preloadKey)}
              className="group paper-card paper-card-interactive p-4 sm:p-5 flex flex-col justify-between"
            >
              <div
                className={`w-10 h-10 rounded-xl border ${tool.badge} flex items-center justify-center mb-3.5 group-hover:scale-105 transition-transform`}
              >
                <span className="material-symbols-outlined text-xl" aria-hidden="true">
                  {tool.icon}
                </span>
              </div>
              <div>
                <h3 className="font-display text-sm sm:text-base font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                  {tool.title}
                </h3>
                <p className="text-xs text-secondary-text leading-relaxed">{tool.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ═══════════════ 4. BA TRỤ CỘT & CAM KẾT ═══════════════ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="imperial-frame p-6 sm:p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:divide-x md:divide-border">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-primary-soft border border-primary/30 text-primary flex items-center justify-center no-shrink">
                <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                  auto_stories
                </span>
              </div>
              <div>
                <div className="font-display text-xl font-extrabold text-foreground tabular">
                  10k+ Học liệu
                </div>
                <p className="text-xs text-secondary-text mt-1 leading-relaxed">
                  Đề thi thử, chuyên đề và đáp án chi tiết phân loại theo từng môn học và kỳ thi THPT &amp; ĐGNL.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 md:pl-6">
              <div className="w-11 h-11 rounded-xl bg-jade-soft border border-jade-border text-jade flex items-center justify-center no-shrink">
                <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                  functions
                </span>
              </div>
              <div>
                <div className="font-display text-xl font-extrabold text-foreground">
                  Công cụ GPA · THPT
                </div>
                <p className="text-xs text-secondary-text mt-1 leading-relaxed">
                  Tự động tính điểm học bạ, quy đổi điểm thi ĐGNL và sắp xếp nguyện vọng trường tối ưu.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 md:pl-6">
              <div className="w-11 h-11 rounded-xl bg-gold-soft border border-gold text-gold-dark flex items-center justify-center no-shrink">
                <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                  emoji_events
                </span>
              </div>
              <div>
                <div className="font-display text-xl font-extrabold text-foreground tabular">
                  Ôn thi 2027
                </div>
                <p className="text-xs text-secondary-text mt-1 leading-relaxed">
                  Bám sát chương trình GDPT mới và cấu trúc đề minh hoạ mới nhất của Bộ GD&amp;ĐT.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ 5. CTA BANNER CUỐI TRANG ═══════════════ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12">
        <div className="relative overflow-hidden rounded-2xl border border-gold bg-gradient-to-r from-primary-soft via-paper to-gold-soft/50 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-xs">
          <span
            aria-hidden="true"
            className="hanzi-watermark absolute -right-2 -bottom-4 text-8xl font-bold text-primary/10"
          >
            勝
          </span>
          <div className="relative z-10">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
              Đấu Trường Học Tập
            </span>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold text-foreground mt-1">
              Sẵn sàng vào đấu trường?
            </h2>
            <p className="text-xs sm:text-sm text-secondary-text mt-1">
              Chọn ngay một đề thi hoặc mở sheet bài giảng để bắt đầu tích luỹ phút học đầu tiên hôm nay.
            </p>
          </div>
          <Link
            to="/library"
            onMouseEnter={() => preloadRouteModule('Library')}
            onFocus={() => preloadRouteModule('Library')}
            className="relative z-10 no-shrink btn-arena btn-arena-primary"
          >
            <span>Bắt đầu ngay</span>
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              arrow_forward
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
