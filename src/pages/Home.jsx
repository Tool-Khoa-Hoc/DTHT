import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { preloadRouteModule } from '../lib/routeModules';

const lmsKeywords = [
  'nền tảng LMS',
  'tài liệu học',
  'học online',
  'luyện tập theo môn',
  'ôn thi THPT',
  'ĐGNL / ĐGTD',
  'lộ trình học',
  'theo dõi mục tiêu',
];

const lmsHighlights = [
  {
    icon: 'folder_open',
    title: 'Thư viện tài liệu',
    copy: 'Tập trung tài liệu THPT và đại học theo môn, chuyên đề, tác giả và ngày cập nhật.',
    to: '/library',
    label: 'Mở thư viện',
    routeModuleKey: 'Library',
    accent: 'bg-sky-500/12 text-sky-700',
  },
  {
    icon: 'calculate',
    title: 'Tính điểm mục tiêu',
    copy: 'Tính GPA, điểm hệ 10 và theo dõi mục tiêu học tập cá nhân trên cùng một không gian.',
    to: '/gpa',
    label: 'Tính điểm ngay',
    routeModuleKey: 'GPACalculator',
    accent: 'bg-rose-500/12 text-rose-700',
  },
  {
    icon: 'timeline',
    title: 'Lộ trình ôn thi',
    copy: 'Sắp xếp mục tiêu học theo tuần để việc ôn thi THPT, ĐGNL và ĐGTD rõ ràng hơn.',
    to: '/roadmap',
    label: 'Xem lộ trình',
    routeModuleKey: 'Roadmap',
    accent: 'bg-emerald-500/12 text-emerald-700',
  },
  {
    icon: 'cast_for_education',
    title: 'Học online',
    copy: 'Vào sheet COMBO HS12 2027, mở tab khóa học và tài liệu đã được cấp quyền bằng Google.',
    to: '/hoc-online',
    label: 'Vào lớp học',
    routeModuleKey: 'OnlineLearning',
    accent: 'bg-teal-500/12 text-teal-700',
  },
];

const lmsFocusAreas = [
  {
    label: 'Học liệu',
    value: '10k+',
    copy: 'Tài liệu, đề cương và file học tập được gom vào một thư viện dễ tra cứu.',
  },
  {
    label: 'Công cụ',
    value: 'GPA/THPT',
    copy: 'Các công cụ tính điểm và theo dõi mục tiêu giúp người học nắm rõ tiến độ cá nhân.',
  },
  {
    label: 'Ôn thi',
    value: 'THPT',
    copy: 'Nội dung hướng tới kỳ thi THPT, đánh giá năng lực và đánh giá tư duy.',
  },
];

