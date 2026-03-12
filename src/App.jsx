import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import RootLayout from './components/RootLayout';

// Include global styles
import './index.css';

// Lazy load route components
const AuthScreen = lazy(() => import('./pages/AuthScreen'));
const Home = lazy(() => import('./pages/Home'));
const GPACalculator = lazy(() => import('./pages/GPACalculator'));
const Library = lazy(() => import('./pages/Library'));
const Profile = lazy(() => import('./pages/Profile'));
const Roadmap = lazy(() => import('./pages/Roadmap'));
const Admin = lazy(() => import('./pages/Admin'));
const AdmissionCalculator = lazy(() => import('./pages/AdmissionCalculator'));
const SchoolFinder = lazy(() => import('./pages/SchoolFinder'));
const StudyArena = lazy(() => import('./pages/StudyArena'));
const Collaborator = lazy(() => import('./pages/Collaborator'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const ExamRoom = lazy(() => import('./pages/ExamRoom'));
const ExamTaking = lazy(() => import('./pages/ExamTaking'));
const ExamResult = lazy(() => import('./pages/ExamResult'));

// App Loading Fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#0a0c14] text-white">
    <div className="flex flex-col items-center gap-3">
      <span className="material-symbols-outlined animate-spin text-4xl text-[#3b82f6]">sync</span>
      <p className="text-sm text-slate-400 animate-pulse">Đang tải trang...</p>
    </div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
              <Route path="exam/:subjectFolder/:id" element={<ExamTaking />} />
              <Route path="exam/:subjectFolder/:id/result" element={<ExamResult />} />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
