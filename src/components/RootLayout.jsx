import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Avatar from './Avatar';

/* ───────────────────── Bottom Tab Configuration ───────────────────── */
const BOTTOM_TABS = [
  { path: '/home',      icon: 'home',           label: 'Trang chủ' },
  { path: '/exam-room', icon: 'quiz',           label: 'Phòng thi' },
  { path: '/gpa',       icon: 'calculate',      label: 'Tính điểm' },
  { path: '/arena',     icon: 'local_fire_department', label: 'Đấu trường' },
  { path: '/profile',   icon: 'person',         label: 'Cá nhân' },
];

const WelcomeModal = lazy(() => import('./WelcomeModal'));

const scheduleIdleTask = (callback, timeout = 1800) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  if ('requestIdleCallback' in window) {
    const idleId = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback(idleId);
  }

  const timerId = window.setTimeout(callback, Math.min(timeout, 1000));
  return () => window.clearTimeout(timerId);
};

export default function RootLayout() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [shouldLoadWelcomeModal, setShouldLoadWelcomeModal] = useState(false);
  const mainRef = useRef(null);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Scroll main content to top on route change
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  if (!user) {
    return <Navigate to="/auth" />;
  }

  const isActive = (path) => location.pathname === path;
  const isExamTakingRoute = /^\/exam\/[^/]+\/[^/]+$/.test(location.pathname);

  useEffect(() => {
    if (isExamTakingRoute) {
      return undefined;
    }

    const cleanup = scheduleIdleTask(() => setShouldLoadWelcomeModal(true));
    return cleanup;
  }, [isExamTakingRoute]);

  if (isExamTakingRoute) {
    return (
      <div className="bg-[#f8f6f6] dark:bg-[#201216] font-display text-slate-900 dark:text-slate-100 h-dvh overflow-hidden">
        <main className="h-dvh overflow-hidden">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="bg-[#f8f6f6] dark:bg-[#201216] font-display text-slate-900 dark:text-slate-100 min-h-dvh selection:bg-[#e36488]/30 flex flex-col md:flex-row">

      {/* ═══════════ MOBILE TOP HEADER ═══════════ */}
      <header className="md:hidden sticky top-0 left-0 right-0 z-40 bg-[#201216]/90 backdrop-blur-xl border-b border-white/5 px-4 safe-top">
        <div className="flex items-center justify-between h-12">
          <Link to="/home" className="flex items-center gap-2">
            <img src="/logo.png" alt="ĐTHT" className="h-7 rounded-lg object-contain" />
            <span className="text-[#e36488] font-[900] text-sm tracking-tight uppercase">Đấu Trường</span>
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="w-9 h-9 flex items-center justify-center bg-white/5 rounded-xl active:bg-white/10 transition-colors"
            aria-label="Menu"
          >
            <span className="material-symbols-outlined text-xl text-slate-400">menu</span>
          </button>
        </div>
      </header>

      {/* ═══════════ MOBILE FULLSCREEN DRAWER ═══════════ */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-[#1a0f12] flex flex-col gpu safe-top animate-page-in">
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <div className="flex flex-col">
                <h2 className="text-[#e36488] font-[1000] tracking-tighter uppercase text-lg leading-none">Đấu Trường</h2>
                <span className="text-[9px] tracking-[0.2em] font-bold uppercase text-slate-500 mt-0.5">Học Tập</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-9 h-9 flex items-center justify-center bg-white/5 rounded-xl active:bg-white/10"
              >
                <span className="material-symbols-outlined text-slate-400">close</span>
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto scroll-touch px-3 py-2 space-y-1">
              <MobileNavLink to="/home" icon="home" active={isActive('/home')}>Trang chủ</MobileNavLink>
              <MobileNavLink to="/gpa" icon="calculate" active={isActive('/gpa')}>Tính điểm</MobileNavLink>
              <MobileNavLink to="/schools" icon="apartment" active={isActive('/schools')} color="blue">Trường phù hợp</MobileNavLink>
              <MobileNavLink to="/exam-room" icon="quiz" active={isActive('/exam-room')} color="blue">Phòng thi</MobileNavLink>
              <MobileNavLink to="/roadmap" icon="timeline" active={isActive('/roadmap')}>Lộ trình</MobileNavLink>
              <MobileNavLink to="/library" icon="folder_open" active={isActive('/library')}>Tài Liệu Học Free</MobileNavLink>
              <MobileNavLink to="/pricing" icon="workspace_premium" active={isActive('/pricing')}>Nâng cấp VIP</MobileNavLink>
              <MobileNavLink to="/arena" icon="local_fire_department" active={isActive('/arena')} color="orange">Đấu trường</MobileNavLink>
              <MobileNavLink to="/notes" icon="edit_note" active={isActive('/notes')} color="orange">Ghi chú</MobileNavLink>
              {profile?.role === 'admin' && (
                <MobileNavLink to="/admin" icon="admin_panel_settings" active={isActive('/admin')} color="purple">Admin Panel</MobileNavLink>
              )}
              {(profile?.role === 'admin' || profile?.role === 'collaborator') && (
                <MobileNavLink to="/collaborator" icon="local_library" active={isActive('/collaborator')} color="green">Truyền Đạo Sư</MobileNavLink>
              )}
            </nav>

            <div className="px-3 pb-4 pb-safe">
              <Link
                to="/profile"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 active:bg-white/10 transition-colors"
              >
                <Avatar
                  src={profile?.avatar_url || user?.user_metadata?.avatar_url}
                  name={profile?.display_name || user?.user_metadata?.full_name || 'Cá nhân'}
                  id={user?.id}
                  size="w-8 h-8"
                  rounded="rounded-full"
                />
                <span className="truncate text-sm font-medium text-slate-300">{profile?.display_name || user?.user_metadata?.full_name || 'Cá nhân'}</span>
              </Link>
            </div>
          </aside>
        </div>
      )}

      {/* ═══════════ DESKTOP SIDEBAR ═══════════ */}
      <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 bg-white/50 dark:bg-[#1a0f12]/80 backdrop-blur-2xl border-r border-[#e36488]/10 z-[100] p-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex flex-col">
            <h2 className="text-[#e36488] font-[1000] tracking-tighter uppercase text-xl leading-none">Đấu Trường</h2>
            <span className="text-[10px] tracking-[0.2em] font-bold uppercase text-slate-400 dark:text-slate-500 mt-1">Học Tập</span>
          </div>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          <DesktopNavLink to="/home" icon="home" active={isActive('/home')}>Trang chủ</DesktopNavLink>
          <DesktopNavLink to="/gpa" icon="calculate" active={isActive('/gpa')}>Tính điểm</DesktopNavLink>
          <DesktopNavLink to="/schools" icon="apartment" active={isActive('/schools')} color="#306ee8">Trường phù hợp</DesktopNavLink>
          <DesktopNavLink to="/exam-room" icon="quiz" active={isActive('/exam-room')} color="#3b82f6">Phòng thi</DesktopNavLink>
          <DesktopNavLink to="/roadmap" icon="timeline" active={isActive('/roadmap')}>Lộ trình</DesktopNavLink>
          <DesktopNavLink to="/library" icon="folder_open" active={isActive('/library')}>Tài Liệu Học Free</DesktopNavLink>
          <DesktopNavLink to="/pricing" icon="workspace_premium" active={isActive('/pricing')}>Nâng cấp VIP</DesktopNavLink>
          <DesktopNavLink to="/arena" icon="local_fire_department" active={isActive('/arena')} color="#fe5f36">Đấu trường</DesktopNavLink>
          <DesktopNavLink to="/notes" icon="edit_note" active={isActive('/notes')} color="#fe5f36">Ghi chú</DesktopNavLink>
          {profile?.role === 'admin' && (
            <DesktopNavLink to="/admin" icon="admin_panel_settings" active={isActive('/admin')} color="#7f13ec">Admin Panel</DesktopNavLink>
          )}
          {(profile?.role === 'admin' || profile?.role === 'collaborator') && (
            <DesktopNavLink to="/collaborator" icon="local_library" active={isActive('/collaborator')} color="#10b981">Truyền Đạo Sư</DesktopNavLink>
          )}
        </nav>

        <div className="mt-auto">
          <Link to="/profile" className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${isActive('/profile') ? 'bg-white/10 text-white font-semibold border border-white/20' : 'text-slate-500 hover:bg-white/5'}`}>
            <Avatar
              src={profile?.avatar_url || user?.user_metadata?.avatar_url}
              name={profile?.display_name || user?.user_metadata?.full_name || 'Cá nhân'}
              id={user?.id}
              size="w-8 h-8"
              rounded="rounded-full"
            />
            <span className="truncate">{profile?.display_name || user?.user_metadata?.full_name || 'Cá nhân'}</span>
          </Link>
        </div>
      </aside>

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <main
        ref={mainRef}
        className="flex-1 md:ml-64 relative min-h-dvh has-bottom-nav md:pb-0 animate-page-in"
      >
        <Outlet />
        {shouldLoadWelcomeModal ? (
          <Suspense fallback={null}>
            <WelcomeModal />
          </Suspense>
        ) : null}
      </main>

      {/* ═══════════ MOBILE BOTTOM TAB BAR ═══════════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#1a0f12]/95 backdrop-blur-xl border-t border-white/5 safe-bottom">
        <div className="flex items-center justify-around h-16 px-1">
          {BOTTOM_TABS.map((tab) => {
            const active = isActive(tab.path);
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-xl transition-all active:scale-95 ${
                  active ? 'text-[#e36488]' : 'text-slate-500'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[22px] transition-all ${active ? 'scale-110' : ''}`}
                  style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {tab.icon}
                </span>
                <span className={`text-[10px] font-semibold leading-none ${active ? 'text-[#e36488]' : 'text-slate-600'}`}>
                  {tab.label}
                </span>
                {active && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2 w-5 h-0.5 bg-[#e36488] rounded-full" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/* ═══════════ Navigation Link Components ═══════════ */

function MobileNavLink({ to, icon, active, color = 'pink', children }) {
  const colorMap = {
    pink: { bg: 'bg-[#e36488]', shadow: 'shadow-[#e36488]/20', hover: 'hover:bg-[#e36488]/10 hover:text-[#e36488]', text: 'text-[#e36488]' },
    blue: { bg: 'bg-[#3b82f6]', shadow: 'shadow-[#3b82f6]/20', hover: 'hover:bg-[#3b82f6]/10 hover:text-[#3b82f6]', text: 'text-[#3b82f6]' },
    orange: { bg: 'bg-[#fe5f36]', shadow: 'shadow-[#fe5f36]/20', hover: 'hover:bg-[#fe5f36]/10 hover:text-[#fe5f36]', text: 'text-[#fe5f36]' },
    purple: { bg: 'bg-[#7f13ec]', shadow: 'shadow-[#7f13ec]/20', hover: 'hover:bg-[#7f13ec]/10 hover:text-[#7f13ec]', text: 'text-[#7f13ec]' },
    green: { bg: 'bg-[#10b981]', shadow: 'shadow-[#10b981]/20', hover: 'hover:bg-[#10b981]/10 hover:text-[#10b981]', text: 'text-[#10b981]' },
  };
  const c = colorMap[color] || colorMap.pink;

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all active:scale-[0.97] ${
        active
          ? `${c.bg} text-white shadow-lg ${c.shadow} font-semibold`
          : `text-slate-400 ${c.hover} active:bg-white/5`
      }`}
    >
      <span
        className="material-symbols-outlined text-xl"
        style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
      >
        {icon}
      </span>
      <span className="text-sm">{children}</span>
    </Link>
  );
}

function DesktopNavLink({ to, icon, active, color = '#e36488', children }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
        active
          ? `bg-[${color}] text-white shadow-lg shadow-[${color}]/20 font-semibold`
          : `text-slate-500 hover:bg-[${color}]/10 hover:text-[${color}]`
      }`}
      style={active ? { backgroundColor: color, boxShadow: `0 10px 15px -3px ${color}33` } : undefined}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
      >
        {icon}
      </span>
      {children}
    </Link>
  );
}
