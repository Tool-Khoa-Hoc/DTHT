import React from 'react';
import { Link } from 'react-router-dom';
import { comboHs12Course } from '../content/courseCatalog';

const planCardStyles = [
  {
    frame: 'border-cyan-100 bg-cyan-50/90',
    price: 'text-cyan-600',
    chip: 'bg-cyan-100 text-cyan-700',
  },
  {
    frame: 'border-emerald-100 bg-emerald-50/90',
    price: 'text-emerald-600',
    chip: 'bg-emerald-100 text-emerald-700',
  },
  {
    frame: 'border-teal-100 bg-teal-50/90',
    price: 'text-teal-600',
    chip: 'bg-teal-100 text-teal-700',
  },
  {
    frame: 'border-sky-100 bg-sky-50/90',
    price: 'text-sky-600',
    chip: 'bg-sky-100 text-sky-700',
  },
  {
    frame: 'border-violet-100 bg-violet-50/90',
    price: 'text-violet-600',
    chip: 'bg-violet-100 text-violet-700',
  },
];

function MetricCard({ value, label }) {
  return (
    <div className="rounded-[26px] border border-white/70 bg-white/70 px-4 py-5 shadow-[0_14px_34px_rgba(29,78,74,0.08)] backdrop-blur-sm">
      <p className="text-2xl font-black tracking-tight text-[#173f39]">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
    </div>
  );
}

