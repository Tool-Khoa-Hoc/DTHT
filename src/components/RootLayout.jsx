import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Avatar from './Avatar';
import OptimizedImage from './ui/OptimizedImage';
import { PageSkeleton } from './ui/Skeleton';
import { preloadRouteModule } from '../lib/routeModules';

const BOTTOM_TABS = [
  { path: '/home', icon: 'home', label: 'Trang chủ' },
  { path: '/gpa', icon: 'calculate', label: 'Tính điểm' },
  { path: '/arena', icon: 'local_fire_department', label: 'Đấu trường' },
  { path: '/profile', icon: 'person', label: 'Cá nhân' },
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
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [shouldLoadWelcomeModal, setShouldLoadWelcomeModal] = useState(false);
  const mainRef = useRef(null);
  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIsMobileMenuOpen(false);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [location.pathname]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  useEffect(() => {
    const cleanup = scheduleIdleTask(() => setShouldLoadWelcomeModal(true));
    return cleanup;
  }, []);

  if (loading && !user) {
    return <PageSkeleton />;
  }

  // Cho phép xem trang Home mà không cần login
  const isPublicRoute = location.pathname === '/home';

  if (!loading && !user && !isPublicRoute) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#f8f6f6] font-display text-slate-900 selection:bg-[#e36488]/30 md:flex-row dark:bg-[#201216] dark:text-slate-100">
      <header className="safe-top sticky left-0 right-0 top-0 z-40 border-b border-white/5 bg-[#201216]/90 px-4 backdrop-blur-xl md:hidden">
        <div className="flex h-12 items-center justify-between">
          <NavBrand />
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 transition-colors active:bg-white/10"
            aria-label="Menu"
            aria-controls="mobile-main-menu"
            aria-expanded={isMobileMenuOpen}
          >
            <span className="material-symbols-outlined text-xl text-slate-400">menu</span>
          </button>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside
            id="mobile-main-menu"
            className="safe-top gpu animate-page-in absolute left-0 top-0 bottom-0 flex w-72 flex-col bg-[#1a0f12]"
            aria-label="Menu chính"
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <div className="flex flex-col">
                <h2 className="text-lg font-[1000] uppercase leading-none tracking-tighter text-[#e36488]">Đấu Trường</h2>
                <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Học Tập</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 active:bg-white/10"
                aria-label="Đóng menu"
              >
                <span className="material-symbols-outlined text-slate-400">close</span>
              </button>
            </div>

            <nav
              className="scroll-touch flex-1 space-y-1 overflow-y-auto px-3 py-2"
              onClick={(event) => {
                if (event.target instanceof Element && event.target.closest('a')) {
                  setIsMobileMenuOpen(false);
                }
              }}
            >
              <MobileNavLink to="/home" icon="home" active={isActive('/home')} routeModuleKey="Home">Trang chủ</MobileNavLink>
              <MobileNavLink to="/gpa" icon="calculate" active={isActive('/gpa')} routeModuleKey="GPACalculator">Tính điểm</MobileNavLink>
              <MobileNavLink to="/schools" icon="apartment" active={isActive('/schools')} color="blue" routeModuleKey="SchoolFinder">Trường phù hợp</MobileNavLink>
              <MobileNavLink to="/roadmap" icon="timeline" active={isActive('/roadmap')} routeModuleKey="Roadmap">Lộ trình</MobileNavLink>
              <MobileNavLink to="/library" icon="folder_open" active={isActive('/library')} routeModuleKey="Library">Tài Liệu Học Free</MobileNavLink>
              <MobileNavLink
                to="/courses/combo-dtht-hs12-2k9-chinh-phuc-dai-hoc"
                icon="auto_stories"
                active={isActive('/courses/combo-dtht-hs12-2k9-chinh-phuc-dai-hoc')}
                color="orange"
                routeModuleKey="CourseComboHs12"
              >
                Các khóa học
              </MobileNavLink>
              <MobileNavLink to="/hoc-online" icon="cast_for_education" active={isActive('/hoc-online')} color="green" routeModuleKey="OnlineLearning">Học online</MobileNavLink>
              <MobileNavLink to="/arena" icon="local_fire_department" active={isActive('/arena')} color="orange" routeModuleKey="StudyArena">Đấu trường</MobileNavLink>
              <MobileNavLink to="/notes" icon="edit_note" active={isActive('/notes')} color="orange" routeModuleKey="Notes">Ghi chú</MobileNavLink>
              {profile?.role === 'admin' && (
                <MobileNavLink to="/admin" icon="admin_panel_settings" active={isActive('/admin')} color="purple" routeModuleKey="Admin">Admin Panel</MobileNavLink>
              )}
              {(profile?.role === 'admin' || profile?.role === 'collaborator') && (
                <MobileNavLink to="/collaborator" icon="local_library" active={isActive('/collaborator')} color="green" routeModuleKey="Collaborator">Truyền Đạo Sư</MobileNavLink>
              )}
            </nav>

            <div className="px-3 pb-4 pb-safe">
              <Link
                to="/profile"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 transition-colors active:bg-white/10"
              >
                <Avatar
                  src={profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture}
                  name={profile?.display_name || user?.user_metadata?.full_name || 'Cá nhân'}
                  id={user?.id}
                  size="w-8 h-8"
                  rounded="rounded-full"
                />
                <span className="truncate text-sm font-medium text-slate-300">
                  {profile?.display_name || user?.user_metadata?.full_name || 'Cá nhân'}
                </span>
              </Link>
            </div>
          </aside>
        </div>
      )}

      <aside className="fixed left-0 top-0 z-[100] hidden h-screen w-64 flex-col border-r border-[#e36488]/10 bg-white/50 p-6 backdrop-blur-2xl md:flex dark:bg-[#1a0f12]/80">
        <div className="mb-8">
          <div className="flex flex-col">
            <h2 className="text-xl font-[1000] uppercase leading-none tracking-tighter text-[#e36488]">Đấu Trường</h2>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Học Tập</span>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-2">
          <DesktopNavLink to="/home" icon="home" active={isActive('/home')} routeModuleKey="Home">Trang chủ</DesktopNavLink>
          <DesktopNavLink to="/gpa" icon="calculate" active={isActive('/gpa')} routeModuleKey="GPACalculator">Tính điểm</DesktopNavLink>
          <DesktopNavLink to="/schools" icon="apartment" active={isActive('/schools')} color="#306ee8" routeModuleKey="SchoolFinder">Trường phù hợp</DesktopNavLink>
          <DesktopNavLink to="/roadmap" icon="timeline" active={isActive('/roadmap')} routeModuleKey="Roadmap">Lộ trình</DesktopNavLink>
          <DesktopNavLink to="/library" icon="folder_open" active={isActive('/library')} routeModuleKey="Library">Tài Liệu Học Free</DesktopNavLink>
          <DesktopNavLink
            to="/courses/combo-dtht-hs12-2k9-chinh-phuc-dai-hoc"
            icon="auto_stories"
            active={isActive('/courses/combo-dtht-hs12-2k9-chinh-phuc-dai-hoc')}
            color="#fe5f36"
            routeModuleKey="CourseComboHs12"
          >
            Các khóa học
          </DesktopNavLink>
          <DesktopNavLink to="/hoc-online" icon="cast_for_education" active={isActive('/hoc-online')} color="#10b981" routeModuleKey="OnlineLearning">Học online</DesktopNavLink>
          <DesktopNavLink to="/arena" icon="local_fire_department" active={isActive('/arena')} color="#fe5f36" routeModuleKey="StudyArena">Đấu trường</DesktopNavLink>
          <DesktopNavLink to="/notes" icon="edit_note" active={isActive('/notes')} color="#fe5f36" routeModuleKey="Notes">Ghi chú</DesktopNavLink>
          {profile?.role === 'admin' && (
            <DesktopNavLink to="/admin" icon="admin_panel_settings" active={isActive('/admin')} color="#7f13ec" routeModuleKey="Admin">Admin Panel</DesktopNavLink>
          )}
          {(profile?.role === 'admin' || profile?.role === 'collaborator') && (
            <DesktopNavLink to="/collaborator" icon="local_library" active={isActive('/collaborator')} color="#10b981" routeModuleKey="Collaborator">Truyền Đạo Sư</DesktopNavLink>
          )}
        </nav>

        <div className="mt-auto">
          <Link
            to="/profile"
            className={`flex items-center gap-4 rounded-xl px-4 py-3 transition-all ${
              isActive('/profile')
                ? 'border border-white/20 bg-white/10 font-semibold text-white'
                : 'text-slate-500 hover:bg-white/5'
            }`}
          >
            <Avatar
              src={profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture}
              name={profile?.display_name || user?.user_metadata?.full_name || 'Cá nhân'}
              id={user?.id}
              size="w-8 h-8"
              rounded="rounded-full"
            />
            <span className="truncate">{profile?.display_name || user?.user_metadata?.full_name || 'Cá nhân'}</span>
          </Link>
        </div>
      </aside>

      <main
        ref={mainRef}
        className="has-bottom-nav relative min-h-dvh flex-1 md:ml-64 md:pb-0"
      >
        <Outlet />
        {shouldLoadWelcomeModal ? (
          <Suspense fallback={null}>
            <WelcomeModal />
          </Suspense>
        ) : null}
      </main>

      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-[#1a0f12]/95 backdrop-blur-xl md:hidden">
        <div className="flex h-16 items-center justify-around px-1">
          {BOTTOM_TABS.map((tab) => {
            const active = isActive(tab.path);
            return (
              <Link
                key={tab.path}
                to={tab.path}
                onMouseEnter={() => preloadRouteModule(tabPrefetchKey(tab.path))}
                onFocus={() => preloadRouteModule(tabPrefetchKey(tab.path))}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 transition-all active:scale-95 ${
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
                  <div className="absolute -top-px left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-[#e36488]" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function NavBrand() {
  const handlePrefetch = () => {
    void preloadRouteModule('Home');
  };

  return (
    <Link to="/home" onMouseEnter={handlePrefetch} onFocus={handlePrefetch} className="flex items-center gap-2">
      <OptimizedImage src="/logo.webp" alt="Đấu Trường Học Tập" width={28} height={28} priority className="h-7 rounded-lg object-contain" />
      <span className="text-sm font-[900] uppercase tracking-tight text-[#e36488]">Đấu Trường</span>
    </Link>
  );
}

function tabPrefetchKey(path) {
  switch (path) {
    case '/home':
      return 'Home';
    case '/gpa':
      return 'GPACalculator';
    case '/arena':
      return 'StudyArena';
    case '/profile':
      return 'Profile';
    default:
      return null;
  }
}

function MobileNavLink({ to, icon, active, color = 'pink', routeModuleKey, children }) {
  const colorMap = {
    pink: { bg: 'bg-[#e36488]', shadow: 'shadow-[#e36488]/20', hover: 'hover:bg-[#e36488]/10 hover:text-[#e36488]' },
    blue: { bg: 'bg-[#3b82f6]', shadow: 'shadow-[#3b82f6]/20', hover: 'hover:bg-[#3b82f6]/10 hover:text-[#3b82f6]' },
    orange: { bg: 'bg-[#fe5f36]', shadow: 'shadow-[#fe5f36]/20', hover: 'hover:bg-[#fe5f36]/10 hover:text-[#fe5f36]' },
    purple: { bg: 'bg-[#7f13ec]', shadow: 'shadow-[#7f13ec]/20', hover: 'hover:bg-[#7f13ec]/10 hover:text-[#7f13ec]' },
    green: { bg: 'bg-[#10b981]', shadow: 'shadow-[#10b981]/20', hover: 'hover:bg-[#10b981]/10 hover:text-[#10b981]' },
  };
  const palette = colorMap[color] || colorMap.pink;
  const handlePrefetch = () => {
    if (routeModuleKey) {
      void preloadRouteModule(routeModuleKey);
    }
  };

  return (
    <Link
      to={to}
      onMouseEnter={handlePrefetch}
      onTouchStart={handlePrefetch}
      onFocus={handlePrefetch}
      className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all active:scale-[0.97] ${
        active
          ? `${palette.bg} text-white shadow-lg ${palette.shadow} font-semibold`
          : `text-slate-400 ${palette.hover} active:bg-white/5`
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

function DesktopNavLink({ to, icon, active, color = '#e36488', routeModuleKey, children }) {
  const handlePrefetch = () => {
    if (routeModuleKey) {
      void preloadRouteModule(routeModuleKey);
    }
  };

  return (
    <Link
      to={to}
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
      className={`flex items-center gap-4 rounded-xl px-4 py-3 transition-all ${
        active
          ? 'font-semibold text-white'
          : 'text-slate-500 hover:bg-white/5'
      }`}
      style={active ? { backgroundColor: color, boxShadow: `0 10px 15px -3px ${color}33` } : undefined}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0", color: active ? undefined : color }}
      >
        {icon}
      </span>
      <span
        className={active ? '' : 'transition-colors'}
        style={{ color: active ? undefined : '#64748b' }}
      >
        {children}
      </span>
    </Link>
  );
}
