import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import PublicFooter from './PublicFooter';

// Layout cho các trang public: không yêu cầu đăng nhập, không dùng
// RootLayout (nơi chặn chuyển hướng về /auth khi chưa có tài khoản).
// Googlebot và khách chưa đăng nhập đều đọc được đầy đủ nội dung.
export default function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-background font-sans text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-paper/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <img
              src="/logo.webp"
              alt="Đấu Trường Học Tập"
              width={36}
              height={36}
              fetchPriority="high"
              decoding="async"
              className="h-9 w-9 rounded-xl border border-gold object-cover"
            />
            <span className="font-display text-base font-extrabold tracking-tight text-primary">
              Đấu Trường Học Tập
            </span>
          </Link>

          <nav
            className="order-3 flex w-full flex-wrap items-center gap-x-5 gap-y-1 text-sm font-semibold text-secondary-text sm:order-none sm:w-auto sm:flex-1 sm:justify-center"
            aria-label="Điều hướng trang public"
          >
            <Link className="hover:text-primary" to="/">Trang chủ</Link>
            <Link className="hover:text-primary" to="/gioi-thieu">Giới thiệu</Link>
            <Link className="hover:text-primary" to="/home">Kho học liệu</Link>
            <Link className="hover:text-primary" to="/lien-he">Liên hệ</Link>
          </nav>

          <Link to="/auth" className="btn-arena btn-arena-primary btn-arena-sm ml-auto sm:ml-0">
            <span className="material-symbols-outlined text-lg" aria-hidden="true">
              login
            </span>
            <span>Đăng nhập</span>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <PublicFooter />
    </div>
  );
}
