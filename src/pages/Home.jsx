import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserRank, RANK_TIERS } from '../utils/rankHelper';
import { preloadRouteModule } from '../lib/routeModules';
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
    desc: 'Tích luỹ phút học thực tế, leo bậc quân hàm từ Tân Binh đến Thống Soái cùng bạn bè.',
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
  const { user, profile } = useAuth();
  const studyMinutes = profile?.total_study_minutes || 0;
  const userRank = getUserRank(studyMinutes, profile?.is_thong_soai);
  const studyHours = (studyMinutes / 60).toFixed(1);

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

              {/* Rank ladder strip — Con đường thăng hạng */}
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
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
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
                          name={profile?.full_name || user?.email}
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
                          {profile?.full_name || 'Chiến binh DTHT'}
                        </h2>
                        <div className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-soft text-primary border border-primary/30">
                          <span className="material-symbols-outlined text-sm icon-fill" aria-hidden="true">
                            {userRank.icon}
                          </span>
                          <span>Hạng {userRank.name}</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress to next rank */}
                    <div className="p-4 rounded-xl bg-paper border border-border mb-4">
                      <ProgressBar
                        value={userRank.progress}
                        max={100}
                        tone="primary"
                        label={
                          userRank.nextRank
                            ? `Tiến tới ${userRank.nextRank.name}`
                            : 'Đã đạt đỉnh Thống Soái'
                        }
                        sublabel={
                          userRank.nextRank
                            ? `Còn ${Math.max(0, userRank.nextRank.min - studyMinutes)} phút`
                            : 'Cấp tối đa'
                        }
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
                      Mỗi phút học đều giúp bạn tiến gần hơn tới danh hiệu{' '}
                      <span className="text-primary font-bold">Thống Soái</span>.
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

                  <Link
                    to="/auth"
                    className="btn-arena btn-arena-primary w-full"
                  >
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">
                      login
                    </span>
                    <span>Đăng nhập / Tạo tài khoản miễn phí</span>
                  </Link>
                </div>
              )}
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
                  Đề thi thử, chuyên đề và đáp án chi tiết phân loại theo từng khối lớp 10 · 11 · 12.
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
                  Tự động tính điểm học bạ, xét tuyển đại học và gợi ý ngành phù hợp năng lực.
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
