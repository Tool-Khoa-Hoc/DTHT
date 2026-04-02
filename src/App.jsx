import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import RootLayout from './components/RootLayout';
import { SpeedInsights } from "@vercel/speed-insights/react"
import SecurityWrapper from './components/SecurityWrapper';
import ErrorBoundary from './components/ErrorBoundary';

// Include global styles
import './index.css';

// Gói bọc (Wrapper) xử lý riêng cho lỗi mất Chunk của Vite khi có bản Build mới hoặc đứt Server
const lazyRetry = (componentImport) => {
  return lazy(async () => {
    try {
      const module = await componentImport();
      window.sessionStorage.removeItem('vite-chunk-reload'); // Tải thành công thì xoá cờ
      return module;
    } catch (error) {
      // Nếu lỗi là do không tìm thấy file Chunk động (Vite)
      if (error?.message?.includes('Failed to fetch dynamically imported module')) {
        const hasReloaded = window.sessionStorage.getItem('vite-chunk-reload');
        if (!hasReloaded) {
          window.sessionStorage.setItem('vite-chunk-reload', 'true');
          window.location.reload(); // Ép F5 làm mới dữ liệu cục bộ
        }
      }
      throw error; // Nếu lỗi khác hoặc đã F5 rồi vẫn lỗi thì ném cho ErrorBoundary
    }
  });
};

// Lazy load route components thông minh
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

// App Loading Fallback
const PageLoader = () => {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    const timer = setTimeout(() => setShow(true), 400); // 400ms delay để không nháy khung loading
    return () => clearTimeout(timer);
  }, []);
  
  if (!show) return <div className="min-h-screen bg-[#0a0c14]"></div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0c14] text-white">
      <div className="flex flex-col items-center gap-3">
        <span className="material-symbols-outlined animate-spin text-4xl text-[#3b82f6]">sync</span>
        <p className="text-sm text-slate-400 animate-pulse">Đang nạp phân đoạn giao diện...</p>
      </div>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SecurityWrapper>
          <SpeedInsights />
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
