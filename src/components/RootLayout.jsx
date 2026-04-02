import React, { useState, useEffect } from 'react';
import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import WelcomeModal from './WelcomeModal';
import Avatar from './Avatar';

export default function RootLayout() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  if (!user) {
    return <Navigate to="/auth" />;
  }

  const isActive = (path) => location.pathname === path;
  const isExamTakingRoute = /^\/exam\/[^/]+\/[^/]+$/.test(location.pathname);

  if (isExamTakingRoute) {
    return (
      <div className="bg-[#f8f6f6] dark:bg-[#201216] font-display text-slate-900 dark:text-slate-100 h-screen overflow-hidden">
        <main className="h-screen overflow-hidden">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="bg-[#f8f6f6] dark:bg-[#201216] font-display text-slate-900 dark:text-slate-100 min-h-screen selection:bg-[#e36488]/30 flex flex-col md:flex-row">

      {/* --- MOBILE TOP HEADER --- */}
      <header className="md:hidden sticky top-0 left-0 right-0 z-40 bg-white/80 dark:bg-[#201216]/80 backdrop-blur-xl border-b border-[#e36488]/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <img src="/logo.png" alt="Đấu Trường Học Tập" className="h-8 rounded-xl object-contain" />
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 bg-slate-100 dark:bg-white/5 rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
          <span className="material-symbols-outlined">menu</span>
        </button>
      </header>

      {/* --- MOBILE OVERLAY --- */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/60 z-[90] md:hidden backdrop-blur-sm transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* --- SIDEBAR (DESKTOP & MOBILE DRAWER) --- */}
      <aside className={`flex flex-col w-64 h-screen fixed left-0 top-0 bg-white dark:bg-[#1a0f12] md:bg-white/50 md:dark:bg-[#1a0f12]/80 backdrop-blur-2xl border-r border-[#e36488]/10 z-[100] p-6 transition-transform duration-300 md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex flex-col">
            <h2 className="text-[#e36488] font-[1000] tracking-tighter uppercase text-xl leading-none">Đấu Trường</h2>
            <span className="text-[10px] tracking-[0.2em] font-bold uppercase text-slate-400 dark:text-slate-500 mt-1">Học Tập</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-slate-500 hover:text-white bg-slate-100 dark:bg-white/5 rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          <Link to="/home" className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${isActive('/home') ? 'bg-[#e36488] text-white shadow-lg shadow-[#e36488]/20 font-semibold' : 'text-slate-500 hover:bg-[#e36488]/10 hover:text-[#e36488]'}`}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/home') ? "'FILL' 1" : "'FILL' 0" }}>home</span>
            Trang chủ
          </Link>
          <Link to="/gpa" className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${isActive('/gpa') ? 'bg-[#e36488] text-white shadow-lg shadow-[#e36488]/20 font-semibold' : 'text-slate-500 hover:bg-[#e36488]/10 hover:text-[#e36488]'}`}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/gpa') ? "'FILL' 1" : "'FILL' 0" }}>calculate</span>
            Tính điểm
          </Link>
          <Link to="/schools" className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${isActive('/schools') ? 'bg-[#306ee8] text-white shadow-lg shadow-[#306ee8]/20 font-semibold' : 'text-slate-500 hover:bg-[#306ee8]/10 hover:text-[#306ee8]'}`}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/schools') ? "'FILL' 1" : "'FILL' 0" }}>apartment</span>
            Trường phù hợp
          </Link>
          <Link to="/exam-room" className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${isActive('/exam-room') ? 'bg-[#3b82f6] text-white shadow-lg shadow-[#3b82f6]/20 font-semibold' : 'text-slate-500 hover:bg-[#3b82f6]/10 hover:text-[#3b82f6]'}`}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/exam-room') ? "'FILL' 1" : "'FILL' 0" }}>quiz</span>
            Phòng thi
          </Link>
          <Link to="/roadmap" className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${isActive('/roadmap') ? 'bg-[#e36488] text-white shadow-lg shadow-[#e36488]/20 font-semibold' : 'text-slate-500 hover:bg-[#e36488]/10 hover:text-[#e36488]'}`}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/roadmap') ? "'FILL' 1" : "'FILL' 0" }}>timeline</span>
            Lộ trình
          </Link>
          <Link to="/library" className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${isActive('/library') ? 'bg-[#e36488] text-white shadow-lg shadow-[#e36488]/20 font-semibold' : 'text-slate-500 hover:bg-[#e36488]/10 hover:text-[#e36488]'}`}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/library') ? "'FILL' 1" : "'FILL' 0" }}>folder_open</span>
            Tài Liệu Học Free
          </Link>
          <Link to="/pricing" className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${isActive('/pricing') ? 'bg-[#e36488] text-white shadow-lg shadow-[#e36488]/20 font-semibold' : 'text-slate-500 hover:bg-[#e36488]/10 hover:text-[#e36488]'}`}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/pricing') ? "'FILL' 1" : "'FILL' 0" }}>workspace_premium</span>
            Nâng cấp VIP
          </Link>
          <Link to="/arena" className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${isActive('/arena') ? 'bg-[#fe5f36] text-white shadow-lg shadow-[#fe5f36]/20 font-semibold' : 'text-slate-500 hover:bg-[#fe5f36]/10 hover:text-[#fe5f36]'}`}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/arena') ? "'FILL' 1" : "'FILL' 0" }}>local_fire_department</span>
            Đấu trường
          </Link>
          {profile?.role === 'admin' && (
            <Link to="/admin" className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all border border-transparent ${isActive('/admin') ? 'bg-[#7f13ec] text-white shadow-lg shadow-[#7f13ec]/20 font-semibold' : 'text-slate-500 hover:bg-[#7f13ec]/10 hover:text-[#7f13ec] hover:border-[#7f13ec]/20'}`}>
              <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/admin') ? "'FILL' 1" : "'FILL' 0" }}>admin_panel_settings</span>
              Admin Panel
            </Link>
          )}
          {(profile?.role === 'admin' || profile?.role === 'collaborator') && (
            <Link to="/collaborator" className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all border border-transparent ${isActive('/collaborator') ? 'bg-[#10b981] text-white shadow-lg shadow-[#10b981]/20 font-semibold' : 'text-slate-500 hover:bg-[#10b981]/10 hover:text-[#10b981] hover:border-[#10b981]/20'}`}>
              <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/collaborator') ? "'FILL' 1" : "'FILL' 0" }}>local_library</span>
              Truyền Đạo Sư
            </Link>
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

      {/* --- MAIN CONTENT AREA --- */}
      {/* Add left margin on desktop to accommodate the sidebar */}
      <main className="flex-1 md:ml-64 relative min-h-screen">
        <Outlet />
        <WelcomeModal />
      </main>
    </div>
  );
}
