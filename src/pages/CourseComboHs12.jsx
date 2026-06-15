import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { comboHs12Course } from '../content/courseCatalog';

const packageVisuals = [
  {
    surface: 'bg-white',
    border: 'border-[#b9e6d7]',
    iconBox: 'bg-[#e4f7f0] text-[#087f5b]',
    active: 'border-[#087f5b] bg-[#f2fbf7] shadow-[0_18px_45px_rgba(8,127,91,0.14)]',
    bar: 'bg-[#087f5b]',
  },
  {
    surface: 'bg-white',
    border: 'border-[#c7e1f4]',
    iconBox: 'bg-[#e8f4fd] text-[#2563eb]',
    active: 'border-[#2563eb] bg-[#f4f9ff] shadow-[0_18px_45px_rgba(37,99,235,0.12)]',
    bar: 'bg-[#2563eb]',
  },
  {
    surface: 'bg-white',
    border: 'border-[#f3d7a4]',
    iconBox: 'bg-[#fff4d8] text-[#b7791f]',
    active: 'border-[#d89b24] bg-[#fffaf0] shadow-[0_18px_45px_rgba(216,155,36,0.15)]',
    bar: 'bg-[#d89b24]',
  },
  {
    surface: 'bg-white',
    border: 'border-[#c6e8e1]',
    iconBox: 'bg-[#e7f8f5] text-[#0f766e]',
    active: 'border-[#0f766e] bg-[#f1fbf9] shadow-[0_18px_45px_rgba(15,118,110,0.13)]',
    bar: 'bg-[#0f766e]',
  },
  {
    surface: 'bg-white',
    border: 'border-[#d9d5fb]',
    iconBox: 'bg-[#f0efff] text-[#5b48c8]',
    active: 'border-[#5b48c8] bg-[#f8f7ff] shadow-[0_18px_45px_rgba(91,72,200,0.13)]',
    bar: 'bg-[#5b48c8]',
  },
];

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

function MetricCard({ value, label }) {
  return (
    <div className="rounded-lg border border-[#dbe9e4] bg-white px-4 py-4 shadow-[0_12px_28px_rgba(34,73,64,0.06)]">
      <p className="text-2xl font-black text-[#143c34]">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase text-slate-500">{label}</p>
    </div>
  );
}

function TagList({ tags }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span key={tag} className="rounded-md border border-[#d9ebe5] bg-white px-2.5 py-1 text-xs font-bold text-slate-600">
          {tag}
        </span>
      ))}
    </div>
  );
}

