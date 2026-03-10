import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AuthScreen from './pages/AuthScreen';
import Home from './pages/Home';
import GPACalculator from './pages/GPACalculator';
import Library from './pages/Library';
import Profile from './pages/Profile';
import Roadmap from './pages/Roadmap';
import Admin from './pages/Admin';
import AdmissionCalculator from './pages/AdmissionCalculator';
import SchoolFinder from './pages/SchoolFinder';
import StudyArena from './pages/StudyArena';
import RootLayout from './components/RootLayout';
import Collaborator from './pages/Collaborator';
import UserProfile from './pages/UserProfile';

// Include global styles
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