export default function Home() {
  const { user, profile } = useAuth();

  const renderStatus = () => {
    if (!user || !profile) {
      return (
        <>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Trạng thái</p>
          <p className="text-sm font-bold">Vui lòng đăng nhập</p>
        </>
      );
    }

    if (profile.user_mode === 'university') {
      return (
        <>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">GPA mục tiêu</p>
          <p className="text-sm font-bold tracking-tight">{profile.target_gpa ? `${profile.target_gpa}/4.0` : 'Chưa thiết lập'}</p>
        </>
      );
    }

    return (
      <>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Mục tiêu THPT</p>
        <div className="flex flex-col">
          <p className="text-sm font-bold tracking-tight">{profile.target_thpt ? `${profile.target_thpt} điểm` : 'Chưa thiết lập'}</p>
          {profile.target_dgnl && (
            <p className="text-[10px] text-slate-400">ĐGNL: {profile.target_dgnl}</p>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#201216] to-[#150a0d] pb-24 text-white">
      <main className="relative flex flex-col items-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(at_0%_0%,rgba(227,100,136,0.15)_0px,transparent_50%),radial-gradient(at_100%_100%,rgba(227,100,136,0.1)_0px,transparent_50%)]" />

        <div className="relative z-10 flex w-full max-w-5xl flex-col gap-8 px-4 py-8">
          <section className="flex flex-col gap-6 md:flex-row">
            <div className="group relative flex-1 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-md transition-colors hover:border-[#e36488]/30">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-[#e36488]/20 blur-2xl" />
              <h2 className="text-2xl font-extrabold leading-tight sm:text-3xl md:text-4xl">
                Nền tảng LMS.
                <br />
                <span className="text-[#e36488]">Tài liệu, luyện tập</span> và ôn thi.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-400">
                Không gian học tập cho học sinh, sinh viên Việt Nam: tìm tài liệu, học online, theo dõi mục tiêu và xây lộ trình ôn thi trên cùng một hệ thống.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <Link
                  to="/library"
                  onMouseEnter={() => preloadRouteModule('Library')}
                  onFocus={() => preloadRouteModule('Library')}
                  className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#e36488] font-bold text-white shadow-lg shadow-[#e36488]/20 transition-colors hover:bg-[#d05378]"
                >
                  <span className="material-symbols-outlined">folder_open</span>
                  Mở thư viện LMS
                </Link>
                <Link
                  to="/roadmap"
                  onMouseEnter={() => preloadRouteModule('Roadmap')}
                  onFocus={() => preloadRouteModule('Roadmap')}
                  className="flex h-11 items-center justify-center rounded-full border border-white/8 bg-transparent font-bold text-slate-300 transition-colors hover:bg-white/5"
                >
                  Xem lộ trình ôn thi
                </Link>
              </div>
            </div>

            <Link to="/profile" className="flex items-center justify-between rounded-xl border border-white/10 border-l-4 border-l-[#e36488] bg-white/5 p-4 backdrop-blur-md transition-colors hover:bg-white/10">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e36488]/10">
                  <span className="material-symbols-outlined text-[#e36488]">user_attributes</span>
                </div>
                <div>{renderStatus()}</div>
              </div>
              <span className="material-symbols-outlined text-slate-500">chevron_right</span>
            </Link>
          </section>

          <section className="w-full max-w-5xl overflow-hidden rounded-[30px] border border-[#c7dff3]/40 bg-[linear-gradient(135deg,#f7fbff_0%,#edf8f5_48%,#fff7ed_100%)] p-5 text-slate-900 shadow-[0_24px_80px_rgba(35,69,91,0.16)] md:p-6">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_320px] md:items-stretch">
              <div className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.76)] backdrop-blur-sm md:p-6">
                <span className="inline-flex rounded-full bg-sky-100 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-sky-700">
                  Nền tảng LMS
                </span>
                <p className="mt-5 text-[10px] font-black uppercase tracking-[0.28em] text-emerald-700 sm:text-xs">Tài liệu học - Luyện tập - Ôn thi</p>
                <h3 className="mt-3 max-w-2xl text-2xl font-black leading-tight tracking-tight text-[#143530] sm:text-3xl">
                  Tổ chức học liệu và tiến độ ôn thi trong một không gian rõ ràng
                </h3>
                <p className="mt-3 max-w-2xl text-base leading-8 text-slate-600">
                  Đấu Trường Học Tập gom thư viện tài liệu, khóa học online, công cụ luyện tập và lộ trình mục tiêu để người học có thể tìm đúng nội dung, luyện đúng phần còn yếu và chuẩn bị cho kỳ thi quan trọng.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {lmsKeywords.map((item) => (
                    <span key={item} className="rounded-full border border-white/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700">
                      {item}
                    </span>
                  ))}
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link
                    to="/library"
                    onMouseEnter={() => preloadRouteModule('Library')}
                    onFocus={() => preloadRouteModule('Library')}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#236a8c] px-6 text-sm font-bold text-white shadow-lg shadow-[#236a8c]/20 transition-colors hover:bg-[#1d5874]"
                  >
                    <span className="material-symbols-outlined text-[20px]">folder_open</span>
                    Khám phá tài liệu
                  </Link>
                  <Link
                    to="/gpa"
                    onMouseEnter={() => preloadRouteModule('GPACalculator')}
                    onFocus={() => preloadRouteModule('GPACalculator')}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <span className="material-symbols-outlined text-[20px]">calculate</span>
                    Tính điểm ngay
                  </Link>
                </div>
              </div>

              <div className="grid gap-3">
                {lmsFocusAreas.map((item) => (
                  <div key={item.label} className="rounded-[24px] border border-white/70 bg-white/80 p-5 shadow-[0_14px_34px_rgba(23,60,53,0.1)] backdrop-blur-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-[#18443d]">{item.value}</p>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{item.copy}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-[#236a8c]">Không gian học tập</p>
                  <h3 className="mt-2 text-2xl font-black tracking-tight text-[#153631]">Ba trụ cột cho học liệu, luyện tập và ôn thi</h3>
                </div>
                <p className="max-w-2xl text-sm leading-7 text-slate-600">
                  Trang chủ ưu tiên các điểm vào quan trọng của LMS: mở tài liệu, vào lớp học online và theo dõi lộ trình học theo mục tiêu.
                </p>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                {lmsHighlights.map((item) => (
                  <Link
                    key={item.title}
                    to={item.to}
                    onMouseEnter={() => preloadRouteModule(item.routeModuleKey)}
                    onFocus={() => preloadRouteModule(item.routeModuleKey)}
                    className="group flex min-h-[230px] flex-col rounded-[24px] border border-white/70 bg-white/75 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition-all hover:-translate-y-0.5 hover:bg-white"
                  >
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.accent}`}>
                      <span className="material-symbols-outlined text-[24px]">{item.icon}</span>
                    </div>
                    <h4 className="mt-4 text-xl font-black leading-tight tracking-tight text-[#153631]">{item.title}</h4>
                    <p className="mt-3 flex-1 text-sm font-medium leading-7 text-slate-600">{item.copy}</p>
                    <span className="mt-5 inline-flex items-center gap-1 text-sm font-black text-[#236a8c]">
                      {item.label}
                      <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-0.5">arrow_forward</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="flex w-full max-w-5xl flex-col">
            <h3 className="mb-6 flex items-center gap-2 text-xl font-bold">
              <span className="material-symbols-outlined text-2xl text-[#e36488]">grid_view</span>
              Công cụ học tập
            </h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Link to="/gpa" className="group flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-[#e36488]/30 hover:bg-[#e36488]/10">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/20">
                  <span className="material-symbols-outlined text-blue-400">add_chart</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold">Tính GPA</h4>
                  <p className="text-[10px] text-slate-400">Hệ 4 và hệ 10</p>
                </div>
                <span className="flex items-center gap-1 text-[11px] font-bold text-[#e36488]">
                  Dùng ngay
                  <span className="material-symbols-outlined text-xs transition-transform group-hover:translate-x-0.5">arrow_forward</span>
                </span>
              </Link>

              <Link to="/schools" className="group flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-orange-500/30 hover:bg-orange-500/10">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/20">
                  <span className="material-symbols-outlined text-orange-400">apartment</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold">Tìm trường</h4>
                  <p className="text-[10px] text-slate-400">So khớp mục tiêu</p>
                </div>
                <span className="flex items-center gap-1 text-[11px] font-bold text-orange-400">
                  Mở ngay
                  <span className="material-symbols-outlined text-xs transition-transform group-hover:translate-x-0.5">arrow_forward</span>
                </span>
              </Link>

              <Link to="/roadmap" className="group flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-green-500/30 hover:bg-green-500/10">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-500/20">
                  <span className="material-symbols-outlined text-green-400">timeline</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold">Lộ trình</h4>
                  <p className="text-[10px] text-slate-400">Theo tuần rõ ràng</p>
                </div>
                <span className="flex items-center gap-1 text-[11px] font-bold text-green-400">
                  Theo dõi
                  <span className="material-symbols-outlined text-xs transition-transform group-hover:translate-x-0.5">arrow_forward</span>
                </span>
              </Link>

              <Link to="/library" className="group flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-sky-500/30 hover:bg-sky-500/10">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/20">
                  <span className="material-symbols-outlined text-sky-400">folder_open</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold">Thư viện</h4>
                  <p className="text-[10px] text-slate-400">Tài liệu theo môn</p>
                </div>
                <span className="flex items-center gap-1 text-[11px] font-bold text-sky-400">
                  Xem ngay
                  <span className="material-symbols-outlined text-xs transition-transform group-hover:translate-x-0.5">arrow_forward</span>
                </span>
              </Link>
            </div>
          </section>

          <section className="w-full max-w-5xl">
            <div className="flex justify-around rounded-2xl bg-gradient-to-r from-[#e36488] to-[#ff8c72] p-8 text-center shadow-lg shadow-[#e36488]/20">
              <div>
                <p className="text-2xl font-extrabold text-white">50k+</p>
                <p className="text-[10px] font-bold uppercase text-white/80">Lượt tính điểm</p>
              </div>
              <div className="my-auto h-10 w-px bg-white/20" />
              <div>
                <p className="text-3xl font-extrabold text-white">10k+</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wider text-white/90">Tài liệu</p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
