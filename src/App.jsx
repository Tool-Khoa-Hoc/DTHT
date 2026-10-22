import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import { PageSkeleton } from './components/ui/Skeleton';
import { ToastProvider } from './components/ui/ToastProvider';
import AuthScreen from './pages/AuthScreen';
import { routeModuleLoaders } from './lib/routeModules';

import './index.css';

const lazyRetry = (componentImport) => lazy(async () => {
  try {
    const module = await componentImport();
    window.sessionStorage.removeItem('vite-chunk-reload');
    return module;
  } catch (error) {
    if (error?.message?.includes('Failed to fetch dynamically imported module')) {
      const hasReloaded = window.sessionStorage.getItem('vite-chunk-reload');
      if (!hasReloaded) {
        window.sessionStorage.setItem('vite-chunk-reload', 'true');
        window.location.reload();
      }
    }

    throw error;
  }
});

const RootLayout = lazyRetry(routeModuleLoaders.RootLayout);
const Home = lazyRetry(routeModuleLoaders.Home);
const GPACalculator = lazyRetry(routeModuleLoaders.GPACalculator);
const Library = lazyRetry(routeModuleLoaders.Library);
const Profile = lazyRetry(routeModuleLoaders.Profile);
const Roadmap = lazyRetry(routeModuleLoaders.Roadmap);
const Admin = lazyRetry(routeModuleLoaders.Admin);
const AdmissionCalculator = lazyRetry(routeModuleLoaders.AdmissionCalculator);
const SchoolFinder = lazyRetry(routeModuleLoaders.SchoolFinder);
const StudyArena = lazyRetry(routeModuleLoaders.StudyArena);
const Collaborator = lazyRetry(routeModuleLoaders.Collaborator);
const UserProfile = lazyRetry(routeModuleLoaders.UserProfile);
const OnlineLearning = lazyRetry(routeModuleLoaders.OnlineLearning);
const Notes = lazyRetry(routeModuleLoaders.Notes);
const CourseComboHs12 = lazyRetry(routeModuleLoaders.CourseComboHs12);

const scheduleIdleTask = (callback, timeout = 1500) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  if ('requestIdleCallback' in window) {
    const idleId = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback(idleId);
  }

  const timerId = window.setTimeout(callback, Math.min(timeout, 800));
  return () => window.clearTimeout(timerId);
};

function DeferredSpeedInsights() {
  const [SpeedInsightsComponent, setSpeedInsightsComponent] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;

    const cleanup = scheduleIdleTask(async () => {
      try {
        const mod = await import('@vercel/speed-insights/react');
        if (!cancelled) {
          setSpeedInsightsComponent(() => mod.SpeedInsights);
        }
      } catch (error) {
        console.warn('[App] Could not load SpeedInsights.', error);
      }
    }, 5000);

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  return SpeedInsightsComponent ? <SpeedInsightsComponent /> : null;
}


function App() {
  React.useEffect(() => {
    const bootShell = document.getElementById('boot-shell');
    if (!bootShell) {
      return undefined;
    }

    bootShell.dataset.ready = 'true';
    const frameId = window.requestAnimationFrame(() => {
      bootShell.remove();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <DeferredSpeedInsights />
          <ErrorBoundary>
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/" element={<AuthScreen />} />
                <Route path="/auth" element={<AuthScreen />} />

                <Route element={<RootLayout />}>
                  <Route path="home" element={<Home />} />
                  <Route path="gpa" element={<GPACalculator />} />
                  <Route path="library" element={<Library />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="roadmap" element={<Roadmap />} />
                  <Route path="admin" element={<Admin />} />
                  <Route path="admission" element={<AdmissionCalculator />} />
                  <Route path="schools" element={<SchoolFinder />} />
                  <Route path="tim-truong" element={<SchoolFinder />} />
                  <Route path="tim-truong/diem" element={<AdmissionCalculator />} />
                  <Route path="arena" element={<StudyArena />} />
                  <Route path="collaborator" element={<Collaborator />} />
                  <Route path="profile/:id" element={<UserProfile />} />
                  <Route path="hoc-online" element={<OnlineLearning />} />
                  <Route path="courses/combo-dtht-hs12-2k9-chinh-phuc-dai-hoc" element={<CourseComboHs12 />} />
                  <Route path="notes" element={<Notes />} />
                </Route>
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
