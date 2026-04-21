import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { comboHs12Course } from '../content/courseCatalog';
import { preloadRouteModule } from '../lib/routeModules';

const planCardStyles = [
  'border-cyan-100 bg-cyan-50/90 text-cyan-700',
  'border-emerald-100 bg-emerald-50/90 text-emerald-700',
  'border-teal-100 bg-teal-50/90 text-teal-700',
  'border-sky-100 bg-sky-50/90 text-sky-700',
  'border-violet-100 bg-violet-50/90 text-violet-700',
];

export default function Home() {
  const { user, profile } = useAuth();
  const course = comboHs12Course;

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
              <h2 className="text-3xl font-extrabold leading-tight">
                Tính điểm nhanh.
                <br />
                <span className="text-[#e36488]">Học nhẹ hơn</span> mỗi ngày.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-400">
                Máy tính điểm GPA/điểm trung bình cùng thư viện tài liệu và khu vực khóa học online dành cho học sinh, sinh viên Việt Nam.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <Link to="/gpa" className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#e36488] font-bold text-white shadow-lg shadow-[#e36488]/20 transition-colors hover:bg-[#d05378]">
                  <span className="material-symbols-outlined">calculate</span>
                  Tính điểm ngay
                </Link>
                <Link
                  to={course.path}
                  onMouseEnter={() => preloadRouteModule('CourseComboHs12')}
                  onFocus={() => preloadRouteModule('CourseComboHs12')}
                  className="flex h-12 items-center justify-center rounded-full border border-white/10 bg-white/5 font-bold text-slate-200 transition-colors hover:bg-white/10"
                >
                  Xem các khóa học
                </Link>
                <Link to="/library" className="flex h-11 items-center justify-center rounded-full border border-white/8 bg-transparent font-bold text-slate-300 transition-colors hover:bg-white/5">
                  Xem tài liệu
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

          <section className="w-full max-w-5xl overflow-hidden rounded-[30px] border border-[#f3c7b6]/30 bg-[linear-gradient(180deg,#f5fbfb_0%,#edf5f4_40%,#f7f1f8_100%)] p-5 text-slate-900 shadow-[0_24px_80px_rgba(44,84,77,0.18)] md:p-6">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1.15fr)_290px] md:items-start">
              <div className="relative overflow-hidden rounded-[28px] border border-white/60 bg-white/60 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-sm">
                <div className="absolute -left-16 top-4 h-28 w-28 rounded-full bg-cyan-200/40 blur-3xl" />
                <div className="absolute -right-10 bottom-0 h-24 w-24 rounded-full bg-violet-200/40 blur-3xl" />
                <div className="relative">
                  <span className="inline-flex rounded-full bg-[#dff2ea] px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#225e53]">
                    {course.badge}
                  </span>
                  <p className="mt-5 text-xs font-black uppercase tracking-[0.28em] text-[#386f66]">Khóa học online</p>
                  <h3 className="mt-3 max-w-2xl text-3xl font-black leading-tight tracking-[-0.04em] text-[#143530]">
                    {course.title}
                  </h3>
                  <p className="mt-3 max-w-2xl text-base leading-8 text-slate-600">{course.summary}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {course.highlights.map((item) => (
                      <span key={item} className="rounded-full border border-white/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700">
                        {item}
                      </span>
                    ))}
                  </div>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Link
                      to={course.path}
                      onMouseEnter={() => preloadRouteModule('CourseComboHs12')}
                      onFocus={() => preloadRouteModule('CourseComboHs12')}
                      className="inline-flex h-12 items-center justify-center rounded-full bg-[#2c7a6c] px-6 text-sm font-bold text-white shadow-lg shadow-[#2c7a6c]/20 transition-colors hover:bg-[#24695d]"
                    >
                      Xem bảng giá và khóa học
                    </Link>
                    <Link to="/library" className="inline-flex h-12 items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50">
                      Xem tài liệu miễn phí
                    </Link>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/60 bg-white/70 p-4 shadow-[0_18px_40px_rgba(23,60,53,0.12)] backdrop-blur-sm">
                <div className="rounded-[24px] bg-[linear-gradient(180deg,#f7fffd_0%,#eef7f5_100%)] p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#386f66]">Giá ưu đãi</p>
                  <p className="mt-2 text-5xl font-black tracking-[-0.06em] text-[#18443d]">{course.price}</p>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{course.subtitle}</p>
                </div>
                <div className="mt-4 rounded-[22px] bg-[#21453f] px-4 py-4 text-white">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/70">Dành cho</p>
                  <p className="mt-2 text-sm font-semibold leading-7">{course.audience}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-[28px] border border-white/70 bg-white/55 p-4 backdrop-blur-sm md:p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-[#386f66]">Bảng giá ưu đãi</p>
                  <h3 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#153631]">Chọn gói học phù hợp với đúng nhu cầu</h3>
                </div>
                <p className="max-w-2xl text-sm leading-7 text-slate-600">{course.pricingIntro}</p>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {course.pricingPlans.map((plan, index) => (
                  <div
                    key={plan.name}
                    className={`rounded-[24px] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ${planCardStyles[index] ?? planCardStyles[0]}`}
                  >
                    <p className="text-xl font-black leading-tight">{plan.name}</p>
                    <p className="mt-2 min-h-[48px] text-sm font-medium leading-6 text-slate-600">{plan.subtitle}</p>
                    <div className="mt-5 flex items-end gap-1">
                      <span className="text-5xl font-black tracking-[-0.05em]">{plan.price}</span>
                      {plan.unit ? <span className="pb-1 text-lg font-bold">{plan.unit}</span> : null}
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-600">{plan.note}</p>
                  </div>
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
              <Link to="/gpa" className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md transition-all hover:border-[#e36488]/30 hover:bg-[#e36488]/10">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                  <span className="material-symbols-outlined text-blue-400">add_chart</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold">Tính GPA</h4>
                  <p className="text-[10px] text-slate-400">Hệ 4 và hệ 10</p>
                </div>
                <span className="flex items-center gap-1 text-[11px] font-bold text-[#e36488]">
                  Dùng ngay
                  <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </span>
              </Link>

              <Link to="/schools" className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md transition-all hover:border-orange-500/30 hover:bg-orange-500/10">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/20">
                  <span className="material-symbols-outlined text-orange-400">apartment</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold">Tìm trường</h4>
                  <p className="text-[10px] text-slate-400">So khớp mục tiêu</p>
                </div>
                <span className="flex items-center gap-1 text-[11px] font-bold text-orange-400">
                  Mở ngay
                  <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </span>
              </Link>

              <Link to="/roadmap" className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md transition-all hover:border-green-500/30 hover:bg-green-500/10">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
                  <span className="material-symbols-outlined text-green-400">timeline</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold">Lộ trình</h4>
                  <p className="text-[10px] text-slate-400">Theo tuần rõ ràng</p>
                </div>
                <span className="flex items-center gap-1 text-[11px] font-bold text-green-400">
                  Theo dõi
                  <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </span>
              </Link>

              <Link to="/library" className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md transition-all hover:border-sky-500/30 hover:bg-sky-500/10">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/20">
                  <span className="material-symbols-outlined text-sky-400">folder_open</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold">Thư viện</h4>
                  <p className="text-[10px] text-slate-400">Tài liệu dạng details</p>
                </div>
                <span className="flex items-center gap-1 text-[11px] font-bold text-sky-400">
                  Xem ngay
                  <span className="material-symbols-outlined text-xs">arrow_forward</span>
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
