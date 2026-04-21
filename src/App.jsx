import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import SecurityWrapper from './components/SecurityWrapper';
import ErrorBoundary from './components/ErrorBoundary';
import { PageSkeleton } from './components/ui/Skeleton';
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
const ExamRoom = lazyRetry(routeModuleLoaders.ExamRoom);
const ExamTaking = lazyRetry(routeModuleLoaders.ExamTaking);
const ExamResult = lazyRetry(routeModuleLoaders.ExamResult);
const Pricing = lazyRetry(routeModuleLoaders.Pricing);
const PaymentWaiting = lazyRetry(routeModuleLoaders.PaymentWaiting);
const PaymentSuccess = lazyRetry(routeModuleLoaders.PaymentSuccess);
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
    });

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
    const timerId = window.setTimeout(() => {
      bootShell.remove();
    }, 220);

    return () => window.clearTimeout(timerId);
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <SecurityWrapper>
          <DeferredSpeedInsights />
          <ErrorBoundary>
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/auth" element={<AuthScreen />} />

                <Route path="/" element={<RootLayout />}>
                  <Route index element={<Navigate to="/home" replace />} />
                  <Route path="home" element={<Home />} />
                  <Route path="gpa" element={<GPACalculator />} />
                  <Route path="library" element={<Library />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="roadmap" element={<Roadmap />} />
                  <Route path="admin" element={<Admin />} />
                  <Route path="admission" element={<AdmissionCalculator />} />
                  <Route path="schools" element={<SchoolFinder />} />
                  <Route path="arena" element={<StudyArena />} />
                  <Route path="collaborator" element={<Collaborator />} />
                  <Route path="profile/:id" element={<UserProfile />} />
                  <Route path="exam-room" element={<ExamRoom />} />
                  <Route path="exam/:subjectFolder/:examPath" element={<ExamTaking />} />
                  <Route path="exam/:subjectFolder/:examPath/result" element={<ExamResult />} />
                  <Route path="pricing" element={<Pricing />} />
                  <Route path="courses/combo-dtht-hs12-2k9-chinh-phuc-dai-hoc" element={<CourseComboHs12 />} />
                  <Route path="payment/waiting/:orderId" element={<PaymentWaiting />} />
                  <Route path="payment/success" element={<PaymentSuccess />} />
                  <Route path="notes" element={<Notes />} />
                </Route>
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </SecurityWrapper>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