function PricingCard({ plan, index }) {
  const style = planCardStyles[index] ?? planCardStyles[0];

  return (
    <article className={`rounded-[28px] border p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ${style.frame}`}>
      <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${style.chip}`}>
        Gói {index + 1}
      </span>
      <h3 className="mt-4 text-2xl font-black leading-tight text-[#183d37]">{plan.name}</h3>
      <p className="mt-2 min-h-[52px] text-sm leading-6 text-slate-600">{plan.subtitle}</p>
      <div className="mt-5 flex items-end gap-1">
        <span className={`text-5xl font-black tracking-[-0.06em] ${style.price}`}>{plan.price}</span>
        {plan.unit ? <span className="pb-1 text-lg font-bold text-slate-600">{plan.unit}</span> : null}
      </div>
      <p className="mt-4 text-sm leading-7 text-slate-600">{plan.note}</p>
    </article>
  );
}

export default function CourseComboHs12() {
  const course = comboHs12Course;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fdfc_0%,#f4faf8_35%,#f8f5fb_100%)] pb-24 font-display text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 md:px-6 md:py-8">
        <section className="relative overflow-hidden rounded-[36px] border border-[#d9ebe5] bg-white/72 shadow-[0_24px_80px_rgba(26,78,72,0.14)] backdrop-blur-sm">
          <div className="absolute -left-20 top-8 h-52 w-52 rounded-full bg-cyan-200/35 blur-3xl" />
          <div className="absolute right-[-40px] top-12 h-56 w-56 rounded-full bg-emerald-200/35 blur-3xl" />
          <div className="absolute bottom-[-60px] left-1/3 h-48 w-48 rounded-full bg-violet-200/30 blur-3xl" />

          <div className="relative grid gap-8 p-5 md:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] md:p-8 lg:p-10">
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center rounded-full bg-[#ddf2eb] px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-[#235a51]">
                  {course.badge}
                </span>
                <span className="inline-flex items-center rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  {course.audience}
                </span>
              </div>

              <div className="max-w-3xl">
                <p className="text-sm font-bold uppercase tracking-[0.28em] text-[#2c6f63]">Các khóa học</p>
                <h1 className="mt-3 text-4xl font-extrabold leading-[1.08] tracking-[-0.035em] text-[#173833] md:text-5xl">
                  {course.title}
                </h1>
                <p className="mt-4 max-w-2xl text-lg font-medium leading-8 text-slate-600">
                  {course.subtitle}
                </p>
                <p className="mt-4 max-w-2xl text-[15px] leading-8 text-slate-500">
                  {course.summary}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {course.highlights.map((item) => (
                  <div key={item} className="rounded-[24px] border border-white/80 bg-white/72 px-4 py-4">
                    <span className="material-symbols-outlined text-[20px] text-[#2c7a6c]">bolt</span>
                    <p className="mt-2 text-[15px] font-medium leading-7 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  to="/roadmap"
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#2c7a6c] px-6 text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_12px_30px_rgba(44,122,108,0.22)] transition-transform hover:-translate-y-0.5"
                >
                  Xem lộ trình học
                </Link>
                <Link
                  to="/library"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-sm font-black uppercase tracking-[0.14em] text-[#2c7a6c] transition-colors hover:bg-slate-50"
                >
                  Mở thư viện free
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="relative overflow-hidden rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,#eff8f6_0%,#e8f4f1_58%,#f4eef8_100%)] p-5 shadow-[0_24px_60px_rgba(44,122,108,0.16)]">
                <div className="absolute -left-8 top-6 rotate-[-18deg] rounded-full bg-white px-7 py-2 text-sm font-black uppercase tracking-[0.12em] text-[#2c7a6c] shadow-lg">
                  Bảng giá mới
                </div>
                <div className="absolute right-4 top-4 rounded-full bg-[#2c7a6c] px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-white">
                  Dễ chọn gói
                </div>
                <div className="flex min-h-[360px] flex-col justify-between rounded-[26px] border border-white/80 bg-white/70 p-4 backdrop-blur-sm">
                  <div className="grid gap-4">
                    <div className="rounded-[24px] bg-[#173f39] px-4 py-5 text-white">
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/70">Giá ưu đãi</p>
                      <div className="mt-2 flex items-end gap-2">
                        <p className="text-5xl font-black tracking-[-0.05em]">{course.price}</p>
                        <span className="pb-2 text-sm font-bold text-white/70">đến 239k</span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-white/80">{course.pricingIntro}</p>
                    </div>

                    <div className="grid gap-3 rounded-[24px] border border-[#dbeae6] bg-white p-4">
                      {course.timeline.map((item) => (
                        <div key={item.label} className="flex gap-3 rounded-[20px] bg-[#f4faf8] px-3 py-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#dff2ea] text-sm font-black text-[#235a51]">
                            {item.label.replace('Bước ', '')}
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#2b6c61]">{item.label}</p>
                            <p className="mt-1 text-[15px] leading-7 text-slate-600">{item.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 rounded-[24px] bg-white p-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Phù hợp</p>
                      <p className="mt-2 text-base font-semibold leading-7 text-slate-700">
                        Học sinh cần mua khóa học online của nhiều thầy cô trên một giao diện rõ ràng.
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Mục tiêu</p>
                      <p className="mt-2 text-base font-semibold leading-7 text-slate-700">
                        Nhìn giá nhanh, hiểu gói nhanh và chọn được lộ trình học phù hợp ngay.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          {course.metrics.map((metric) => (
            <MetricCard key={metric.label} value={metric.value} label={metric.label} />
          ))}
        </section>

        <section className="rounded-[32px] border border-white/80 bg-white/72 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-7">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#2c7a6c]">Bảng giá ưu đãi</p>
              <h2 className="mt-2 text-3xl font-extrabold leading-tight tracking-[-0.03em] text-slate-900">
                Giá khóa học của các thầy cô được hiển thị rõ ràng
              </h2>
            </div>
            <p className="max-w-2xl text-[15px] leading-8 text-slate-600">{course.pricingIntro}</p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {course.pricingPlans.map((plan, index) => (
              <PricingCard key={plan.name} plan={plan} index={index} />
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
          <div className="rounded-[32px] border border-white/80 bg-white/72 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-7">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8f5f1] text-[#2c7a6c]">
                <span className="material-symbols-outlined">library_books</span>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[#2c7a6c]">Khung bán khóa học</p>
                <h2 className="text-2xl font-extrabold leading-tight tracking-[-0.02em] text-slate-900">
                  Thông tin gói học được sắp lại để người dùng dễ hiểu
                </h2>
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              {course.modules.map((module) => (
                <article key={module.phase} className="rounded-[28px] border border-[#e1efea] bg-[#f9fcfb] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.24em] text-[#2c7a6c]">Giai đoạn {module.phase}</p>
                      <h3 className="mt-2 text-2xl font-extrabold leading-tight tracking-[-0.02em] text-slate-900">{module.title}</h3>
                    </div>
                    <div className="rounded-full border border-[#d9ebe5] bg-white px-3 py-1 text-xs font-bold text-slate-500">
                      Khóa học trọng tâm
                    </div>
                  </div>
                  <p className="mt-3 text-[15px] leading-8 text-slate-600">{module.copy}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {module.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-[#eaf6f2] px-3 py-1 text-xs font-semibold text-[#2c7a6c]">
                        {tag}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <section className="rounded-[32px] border border-[#dcebe7] bg-[#f4fbf8] p-5 shadow-[0_18px_50px_rgba(44,122,108,0.08)]">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#2c7a6c]">Người học nhận được gì</p>
              <div className="mt-4 space-y-3">
                {course.outcomes.map((item) => (
                  <div key={item} className="flex gap-3 rounded-[22px] bg-white p-4">
                    <span className="material-symbols-outlined mt-0.5 text-[#2c7a6c]">check_circle</span>
                    <p className="text-[15px] leading-7 text-slate-600">{item}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[32px] border border-[#e5ecea] bg-white/78 p-5">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#2c7a6c]">Vì sao dễ theo dõi</p>
              <div className="mt-4 space-y-3">
                {course.surfaces.map((item) => (
                  <div key={item} className="rounded-[22px] border border-[#e5ecea] bg-[#f9fcfb] px-4 py-4 text-[15px] leading-7 text-slate-600">
                    {item}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
