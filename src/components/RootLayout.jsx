import React from 'react';
import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function RootLayout() {
  const { user, profile } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/auth" />;
  }

  const isActive = (path) => location.pathname === path;

  return (
    <div className="bg-[#f8f6f6] dark:bg-[#201216] font-display text-slate-900 dark:text-slate-100 min-h-screen selection:bg-[#e36488]/30 flex flex-col md:flex-row">

      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 bg-white/50 dark:bg-[#1a0f12]/80 backdrop-blur-2xl border-r border-[#e36488]/10 z-50 p-6">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-[#e36488]/20 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(227,100,136,0.3)] border border-[#e36488]/30">
            <span className="material-symbols-outlined text-[#e36488] text-2xl">school</span>
          </div>
          <h2 className="text-[#e36488] font-bold tracking-widest uppercase truncate">Đấu Trường Học Tập</h2>
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
          <Link to="/roadmap" className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${isActive('/roadmap') ? 'bg-[#e36488] text-white shadow-lg shadow-[#e36488]/20 font-semibold' : 'text-slate-500 hover:bg-[#e36488]/10 hover:text-[#e36488]'}`}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/roadmap') ? "'FILL' 1" : "'FILL' 0" }}>timeline</span>
            Lộ trình
          </Link>
          <Link to="/library" className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${isActive('/library') ? 'bg-[#e36488] text-white shadow-lg shadow-[#e36488]/20 font-semibold' : 'text-slate-500 hover:bg-[#e36488]/10 hover:text-[#e36488]'}`}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/library') ? "'FILL' 1" : "'FILL' 0" }}>folder_open</span>
            Tài Liệu Học Free
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
            <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-800">
              <img className="w-full h-full object-cover" src={user?.user_metadata?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} alt="Avatar" />
            </div>
            <span className="truncate">{user?.user_metadata?.full_name || 'Cá nhân'}</span>
          </Link>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      {/* Add left margin on desktop to accommodate the sidebar */}
      <main className="flex-1 md:ml-64 relative min-h-screen">
        <Outlet />
      </main>

      {/* --- MOBILE BOTTOM NAVIGATION --- */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-[#201216]/80 backdrop-blur-xl border-t border-[#e36488]/10 px-4 py-3 flex items-center justify-between pb-safe">
        <Link to="/home" className={`flex flex-col items-center gap-1 ${isActive('/home') ? 'text-[#e36488]' : 'text-slate-500'}`}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/home') ? "'FILL' 1" : "'FILL' 0" }}>home</span>
          <span className="text-[10px] font-bold">Trang chủ</span>
        </Link>
        <Link to="/gpa" className={`flex flex-col items-center gap-1 ${isActive('/gpa') ? 'text-[#e36488]' : 'text-slate-500'}`}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/gpa') ? "'FILL' 1" : "'FILL' 0" }}>calculate</span>
          <span className="text-[10px] font-bold">Tính điểm</span>
        </Link>
        <Link to="/schools" className={`flex flex-col items-center gap-1 ${isActive('/schools') ? 'text-[#306ee8]' : 'text-slate-500'}`}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/schools') ? "'FILL' 1" : "'FILL' 0" }}>apartment</span>
          <span className="text-[10px] font-bold">Tìm trường</span>
        </Link>
        <Link to="/roadmap" className="relative -top-6">
          <div className="w-14 h-14 bg-[#e36488] rounded-full flex items-center justify-center shadow-lg shadow-[#e36488]/30 border-4 border-[#f8f6f6] dark:border-[#201216]">
            <span className="material-symbols-outlined text-white text-3xl">add</span>
          </div>
        </Link>
        <Link to="/arena" className={`flex flex-col items-center gap-1 ${isActive('/arena') ? 'text-[#fe5f36]' : 'text-slate-500'}`}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/arena') ? "'FILL' 1" : "'FILL' 0" }}>local_fire_department</span>
          <span className="text-[10px] font-bold">Tranh tài</span>
        </Link>
        <Link to="/library" className={`flex flex-col items-center gap-1 ${isActive('/library') ? 'text-[#e36488]' : 'text-slate-500'}`}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/library') ? "'FILL' 1" : "'FILL' 0" }}>folder_open</span>
          <span className="text-[10px] font-bold">Tài Liệu Free</span>
        </Link>
        <Link to="/profile" className={`flex flex-col items-center gap-1 ${isActive('/profile') ? 'text-[#e36488]' : 'text-slate-500'}`}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/profile') ? "'FILL' 1" : "'FILL' 0" }}>person</span>
          <span className="text-[10px] font-bold">Cá nhân</span>
        </Link>
        {profile?.role === 'admin' && (
          <Link to="/admin" className={`flex flex-col items-center gap-1 ${isActive('/admin') ? 'text-[#7f13ec]' : 'text-slate-500'}`}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/admin') ? "'FILL' 1" : "'FILL' 0" }}>admin_panel_settings</span>
            <span className="text-[10px] font-bold">Admin</span>
          </Link>
        )}
        {(profile?.role === 'admin' || profile?.role === 'collaborator') && (
          <Link to="/collaborator" className={`flex flex-col items-center gap-1 ${isActive('/collaborator') ? 'text-[#10b981]' : 'text-slate-500'}`}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/collaborator') ? "'FILL' 1" : "'FILL' 0" }}>local_library</span>
            <span className="text-[10px] font-bold">TĐ.Sư</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
