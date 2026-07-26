import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { preloadRouteModule } from '../lib/routeModules';
import { getUserRank, RANK_TIERS } from '../utils/rankHelper';

// Bốn cửa chính vào đấu trường — mỗi cửa một sắc riêng lấy từ bảng token.
const arenaGates = [
  {
    icon: 'folder_open',
    title: 'Thư viện tài liệu',
    copy: 'Tài liệu THPT và đại học gom theo môn, chuyên đề, tác giả và ngày cập nhật.',
    to: '/library',
    label: 'Mở thư viện',
    routeModuleKey: 'Library',
    accent: 'jade',
  },
  {
    icon: 'computer',
    title: 'Học online',
    copy: 'Vào sheet COMBO HS12, mở tab khóa học và tài liệu đã cấp quyền bằng Google.',
    to: '/hoc-online',
    label: 'Vào lớp học',
    routeModuleKey: 'OnlineLearning',
    accent: 'violet',
  },
  {
    icon: 'timeline',
    title: 'Lộ trình ôn thi',
    copy: 'Xếp mục tiêu theo tuần để ôn THPT, ĐGNL và ĐGTD rõ ràng từng chặng.',
    to: '/roadmap',
    label: 'Xem lộ trình',
    routeModuleKey: 'Roadmap',
    accent: 'gold',
  },
  {
    icon: 'local_fire_department',
    title: 'Đấu trường',
    copy: 'Luyện đề, tích luỹ thành tích và thăng hạng qua từng buổi ôn thi.',
    to: '/arena',
    label: 'Vào đấu trường',
    routeModuleKey: 'StudyArena',
    accent: 'ember',
  },
];

// Công cụ nhanh — hàng phụ, giữ tiết chế.
const quickTools = [
  { icon: 'calculate', title: 'Tính GPA', copy: 'Hệ 4 và hệ 10', to: '/gpa', routeModuleKey: 'GPACalculator', tint: 'text-jade-300' },
  { icon: 'apartment', title: 'Tìm trường', copy: 'So khớp mục tiêu', to: '/schools', routeModuleKey: 'SchoolFinder', tint: 'text-violet-400' },
  { icon: 'add_chart', title: 'Điểm xét tuyển', copy: 'Ước tính tổ hợp', to: '/admission', routeModuleKey: 'AdmissionCalculator', tint: 'text-gold-300' },
  { icon: 'edit_note', title: 'Ghi chú', copy: 'Ôn nhanh mỗi ngày', to: '/notes', routeModuleKey: 'Notes', tint: 'text-ember-400' },
];

// Ba trụ cột — số liệu bằng display face, sắc gold cho tinh thần "thành tích".
const pillars = [
  { label: 'Học liệu', value: '10k+', copy: 'Tài liệu, đề cương và file học tập trong một thư viện dễ tra cứu.' },
  { label: 'Công cụ', value: 'GPA · THPT', copy: 'Tính điểm và theo dõi mục tiêu để nắm rõ tiến độ cá nhân.' },
  { label: 'Ôn thi', value: '2027', copy: 'Nội dung hướng thẳng tới THPT, đánh giá năng lực và tư duy.' },
];

const accentMap = {
  jade: {
    seal: 'bg-jade-400/12 text-jade-300',
    border: 'hover:border-jade-400/45',
    glow: 'bg-jade-400/20',
    cta: 'text-jade-300',
  },
  violet: {
    seal: 'bg-violet-400/12 text-violet-400',
    border: 'hover:border-violet-400/45',
    glow: 'bg-violet-500/20',
    cta: 'text-violet-400',
  },
  gold: {
    seal: 'bg-gold-400/14 text-gold-300',
    border: 'hover:border-gold-400/45',
    glow: 'bg-gold-400/20',
    cta: 'text-gold-300',
  },
  ember: {
    seal: 'bg-ember-500/14 text-ember-400',
    border: 'hover:border-ember-500/45',
    glow: 'bg-ember-500/25',
    cta: 'text-ember-400',
  },
};

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950';

