import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { preloadRouteModule } from '../lib/routeModules';
import { getUserRank } from '../utils/rankHelper';
import { getLevelFromExp, getLevelAccent } from '../utils/levelHelper';
import Avatar from './Avatar';
import { PageSkeleton } from './ui/Skeleton';
import ThemeToggle from './ui/ThemeToggle';
import LanguageToggle from './ui/LanguageToggle';

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

function GoogleLinkedBadge({ label }) {
  return (
    <span
      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-surface border border-border shrink-0 shadow-2xs"
      title={label}
      aria-label={label}
    >
      <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
    </span>
  );
}

export default function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user,
    profile,
    isAdmin,
    isCollaborator,
    isGoogleLinked,
    signOut,
    loading,
  } = useAuth();
  const { lang, t } = useLanguage();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [shouldLoadWelcomeModal, setShouldLoadWelcomeModal] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
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
  const currentDestination = `${location.pathname}${location.search}`;
  const authLinkWithNext = `/auth?next=${encodeURIComponent(currentDestination)}`;

  if (!loading && !user && !isPublicBrowseRoute) {
    return <Navigate to={authLinkWithNext} replace />;
  }

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
      setIsMobileMenuOpen(false);
      navigate('/auth', { replace: true });
    } catch (err) {
      console.error('[RootLayout] Sign out error:', err);
    } finally {
      setIsSigningOut(false);
    }
  };

  const lv = getLevelFromExp(profile?.exp || 0);
  const lvAccent = getLevelAccent(lv.level);
  const userRank = getUserRank(
    lv.totalExp,
    profile?.role,
    profile?.is_approved_bang_chu,
    user?.id,
    lang,
  );
  const rankDisplayName = userRank.displayName || userRank.name;

  const displayAvatar =
    profile?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture;
  const displayName =
    profile?.display_name ||
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    t('nav.defaultScholar');

  return (
    <div className="flex h-dvh w-full bg-background font-sans text-foreground overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-paper border-r border-border shrink-0 z-50">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-surface/70">
          <div className="w-10 h-10 rounded-xl bg-primary-soft border border-gold flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
            <img
              src="/logo.webp"
              alt={t('brand.name')}
              width={40}
              height={40}
              fetchPriority="high"
              decoding="async"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-extrabold tracking-tight font-display leading-tight text-foreground truncate">
              {t('brand.name')}
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-accent truncate mt-0.5">
              {t('brand.subtitle')}
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto" aria-label={t('nav.mainAria')}>
          <SidebarLink
            to="/home"
            preloadKey="Home"
            icon="home"
            label={t('nav.home')}
            currentPath={location.pathname}
          />
          <SidebarLink
            to="/gpa"
            preloadKey="GPACalculator"
            icon="calculate"
            label={t('nav.gpa')}
            currentPath={location.pathname}
          />
          <SidebarLink
            to="/schools"
            preloadKey="SchoolFinder"
            icon="apartment"
            label={t('nav.schools')}
            currentPath={location.pathname}
          />
          <SidebarLink
            to="/roadmap"
            preloadKey="Roadmap"
            icon="timeline"
            label={t('nav.roadmap')}
            currentPath={location.pathname}
          />
          <SidebarLink
            to="/library"
            preloadKey="Library"
            icon="folder_open"
            label={t('nav.library')}
            currentPath={location.pathname}
          />
          <SidebarLink
            to="/courses/combo-dtht-hs12-2k9-chinh-phuc-dai-hoc"
            preloadKey="CourseComboHs12"
            icon="auto_stories"
            label={t('nav.courses')}
            currentPath={location.pathname}
          />
          <SidebarLink
            to="/hoc-online"
            preloadKey="OnlineLearning"
            icon="computer"
            label={t('nav.onlineLearning')}
            currentPath={location.pathname}
          />
          <SidebarLink
            to="/arena"
            preloadKey="StudyArena"
            icon="local_fire_department"
            label={t('nav.arena')}
            currentPath={location.pathname}
          />
          <SidebarLink
            to="/notes"
            preloadKey="Notes"
            icon="edit_note"
            label={t('nav.notes')}
            currentPath={location.pathname}
          />
          {isAdmin && (
            <SidebarLink
              to="/admin"
              preloadKey="Admin"
              icon="admin_panel_settings"
              label={t('nav.admin')}
              currentPath={location.pathname}
            />
          )}
          {isCollaborator && (
            <SidebarLink
              to="/collaborator"
              preloadKey="Collaborator"
              icon="local_library"
              label={t('nav.collaborator')}
              currentPath={location.pathname}
            />
          )}
        </nav>

        <div className="p-3 border-t border-border bg-surface/60 space-y-2">
          <div className="space-y-1.5">
            <ThemeToggle variant="desktop" />
            <LanguageToggle variant="segmented" />
          </div>
          {user ? (
            <div className="flex items-stretch gap-1.5">
              <Link
                to="/profile"
                onMouseEnter={() => preloadRouteModule('Profile')}
                onFocus={() => preloadRouteModule('Profile')}
                className={`flex flex-1 min-w-0 items-center gap-2.5 p-2 rounded-xl transition-all border ${
                  location.pathname === '/profile'
                    ? 'bg-primary-soft border-primary/40 shadow-xs'
                    : 'bg-surface hover:bg-surface-alt border-border'
                }`}
              >
                <Avatar
                  src={displayAvatar}
                  name={displayName}
                  id={user?.id}
                  size="w-9 h-9"
                  rounded="rounded-xl"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 min-w-0">
                    <p className="text-xs font-bold truncate text-foreground">
                      {displayName}
                    </p>
                    {isGoogleLinked && <GoogleLinkedBadge label={t('nav.googleSynced')} />}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-0.5 whitespace-nowrap text-[10px] font-bold px-1.5 py-0.5 rounded border ${userRank.bg} ${userRank.color} ${userRank.border}`}
                    >
                      <span className="material-symbols-outlined text-[11px] shrink-0" aria-hidden="true">
                        {userRank.icon}
                      </span>
                      <span className="truncate max-w-[92px]">{rankDisplayName}</span>
                    </span>
                    <span
                      className={`tabular inline-flex items-center whitespace-nowrap text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${lvAccent.badge}`}
                      title={t('nav.expToNextTitle', { current: lv.expInLevel, total: lv.expForNext })}
                    >
                      {t('nav.levelBadge', { level: lv.level })}
                    </span>
                  </div>
                </div>
              </Link>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                title={t('nav.signOut')}
                aria-label={t('nav.signOut')}
                className="flex w-10 items-center justify-center rounded-xl border border-border bg-surface text-secondary-text hover:bg-primary-soft hover:text-primary hover:border-primary/35 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                <span
                  className={`material-symbols-outlined text-lg ${isSigningOut ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                >
                  {isSigningOut ? 'progress_activity' : 'logout'}
                </span>
              </button>
            </div>
          ) : (
            <Link
              to={authLinkWithNext}
              className="btn-arena btn-arena-primary w-full text-sm"
            >
              <span className="material-symbols-outlined text-lg shrink-0" aria-hidden="true">
                login
              </span>
              <span className="truncate">{t('nav.signInRegister')}</span>
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
            aria-label={t('nav.mobileMenuAria')}
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-3.5 border-b border-border bg-surface">
              <div className="flex flex-col min-w-0">
                <h2 className="font-display text-lg font-extrabold uppercase leading-none tracking-tight text-primary truncate">
                  {t('brand.shortName')}
                </h2>
                <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-accent truncate">
                  {t('brand.mobileSub')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-alt border border-border text-foreground hover:bg-surface-hover active:bg-surface-hover cursor-pointer"
                aria-label={t('nav.closeMenu')}
              >
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
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
              <SidebarLink to="/home" preloadKey="Home" icon="home" label={t('nav.home')} currentPath={location.pathname} />
              <SidebarLink to="/gpa" preloadKey="GPACalculator" icon="calculate" label={t('nav.gpa')} currentPath={location.pathname} />
              <SidebarLink to="/schools" preloadKey="SchoolFinder" icon="apartment" label={t('nav.schools')} currentPath={location.pathname} />
              <SidebarLink to="/roadmap" preloadKey="Roadmap" icon="timeline" label={t('nav.roadmap')} currentPath={location.pathname} />
              <SidebarLink to="/library" preloadKey="Library" icon="folder_open" label={t('nav.library')} currentPath={location.pathname} />
              <SidebarLink
                to="/courses/combo-dtht-hs12-2k9-chinh-phuc-dai-hoc"
                preloadKey="CourseComboHs12"
                icon="auto_stories"
                label={t('nav.courses')}
                currentPath={location.pathname}
              />
              <SidebarLink to="/hoc-online" preloadKey="OnlineLearning" icon="computer" label={t('nav.onlineLearning')} currentPath={location.pathname} />
              <SidebarLink to="/arena" preloadKey="StudyArena" icon="local_fire_department" label={t('nav.arena')} currentPath={location.pathname} />
              <SidebarLink to="/notes" preloadKey="Notes" icon="edit_note" label={t('nav.notes')} currentPath={location.pathname} />
              {isAdmin && (
                <SidebarLink to="/admin" preloadKey="Admin" icon="admin_panel_settings" label={t('nav.admin')} currentPath={location.pathname} />
              )}
              {isCollaborator && (
                <SidebarLink to="/collaborator" preloadKey="Collaborator" icon="local_library" label={t('nav.collaborator')} currentPath={location.pathname} />
              )}
            </nav>

            <div className="px-3 pb-4 pt-2.5 border-t border-border bg-surface pb-safe space-y-2">
              <div className="space-y-1.5">
                <ThemeToggle variant="desktop" />
                <LanguageToggle variant="segmented" />
              </div>
              {user ? (
                <div className="flex items-stretch gap-1.5">
                  <Link
                    to="/profile"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex flex-1 min-w-0 items-center gap-2.5 rounded-xl bg-surface-alt border border-border px-3 py-2.5 transition-colors hover:bg-surface-hover active:bg-surface-hover"
                  >
                    <Avatar
                      src={displayAvatar}
                      name={displayName}
                      id={user?.id}
                      size="w-8 h-8"
                      rounded="rounded-full"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="truncate text-sm font-bold text-foreground">
                          {displayName}
                        </span>
                        {isGoogleLinked && <GoogleLinkedBadge label={t('nav.googleSynced')} />}
                      </div>
                      <span className="text-[11px] text-secondary-text block truncate">
                        {rankDisplayName} · {t('nav.levelBadge', { level: lv.level })}
                      </span>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    title={t('nav.signOut')}
                    aria-label={t('nav.signOut')}
                    className="flex min-w-[44px] items-center justify-center rounded-xl border border-border bg-surface-alt text-secondary-text hover:bg-primary-soft hover:text-primary hover:border-primary/35 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <span
                      className={`material-symbols-outlined text-lg ${isSigningOut ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    >
                      {isSigningOut ? 'progress_activity' : 'logout'}
                    </span>
                  </button>
                </div>
              ) : (
                <Link
                  to={authLinkWithNext}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="btn-arena btn-arena-primary w-full text-sm"
                >
                  <span className="material-symbols-outlined text-lg shrink-0" aria-hidden="true">
                    login
                  </span>
                  <span className="truncate">{t('nav.signInRegister')}</span>
                </Link>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Mobile Top Navigation Bar */}
        <header className="safe-top md:hidden flex items-center justify-between gap-2 px-3.5 py-2.5 bg-paper/95 backdrop-blur-md border-b border-border z-40 shrink-0">
          <Link
            to="/home"
            onMouseEnter={() => preloadRouteModule('Home')}
            onFocus={() => preloadRouteModule('Home')}
            className="flex items-center gap-2 min-w-0 flex-1"
          >
            <img
              src="/logo.webp"
              alt={t('brand.name')}
              width={32}
              height={32}
              fetchPriority="high"
              decoding="async"
              className="w-8 h-8 rounded-lg object-cover border border-gold shrink-0"
            />
            <span className="font-extrabold text-sm tracking-tight font-display text-primary truncate">
              {t('brand.name')}
            </span>
          </Link>

          <div className="flex items-center gap-1.5 shrink-0">
            <LanguageToggle variant="compact" />
            <ThemeToggle variant="compact" />
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-alt border border-border text-foreground transition-colors hover:bg-surface-hover active:bg-surface-hover cursor-pointer"
              aria-label={t('nav.openMenu')}
              aria-controls="mobile-main-menu"
              aria-expanded={isMobileMenuOpen}
            >
              <span className="material-symbols-outlined text-xl" aria-hidden="true">menu</span>
            </button>
          </div>
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
          aria-label={t('nav.mobileBottomAria')}
        >
          <div className="grid grid-cols-4 gap-1 items-center max-w-md mx-auto">
            <MobileNavLink
              to="/home"
              preloadKey="Home"
              icon="home"
              label={t('nav.home')}
              currentPath={location.pathname}
            />
            <MobileNavLink
              to="/gpa"
              preloadKey="GPACalculator"
              icon="calculate"
              label={t('nav.gpa')}
              currentPath={location.pathname}
            />
            <MobileNavLink
              to="/arena"
              preloadKey="StudyArena"
              icon="local_fire_department"
              label={t('nav.arena')}
              currentPath={location.pathname}
            />
            <MobileNavLink
              to={user ? '/profile' : authLinkWithNext}
              preloadKey={user ? 'Profile' : undefined}
              icon={user ? 'person' : 'login'}
              label={user ? t('nav.profile') : t('nav.signIn')}
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
        className={`material-symbols-outlined text-xl shrink-0 transition-transform ${
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
      className={`flex min-w-0 flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition-colors min-h-[44px] ${
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
      <span className="text-[10px] tracking-tight leading-none truncate max-w-full px-1">{label}</span>
    </Link>
  );
}
