import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import SecurityWrapper from './components/SecurityWrapper';
import ErrorBoundary from './components/ErrorBoundary';

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

const RootLayout = lazyRetry(() => import('./components/RootLayout'));
const AuthScreen = lazyRetry(() => import('./pages/AuthScreen'));
const Home = lazyRetry(() => import('./pages/Home'));
const GPACalculator = lazyRetry(() => import('./pages/GPACalculator'));
const Library = lazyRetry(() => import('./pages/Library'));
const Profile = lazyRetry(() => import('./pages/Profile'));
const Roadmap = lazyRetry(() => import('./pages/Roadmap'));
const Admin = lazyRetry(() => import('./pages/Admin'));
const AdmissionCalculator = lazyRetry(() => import('./pages/AdmissionCalculator'));
const SchoolFinder = lazyRetry(() => import('./pages/SchoolFinder'));
const StudyArena = lazyRetry(() => import('./pages/StudyArena'));
const Collaborator = lazyRetry(() => import('./pages/Collaborator'));
const UserProfile = lazyRetry(() => import('./pages/UserProfile'));
const ExamRoom = lazyRetry(() => import('./pages/ExamRoom'));
const ExamTaking = lazyRetry(() => import('./pages/ExamTaking'));
const ExamResult = lazyRetry(() => import('./pages/ExamResult'));
const Pricing = lazyRetry(() => import('./pages/Pricing'));
const PaymentWaiting = lazyRetry(() => import('./pages/PaymentWaiting'));
const PaymentSuccess = lazyRetry(() => import('./pages/PaymentSuccess'));
const Notes = lazyRetry(() => import('./pages/Notes'));

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

function PageLoader() {
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setShow(true), 250);
    return () => window.clearTimeout(timer);
  }, []);

  if (!show) {
    return <div className="min-h-screen bg-[#0a0c14]" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0c14] text-white">
      <div className="flex flex-col items-center gap-3">
        <span className="material-symbols-outlined animate-spin text-4xl text-[#3b82f6]">sync</span>
        <p className="text-sm text-slate-400 animate-pulse">Đang nạp giao diện...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SecurityWrapper>
          <DeferredSpeedInsights />
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
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