export default function Home() {
  const { user, profile } = useAuth();

  // Thứ hạng "sàn" lấy thẳng từ hệ thống rank thật (Tân Binh → Thống Soái).
  const rank = getUserRank(0, profile?.role, profile?.is_approved_bang_chu);

  const renderTarget = () => {
    if (!user || !profile) {
      return <span className="text-slate-400">Đăng nhập để đặt mục tiêu</span>;
    }
    if (profile.user_mode === 'university') {
      return (
        <>
          GPA mục tiêu ·{' '}
          <span className="font-bold text-gold-300">
            {profile.target_gpa ? `${profile.target_gpa}/4.0` : 'chưa đặt'}
          </span>
        </>
      );
    }
    return (
      <>
        Mục tiêu THPT ·{' '}
        <span className="font-bold text-gold-300">
          {profile.target_thpt ? `${profile.target_thpt} điểm` : 'chưa đặt'}
        </span>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-ink-950 pb-24 text-white">
      {/* nền: hai vầng ember + một vầng jade dịu, rất mờ */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(60%_50%_at_85%_-5%,rgba(227,100,136,0.16),transparent_60%),radial-gradient(50%_40%_at_-5%_10%,rgba(242,193,89,0.08),transparent_55%),radial-gradient(60%_60%_at_50%_110%,rgba(95,207,166,0.07),transparent_60%)]" />

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8 md:py-10">
        {/* ══════════════ HERO — điểm nhấn duy nhất ══════════════ */}
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="arena-sweep relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-ink-800 to-ink-900 p-7 md:p-9">
            <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-ember-500/20 blur-3xl ember-pulse" />

            {/* eyebrow = khẩu hiệu thương hiệu */}
            <div className="relative flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-gold-400 ember-pulse" />
              <span className="font-arena text-[11px] font-bold uppercase tracking-[0.34em] text-gold-300">
                Học tập &amp; Chinh phục
              </span>
              <span className="hidden text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 sm:inline">
                · Mùa thi 2027
              </span>
            </div>

            <h1 className="font-arena relative mt-5 text-4xl font-extrabold leading-[0.98] tracking-tight sm:text-5xl md:text-[3.4rem]">
              Rèn mỗi ngày.
              <br />
              <span className="bg-gradient-to-r from-ember-400 via-ember-500 to-gold-400 bg-clip-text text-transparent">
                Chinh phục
              </span>{' '}
              kỳ thi.
            </h1>

            <p className="relative mt-5 max-w-xl text-sm leading-relaxed text-slate-300/90 sm:text-base">
              Không gian luyện thi cho học sinh, sinh viên Việt Nam — gom tài liệu, học online,
              theo dõi mục tiêu và thăng hạng qua từng buổi ôn, tất cả trong một đấu trường.
            </p>

            <div className="relative mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/library"
                onMouseEnter={() => preloadRouteModule('Library')}
                onFocus={() => preloadRouteModule('Library')}
                className={`flex h-12 items-center justify-center gap-2 rounded-full bg-ember-500 px-6 font-bold text-white shadow-lg shadow-ember-500/25 transition-all hover:bg-ember-600 active:scale-[0.98] ${focusRing}`}
              >
                <span className="material-symbols-outlined text-[20px]">folder_open</span>
                Mở thư viện
              </Link>
              <Link
                to="/roadmap"
                onMouseEnter={() => preloadRouteModule('Roadmap')}
                onFocus={() => preloadRouteModule('Roadmap')}
                className={`flex h-12 items-center justify-center gap-2 rounded-full border border-white/12 px-6 font-bold text-slate-200 transition-colors hover:bg-white/5 ${focusRing}`}
              >
                <span className="material-symbols-outlined text-[20px]">timeline</span>
                Xem lộ trình
              </Link>
            </div>

            {/* SIGNATURE — con đường thăng hạng (thang bậc võ lâm có thật) */}
            <div className="relative mt-8 border-t border-white/8 pt-5">
              <p className="mb-3 font-arena text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">
                Con đường thăng hạng
              </p>
              <ol className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                {RANK_TIERS.map((tier, index) => (
                  <li key={tier.name} className="flex shrink-0 items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                        index === 0
                          ? 'border-gold-400/40 bg-gold-400/10 text-gold-300'
                          : 'border-white/10 bg-white/[0.03] text-slate-400'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">{tier.icon}</span>
                      {tier.name}
                    </span>
                    {index < RANK_TIERS.length - 1 && (
                      <span className="material-symbols-outlined text-[14px] text-slate-600">chevron_right</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Thẻ hồ sơ / thứ hạng cá nhân */}
          <Link
            to="/profile"
            onMouseEnter={() => preloadRouteModule('Profile')}
            onFocus={() => preloadRouteModule('Profile')}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition-colors hover:border-gold-400/30 hover:bg-white/[0.06] ${focusRing}`}
          >
            <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gold-400/10 blur-2xl" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Thứ hạng của bạn</p>
              <div className="mt-4 flex items-center gap-3.5">
                <span className="rank-seal grid h-14 w-14 place-items-center bg-gradient-to-br from-gold-400/25 to-ember-500/20 text-gold-300 ring-1 ring-gold-400/30">
                  <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {rank.icon}
                  </span>
                </span>
                <div>
                  <p className="font-arena text-xl font-extrabold tracking-tight text-white">{rank.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{renderTarget()}</p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-white/8 pt-4">
              <span className="text-sm font-semibold text-slate-300">Vào hồ sơ của bạn</span>
              <span className="material-symbols-outlined text-slate-500 transition-transform group-hover:translate-x-0.5">
                arrow_forward
              </span>
            </div>
          </Link>
        </section>

        {/* ══════════════ LỐI VÀO ĐẤU TRƯỜNG ══════════════ */}
        <section>
          <SectionHeading eyebrow="Bắt đầu mỗi buổi ôn" title="Lối vào đấu trường">
            Bốn cửa chính: tìm tài liệu, học online, theo dõi lộ trình và luyện đề để thăng hạng.
          </SectionHeading>

          <div className="mt-6 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {arenaGates.map((gate) => {
              const a = accentMap[gate.accent];
              return (
                <Link
                  key={gate.title}
                  to={gate.to}
                  onMouseEnter={() => preloadRouteModule(gate.routeModuleKey)}
                  onFocus={() => preloadRouteModule(gate.routeModuleKey)}
                  className={`group relative flex min-h-[218px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition-all hover:-translate-y-0.5 hover:bg-white/[0.06] ${a.border} ${focusRing}`}
                >
                  <div className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl ${a.glow}`} />
                  <span className={`rank-seal grid h-12 w-12 place-items-center ${a.seal}`}>
                    <span className="material-symbols-outlined text-[24px]">{gate.icon}</span>
                  </span>
                  <h3 className="font-arena mt-4 text-lg font-bold tracking-tight text-white">{gate.title}</h3>
                  <p className="mt-2 flex-1 text-[13px] leading-relaxed text-slate-400">{gate.copy}</p>
                  <span className={`mt-4 inline-flex items-center gap-1 text-[13px] font-bold ${a.cta}`}>
                    {gate.label}
                    <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-0.5">
                      arrow_forward
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ══════════════ CÔNG CỤ NHANH ══════════════ */}
        <section>
          <SectionHeading eyebrow="Trong tầm tay" title="Công cụ nhanh">
            Những phép tính và ghi chú bạn cần trước mỗi kỳ thi.
          </SectionHeading>

          <div className="mt-6 grid grid-cols-2 gap-3.5 md:grid-cols-4">
            {quickTools.map((tool) => (
              <Link
                key={tool.title}
                to={tool.to}
                onMouseEnter={() => preloadRouteModule(tool.routeModuleKey)}
                onFocus={() => preloadRouteModule(tool.routeModuleKey)}
                className={`group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06] ${focusRing}`}
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5">
                  <span className={`material-symbols-outlined text-[22px] ${tool.tint}`}>{tool.icon}</span>
                </span>
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-bold text-white">{tool.title}</h4>
                  <p className="truncate text-[11px] text-slate-400">{tool.copy}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ══════════════ BA TRỤ CỘT ══════════════ */}
        <section className="grid gap-3.5 md:grid-cols-3">
          {pillars.map((pillar) => (
            <div
              key={pillar.label}
              className="rounded-2xl border border-white/10 bg-white/[0.035] p-6"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">{pillar.label}</p>
              <p className="font-arena mt-2 bg-gradient-to-r from-gold-300 to-gold-500 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
                {pillar.value}
              </p>
              <p className="mt-2.5 text-[13px] leading-relaxed text-slate-400">{pillar.copy}</p>
            </div>
          ))}
        </section>

        {/* ══════════════ CTA BANNER ══════════════ */}
        <section className="relative overflow-hidden rounded-3xl border border-ember-500/20 bg-gradient-to-r from-ember-600 via-ember-500 to-[#ff8c66] p-8 text-center shadow-xl shadow-ember-500/20 md:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(40%_120%_at_50%_-20%,rgba(255,255,255,0.22),transparent)]" />
          <p className="relative font-arena text-[11px] font-bold uppercase tracking-[0.3em] text-white/80">
            Học tập &amp; Chinh phục
          </p>
          <h2 className="font-arena relative mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Sẵn sàng vào đấu trường?
          </h2>
          <p className="relative mx-auto mt-3 max-w-lg text-sm text-white/85">
            Mở thư viện, chọn một buổi luyện đề và bắt đầu hành trình thăng hạng của bạn ngay hôm nay.
          </p>
          <Link
            to="/library"
            onMouseEnter={() => preloadRouteModule('Library')}
            onFocus={() => preloadRouteModule('Library')}
            className={`relative mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-7 font-bold text-ember-600 shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] ${focusRing} focus-visible:ring-offset-ember-500`}
          >
            <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
            Bắt đầu ngay
          </Link>
        </section>
      </main>
    </div>
  );
}

function SectionHeading({ eyebrow, title, children }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="font-arena text-[10px] font-bold uppercase tracking-[0.28em] text-ember-400">{eyebrow}</p>
        <h2 className="font-arena mt-2 text-2xl font-extrabold tracking-tight text-white">{title}</h2>
      </div>
      <p className="max-w-md text-[13px] leading-relaxed text-slate-400">{children}</p>
    </div>
  );
}
