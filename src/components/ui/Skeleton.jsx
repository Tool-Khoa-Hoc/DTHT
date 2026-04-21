import React from 'react';

/**
 * Atomic Skeleton — building block cho tất cả skeleton
 * Luôn có aspect-ratio cố định nếu truyền vào để tránh CLS
 */
export default function Skeleton({ className = '', aspectRatio }) {
  return (
    <div
      className={`animate-pulse bg-slate-800/80 rounded-md ${className}`}
      style={aspectRatio ? { aspectRatio } : undefined}
      aria-hidden="true"
    />
  );
}

/**
 * PageSkeleton — fallback cho <Suspense> bao toàn bộ page
 *
 * TASK 2 — Chống CLS:
 * 1. `min-h-dvh` = 100dvh → chiều cao toàn màn hình,
 *    tránh layout shift khi content thực mount vào chiếm diện tích.
 * 2. Tất cả skeleton card dùng `aspect-ratio` cố định thay vì
 *    height tùy tiện → browser biết trước kích thước.
 * 3. Layout giống RootLayout (sidebar + main) để không bị nhảy.
 */
export function PageSkeleton() {
  return (
    <div
      className="flex min-h-dvh w-full bg-[#0f0a0c]"
      aria-busy="true"
      aria-label="Đang tải..."
    >
      {/* ── Desktop Sidebar placeholder (w-64 = 256px, khớp RootLayout) ── */}
      <div className="hidden md:flex w-64 shrink-0 h-screen sticky top-0 flex-col gap-3 p-6 border-r border-white/5">
        {/* Logo area */}
        <Skeleton className="w-32 h-7 rounded-lg mb-5" />
        {/* Nav links */}
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-11 rounded-xl" />
        ))}
        {/* Avatar at bottom */}
        <div className="mt-auto flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-full shrink-0" aspectRatio="1/1" />
          <Skeleton className="flex-1 h-4 rounded-md" />
        </div>
      </div>

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col min-h-dvh overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between px-4 h-12 border-b border-white/5 shrink-0">
          <Skeleton className="w-28 h-7 rounded-lg" />
          <Skeleton className="w-9 h-9 rounded-xl" aspectRatio="1/1" />
        </div>

        {/* Page content skeleton */}
        <div className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col gap-6">
          {/* Heading block */}
          <div className="flex flex-col gap-3">
            <Skeleton className="w-3/4 h-9 rounded-xl" />
            <Skeleton className="w-1/2 h-5 rounded-lg" />
          </div>

          {/* Card grid — aspect-ratio 4/3 cố định → không CLS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="w-full rounded-2xl" aspectRatio="4/3" />
            ))}
          </div>
        </div>

        {/* Mobile bottom nav placeholder (h-16 = khớp BottomTabBar) */}
        <div className="md:hidden h-16 shrink-0 border-t border-white/5" />
      </div>
    </div>
  );
}

/**
 * CardSkeleton — dùng cho các card trong danh sách đề thi, phòng thi
 * Aspect ratio 4/3 = tỷ lệ chuẩn cho card ngang
 */
export function CardSkeleton({ className = '' }) {
  return (
    <div className={`flex flex-col gap-3 rounded-2xl p-4 bg-slate-900/60 ${className}`}>
      <Skeleton className="w-full rounded-xl" aspectRatio="2/1" />
      <Skeleton className="w-3/4 h-5 rounded-md" />
      <Skeleton className="w-1/2 h-4 rounded-md" />
      <div className="mt-auto flex items-center gap-2 pt-2">
        <Skeleton className="w-8 h-8 rounded-full" aspectRatio="1/1" />
        <Skeleton className="flex-1 h-4 rounded-md" />
      </div>
    </div>
  );
}

/**
 * ExamResultSkeleton — dùng khi ExamResult page đang load
 * Split-pane layout: PDF viewer (left 68%) + answer panel (right 32%)
 */
export function ExamResultSkeleton() {
  return (
    <div className="flex min-h-dvh w-full bg-[#0f0a0c] gap-0" aria-busy="true">
      {/* PDF area placeholder */}
      <div className="flex-[2] p-4 flex flex-col gap-4">
        <Skeleton className="w-full rounded-2xl" aspectRatio="1/1.414" /> {/* A4 ratio */}
      </div>
      {/* Answer sheet placeholder */}
      <div className="w-80 shrink-0 flex flex-col gap-3 p-4 border-l border-white/5">
        <Skeleton className="w-full h-8 rounded-xl" />
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="w-7 h-7 rounded-full shrink-0" aspectRatio="1/1" />
            <div className="flex gap-2 flex-1">
              {['A', 'B', 'C', 'D'].map((l) => (
                <Skeleton key={l} className="flex-1 h-7 rounded-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
