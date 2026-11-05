import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { preloadRouteModule } from '../lib/routeModules';
import { getUserRank } from '../utils/rankHelper';
import { getLevelFromExp, getLevelAccent } from '../utils/levelHelper';
import Avatar from './Avatar';
import { PageSkeleton } from './ui/Skeleton';

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
  const location = useLocation();
  const { user, profile, isAdmin, isCollaborator, loading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [shouldLoadWelcomeModal, setShouldLoadWelcomeModal] = useState(false);
  const mainRef = useRef(null);

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

  const isPublicBrowseRoute = location.pathname === '/home';

  if (!loading && !user && !isPublicBrowseRoute) {
    return <Navigate to="/auth" replace />;
  }

  const userRank = getUserRank(0, profile?.role, profile?.is_approved_bang_chu);
  const lv = getLevelFromExp(profile?.exp || 0);
  const lvAccent = getLevelAccent(lv.level);

  return (
    <div className="flex h-dvh w-full bg-background font-sans text-foreground overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-paper border-r border-border no-shrink z-50">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-surface/70">
          <div className="w-10 h-10 rounded-xl bg-primary-soft border border-gold flex items-center justify-center overflow-hidden no-shrink shadow-xs">
            <img
              src="/logo.webp"
              alt="Logo"
              width={40}
              height={40}
              fetchPriority="high"
              decoding="async"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-extrabold tracking-tight font-display leading-tight text-foreground">
              Đấu Trường Học Tập
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
              Khoa Trường · 2027
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto" aria-label="Điều hướng chính">
          <SidebarLink
            to="/home"
            preloadKey="Home"
            icon="home"
            label="Trang chủ"
            currentPath={location.pathname}
          />
          <SidebarLink
            to="/gpa"
            preloadKey="GPACalculator"
            icon="calculate"
            label="Tính điểm"
            currentPath={location.pathname}
          />
          <SidebarLink
            to="/schools"
            preloadKey="SchoolFinder"
            icon="apartment"
            label="Trường phù hợp"
            currentPath={location.pathname}
          />
          <SidebarLink
            to="/roadmap"
            preloadKey="Roadmap"
            icon="timeline"
            label="Lộ trình"
            currentPath={location.pathname}
          />
          <SidebarLink
            to="/library"
            preloadKey="Library"
            icon="folder_open"
            label="Tài Liệu Học Free"
            currentPath={location.pathname}
          />
          <SidebarLink
            to="/courses/combo-dtht-hs12-2k9-chinh-phuc-dai-hoc"
            preloadKey="CourseComboHs12"
            icon="auto_stories"
            label="Các khóa học"
            currentPath={location.pathname}
          />
          <SidebarLink
            to="/hoc-online"
            preloadKey="OnlineLearning"
            icon="computer"
            label="Học online"
            currentPath={location.pathname}
          />
          <SidebarLink
            to="/arena"
            preloadKey="StudyArena"
            icon="local_fire_department"
            label="Đấu trường"
            currentPath={location.pathname}
          />
          <SidebarLink
            to="/notes"
            preloadKey="Notes"
            icon="edit_note"
            label="Ghi chú"
            currentPath={location.pathname}
          />
          {(isAdmin || profile?.role === 'admin') && (
            <SidebarLink
              to="/admin"
              preloadKey="Admin"
              icon="admin_panel_settings"
              label="Admin Panel"
              currentPath={location.pathname}
            />
          )}
          {(isCollaborator || isAdmin || profile?.role === 'admin' || profile?.role === 'collaborator') && (
            <SidebarLink
              to="/collaborator"
              preloadKey="Collaborator"
              icon="local_library"
              label="Truyền Đạo Sư"
              currentPath={location.pathname}
            />
          )}
        </nav>

        <div className="p-3 border-t border-border bg-surface/60">
          {user ? (
            <Link
              to="/profile"
              onMouseEnter={() => preloadRouteModule('Profile')}
              onFocus={() => preloadRouteModule('Profile')}
              className={`flex items-center gap-3 p-2.5 rounded-xl transition-all border ${
                location.pathname === '/profile'
                  ? 'bg-primary-soft border-primary/40 shadow-xs'
                  : 'bg-surface hover:bg-surface-alt border-border'
              }`}
            >
              <Avatar
                src={profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture}
                name={profile?.display_name || profile?.full_name || user?.user_metadata?.full_name || user?.email}
                id={user?.id}
                size="w-10 h-10"
                rounded="rounded-xl"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate text-foreground">
                  {profile?.display_name || profile?.full_name || user?.user_metadata?.full_name || 'Học viên'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded border ${userRank.bg} ${userRank.color} ${userRank.border}`}
                  >
                    <span className="material-symbols-outlined text-[11px]" aria-hidden="true">
                      {userRank.icon}
                    </span>
                    {userRank.name}
                  </span>
                  <span
                    className={`tabular inline-flex items-center text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${lvAccent.badge}`}
                    title={`${lv.expInLevel}/${lv.expForNext} EXP tới cấp tiếp theo`}
                  >
                    Cấp {lv.level}
                  </span>
                </div>
              </div>
            </Link>
          ) : (
            <Link
              to="/auth"
              className="btn-arena btn-arena-primary w-full text-sm"
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                login
              </span>
              <span>Đăng nhập / Đăng ký</span>
            </Link>
          )}
        </div>
      </aside>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-xs"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside
            id="mobile-main-menu"
            className="safe-top animate-page-in absolute left-0 top-0 bottom-0 flex w-72 flex-col border-r border-border bg-paper shadow-xl"
            aria-label="Menu chính"
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border bg-surface">
              <div className="flex flex-col">
                <h2 className="font-display text-lg font-extrabold uppercase leading-none tracking-tight text-primary">
                  Đấu Trường
                </h2>
                <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.24em] text-accent">
                  Học Tập · 2027
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-alt border border-border text-foreground active:bg-surface-hover cursor-pointer"
                aria-label="Đóng menu"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <nav
              className="scroll-touch flex-1 space-y-1 overflow-y-auto px-3 py-3"
              onClick={(event) => {
                if (event.target instanceof Element && event.target.closest('a')) {
                  setIsMobileMenuOpen(false);
                }
              }}
            >
              <SidebarLink to="/home" preloadKey="Home" icon="home" label="Trang chủ" currentPath={location.pathname} />
              <SidebarLink to="/gpa" preloadKey="GPACalculator" icon="calculate" label="Tính điểm" currentPath={location.pathname} />
              <SidebarLink to="/schools" preloadKey="SchoolFinder" icon="apartment" label="Trường phù hợp" currentPath={location.pathname} />
              <SidebarLink to="/roadmap" preloadKey="Roadmap" icon="timeline" label="Lộ trình" currentPath={location.pathname} />
              <SidebarLink to="/library" preloadKey="Library" icon="folder_open" label="Tài Liệu Học Free" currentPath={location.pathname} />
              <SidebarLink
                to="/courses/combo-dtht-hs12-2k9-chinh-phuc-dai-hoc"
                preloadKey="CourseComboHs12"
                icon="auto_stories"
                label="Các khóa học"
                currentPath={location.pathname}
              />
              <SidebarLink to="/hoc-online" preloadKey="OnlineLearning" icon="computer" label="Học online" currentPath={location.pathname} />
              <SidebarLink to="/arena" preloadKey="StudyArena" icon="local_fire_department" label="Đấu trường" currentPath={location.pathname} />
              <SidebarLink to="/notes" preloadKey="Notes" icon="edit_note" label="Ghi chú" currentPath={location.pathname} />
              {(isAdmin || profile?.role === 'admin') && (
                <SidebarLink to="/admin" preloadKey="Admin" icon="admin_panel_settings" label="Admin Panel" currentPath={location.pathname} />
              )}
              {(isCollaborator || isAdmin || profile?.role === 'admin' || profile?.role === 'collaborator') && (
                <SidebarLink to="/collaborator" preloadKey="Collaborator" icon="local_library" label="Truyền Đạo Sư" currentPath={location.pathname} />
              )}
            </nav>

            <div className="px-3 pb-4 pt-2 border-t border-border bg-surface pb-safe">
              <Link
                to={user ? '/profile' : '/auth'}
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl bg-surface-alt border border-border px-4 py-3 transition-colors active:bg-surface-hover"
              >
                <Avatar
                  src={profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture}
                  name={profile?.display_name || profile?.full_name || user?.user_metadata?.full_name || 'Cá nhân'}
                  id={user?.id}
                  size="w-8 h-8"
                  rounded="rounded-full"
                />
                <span className="truncate text-sm font-bold text-foreground">
                  {profile?.display_name || profile?.full_name || user?.user_metadata?.full_name || 'Cá nhân'}
                </span>
              </Link>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Mobile Top Navigation Bar */}
        <header className="safe-top md:hidden flex items-center justify-between px-4 py-2.5 bg-paper/95 backdrop-blur-md border-b border-border z-40 no-shrink">
          <Link
            to="/home"
            onMouseEnter={() => preloadRouteModule('Home')}
            onFocus={() => preloadRouteModule('Home')}
            className="flex items-center gap-2.5"
          >
            <img
              src="/logo.webp"
              alt="Đấu Trường Học Tập"
              width={32}
              height={32}
              fetchPriority="high"
              decoding="async"
              className="w-8 h-8 rounded-lg object-cover border border-gold"
            />
            <span className="font-extrabold text-sm tracking-tight font-display text-primary">
              Đấu Trường Học Tập
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-alt border border-border text-foreground transition-colors active:bg-surface-hover cursor-pointer"
            aria-label="Menu"
            aria-controls="mobile-main-menu"
            aria-expanded={isMobileMenuOpen}
          >
            <span className="material-symbols-outlined text-xl">menu</span>
          </button>
        </header>

        <main
          ref={mainRef}
          className="has-bottom-nav flex-1 overflow-y-auto pb-20 md:pb-0 relative"
        >
          <Outlet />
          {shouldLoadWelcomeModal ? (
            <Suspense fallback={null}>
              <WelcomeModal />
            </Suspense>
          ) : null}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav
          className="safe-bottom md:hidden fixed bottom-0 left-0 right-0 bg-paper/95 backdrop-blur-md border-t border-border px-2 pt-1.5 z-50"
          aria-label="Điều hướng di động"
        >
          <div className="flex justify-around items-center max-w-md mx-auto">
            <MobileNavLink
              to="/home"
              preloadKey="Home"
              icon="home"
              label="Trang chủ"
              currentPath={location.pathname}
            />
            <MobileNavLink
              to="/gpa"
              preloadKey="GPACalculator"
              icon="calculate"
              label="Tính điểm"
              currentPath={location.pathname}
            />
            <MobileNavLink
              to="/arena"
              preloadKey="StudyArena"
              icon="local_fire_department"
              label="Đấu trường"
              currentPath={location.pathname}
            />
            <MobileNavLink
              to={user ? '/profile' : '/auth'}
              preloadKey={user ? 'Profile' : undefined}
              icon={user ? 'person' : 'login'}
              label={user ? 'Cá nhân' : 'Cá nhân'}
              currentPath={location.pathname}
            />
          </div>
        </nav>
      </div>
    </div>
  );
}

function SidebarLink({ to, preloadKey, icon, label, currentPath }) {
  const isActive = currentPath === to || (to !== '/home' && currentPath.startsWith(`${to}/`));
  const warmUpRoute = () => preloadKey && preloadRouteModule(preloadKey);

  return (
    <Link
      to={to}
      onMouseEnter={warmUpRoute}
      onFocus={warmUpRoute}
      aria-current={isActive ? 'page' : undefined}
      className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all border ${
        isActive
          ? 'bg-primary text-on-primary border-primary-hover shadow-xs font-bold'
          : 'border-transparent text-secondary-text hover:bg-surface-alt hover:text-foreground hover:border-border'
      }`}
    >
      <span
        aria-hidden="true"
        className={`material-symbols-outlined text-xl transition-transform ${
          isActive ? 'icon-fill text-white scale-105' : 'text-accent group-hover:text-primary'
        }`}
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

function MobileNavLink({ to, preloadKey, icon, label, currentPath }) {
  const isActive = currentPath === to || (to !== '/home' && currentPath.startsWith(`${to}/`));
  const warmUpRoute = () => preloadKey && preloadRouteModule(preloadKey);

  return (
    <Link
      to={to}
      onMouseEnter={warmUpRoute}
      onFocus={warmUpRoute}
      onTouchStart={warmUpRoute}
      aria-current={isActive ? 'page' : undefined}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition-colors min-h-[44px] ${
        isActive ? 'text-primary font-bold' : 'text-secondary-text hover:text-foreground'
      }`}
    >
      <div
        className={`flex h-7 w-11 items-center justify-center rounded-full transition-colors ${
          isActive ? 'bg-primary-soft border border-primary/25' : ''
        }`}
      >
        <span
          aria-hidden="true"
          className={`material-symbols-outlined text-xl ${isActive ? 'icon-fill text-primary' : ''}`}
        >
          {icon}
        </span>
      </div>
      <span className="text-[10px] tracking-tight leading-none">{label}</span>
    </Link>
  );
}