function PackageNavigator({ packages, selectedId, onSelect }) {
  const selectedPackage = packages.find((item) => item.id === selectedId) ?? packages[0];

  return (
    <aside className="rounded-lg border border-[#d7e8e2] bg-white p-4 shadow-[0_24px_70px_rgba(29,78,74,0.12)] md:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black leading-tight text-[#143c34]">Bộ chọn gói học</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Chọn một gói để xem mục tiêu học phù hợp và phạm vi học nên bắt đầu.
          </p>
        </div>
        <img src="/logo.webp" alt="" className="h-11 w-11 rounded-lg object-contain" loading="lazy" />
      </div>

      <div className="mt-5 grid gap-2.5">
        {packages.map((item, index) => {
          const visual = packageVisuals[index] ?? packageVisuals[0];
          const active = item.id === selectedId;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                'group flex min-h-[78px] w-full items-center gap-3 rounded-lg border p-3 text-left transition-all hover:-translate-y-0.5 hover:border-[#087f5b]',
                visual.surface,
                visual.border,
                active && visual.active,
              )}
              aria-pressed={active}
            >
              <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-md', visual.iconBox)}>
                <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-black uppercase text-slate-500">{item.label}</span>
                <span className="mt-1 block text-base font-black leading-snug text-[#143c34]">{item.name}</span>
                <span className="mt-1 block text-sm leading-5 text-slate-500">{item.subtitle}</span>
              </span>
              <span className="material-symbols-outlined text-[20px] text-slate-400 transition-transform group-hover:translate-x-0.5">
                arrow_forward
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-lg border border-[#dbe9e4] bg-[#f7fbf8] p-4">
        <p className="text-xs font-black uppercase text-[#087f5b]">Đang chọn</p>
        <h3 className="mt-2 text-lg font-black leading-snug text-[#143c34]">{selectedPackage.name}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{selectedPackage.goal}</p>
      </div>
    </aside>
  );
}

function PackageCard({ item, index, active, onSelect }) {
  const visual = packageVisuals[index] ?? packageVisuals[0];

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className={cn(
        'group relative flex min-h-[300px] flex-col rounded-lg border bg-white p-5 text-left transition-all hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(34,73,64,0.1)]',
        visual.border,
        active && visual.active,
      )}
      aria-pressed={active}
    >
      <span className={cn('absolute inset-x-0 top-0 h-1.5 rounded-t-lg', visual.bar)} />
      <div className="flex items-start justify-between gap-3">
        <span className={cn('flex h-12 w-12 items-center justify-center rounded-md', visual.iconBox)}>
          <span className="material-symbols-outlined text-[24px]">{item.icon}</span>
        </span>
        <span className="rounded-md bg-[#eef7f3] px-2.5 py-1 text-xs font-black uppercase text-[#087f5b]">
          {item.label}
        </span>
      </div>
      <h3 className="mt-5 text-xl font-black leading-tight text-[#143c34]">{item.name}</h3>
      <p className="mt-2 text-sm font-bold leading-6 text-slate-500">{item.subtitle}</p>
      <p className="mt-4 flex-1 text-sm leading-7 text-slate-600">{item.bestFor}</p>
      <div className="mt-5">
        <TagList tags={item.tags} />
      </div>
      <span className="mt-5 inline-flex items-center gap-1 text-sm font-black text-[#087f5b]">
        Xem gợi ý
        <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-0.5">arrow_forward</span>
      </span>
    </button>
  );
}

export default function CourseComboHs12() {
  const course = comboHs12Course;
  const [selectedPackageId, setSelectedPackageId] = useState(course.learningPackages[0]?.id);
  const selectedPackage = course.learningPackages.find((item) => item.id === selectedPackageId) ?? course.learningPackages[0];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fbfefd_0%,#eef8f3_48%,#f9fbff_100%)] pb-24 font-display text-slate-900">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-6 md:py-10">
        <section className="grid gap-8 py-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-black leading-[1.08] text-[#102f2a] sm:text-5xl">
              {course.title}
            </h1>
            <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-slate-700">
              {course.subtitle}
            </p>
            <p className="mt-4 max-w-2xl text-[15px] leading-8 text-slate-600">
              {course.summary}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {course.highlights.map((item) => (
                <div key={item} className="flex min-h-[104px] gap-3 rounded-lg border border-[#dbe9e4] bg-white px-4 py-4 shadow-[0_12px_28px_rgba(34,73,64,0.05)]">
                  <span className="material-symbols-outlined mt-0.5 text-[22px] text-[#087f5b]">check_circle</span>
                  <p className="text-sm font-semibold leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/roadmap"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#087f5b] px-5 text-sm font-black text-white shadow-[0_14px_34px_rgba(8,127,91,0.2)] transition-all hover:-translate-y-0.5 hover:bg-[#066b4d]"
              >
                <span className="material-symbols-outlined text-[20px]">timeline</span>
                Xem lộ trình học
              </Link>
              <Link
                to="/library"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#cddfd9] bg-white px-5 text-sm font-black text-[#143c34] transition-all hover:-translate-y-0.5 hover:border-[#087f5b]"
              >
                <span className="material-symbols-outlined text-[20px]">folder_open</span>
                Mở thư viện free
              </Link>
            </div>
          </div>

          <PackageNavigator
            packages={course.learningPackages}
            selectedId={selectedPackage.id}
            onSelect={setSelectedPackageId}
          />
        </section>

        <section className="grid gap-3 md:grid-cols-4" aria-label="Thông tin tổng quan khóa học">
          {course.metrics.map((metric) => (
            <MetricCard key={metric.label} value={metric.value} label={metric.label} />
          ))}
        </section>

        <section className="py-4" aria-labelledby="package-map-title">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 id="package-map-title" className="text-3xl font-black leading-tight text-[#102f2a]">
                Chọn gói theo mục tiêu học
              </h2>
              <p className="mt-3 max-w-2xl text-[15px] leading-8 text-slate-600">{course.packageIntro}</p>
            </div>
            <div className="rounded-lg border border-[#dbe9e4] bg-white px-4 py-3 text-sm font-bold leading-6 text-slate-600 shadow-[0_12px_30px_rgba(34,73,64,0.06)]">
              Tập trung vào phạm vi học, mục tiêu phù hợp và bước tiếp theo.
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {course.learningPackages.map((item, index) => (
              <PackageCard
                key={item.id}
                item={item}
                index={index}
                active={item.id === selectedPackage.id}
                onSelect={setSelectedPackageId}
              />
            ))}
          </div>

          <div className="mt-6 grid gap-4 rounded-lg border border-[#d5e8e1] bg-[#143c34] p-5 text-white shadow-[0_22px_60px_rgba(20,60,52,0.16)] md:grid-cols-[minmax(0,1fr)_minmax(260px,0.55fr)] md:p-6">
            <div>
              <p className="text-xs font-black uppercase text-white/65">{selectedPackage.label} đang được xem</p>
              <h3 className="mt-2 text-2xl font-black leading-tight">{selectedPackage.name}</h3>
              <p className="mt-3 text-[15px] leading-8 text-white/78">{selectedPackage.goal}</p>
            </div>
            <div className="rounded-lg bg-white/10 p-4">
              <p className="text-xs font-black uppercase text-white/65">Gợi ý hành động</p>
              <p className="mt-2 text-base font-bold leading-7 text-white">{selectedPackage.action}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(280px,0.88fr)]">
          <div className="rounded-lg border border-[#dbe9e4] bg-white p-5 shadow-[0_18px_48px_rgba(34,73,64,0.07)] md:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#e4f7f0] text-[#087f5b]">
                <span className="material-symbols-outlined">route</span>
              </div>
              <div>
                <h2 className="text-2xl font-black leading-tight text-[#102f2a]">
                  Lộ trình chọn gói gọn hơn
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Đi từ nhu cầu nhỏ đến mục tiêu lớn để học sinh không bị rối khi chọn khóa.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              {course.modules.map((module) => (
                <article key={module.phase} className="grid gap-4 rounded-lg border border-[#e0ece7] bg-[#f8fcfa] p-5 sm:grid-cols-[72px_1fr]">
                  <div className="flex h-14 w-14 items-center justify-center rounded-md bg-white text-xl font-black text-[#087f5b] shadow-[0_10px_26px_rgba(34,73,64,0.08)]">
                    {module.phase}
                  </div>
                  <div>
                    <h3 className="text-xl font-black leading-tight text-[#143c34]">{module.title}</h3>
                    <p className="mt-3 text-[15px] leading-8 text-slate-600">{module.copy}</p>
                    <div className="mt-4">
                      <TagList tags={module.tags} />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-5">
            <section className="rounded-lg border border-[#dbe9e4] bg-white p-5 shadow-[0_18px_48px_rgba(34,73,64,0.07)]">
              <h2 className="text-xl font-black text-[#102f2a]">Người học nhận được gì</h2>
              <div className="mt-4 space-y-3">
                {course.outcomes.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-lg border border-[#e0ece7] bg-[#f8fcfa] p-4">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#087f5b]/12 text-[#087f5b]">
                      <span
                        className="material-symbols-outlined block text-[18px] leading-none"
                        style={{ fontVariationSettings: "'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 20" }}
                      >
                        done
                      </span>
                    </span>
                    <p className="text-[15px] leading-7 text-slate-600">{item}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-[#dbe9e4] bg-[#f5fbf8] p-5">
              <h2 className="text-xl font-black text-[#102f2a]">Vì sao dễ theo dõi</h2>
              <div className="mt-4 space-y-3">
                {course.surfaces.map((item) => (
                  <div key={item} className="rounded-lg border border-[#dbe9e4] bg-white px-4 py-4 text-[15px] leading-7 text-slate-600">
                    {item}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
