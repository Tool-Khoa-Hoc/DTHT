import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { preloadRouteModules, shouldPrefetchModules } from '../lib/routeModules';

const scheduleIdleTask = (callback, timeout = 1200) => {
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

export default function AuthScreen() {
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/home', { replace: true });
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (!shouldPrefetchModules()) {
      return undefined;
    }

    const cleanup = scheduleIdleTask(() => {
      void preloadRouteModules(['RootLayout', 'Home', 'Library', 'CourseComboHs12']);
    });

    return cleanup;
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/home');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: email.split('@')[0],
              avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`
            }
          }
        });
        if (error) throw error;
        alert('Đăng ký thành công! Bạn có thể đăng nhập ngay bây giờ.');
        setIsLogin(true);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/home`
        }
      });
      if (error) throw error;
    } catch (error) {
      console.error("Lỗi đăng nhập Google:", error);
      setError(error.message);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError(null);
  };

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-gradient-to-br from-[#201216] via-[#2d1b2e] to-[#1a1025] flex flex-col justify-center px-6 py-8 text-white font-display safe-top safe-bottom">
      {/* Background Orbs — GPU accelerated */}
      <div className="absolute top-[-10%] right-[-20%] w-[300px] h-[300px] bg-[#e36488]/15 rounded-full blur-[80px] gpu" />
      <div className="absolute bottom-[5%] left-[-15%] w-[250px] h-[250px] bg-indigo-500/10 rounded-full blur-[70px] gpu" />

      <div className="relative z-10 flex flex-col max-w-md mx-auto w-full animate-page-in">
        {/* Header Section */}
        <div className="flex flex-col items-center mb-10">
          <img
            src="/logo.webp"
            width="114"
            height="114"
            decoding="async"
            fetchPriority="high"
            alt="Đấu Trường Học Tập"
            className="w-20 h-20 rounded-2xl object-contain mb-4 drop-shadow-[0_0_15px_rgba(227,100,136,0.4)]"
          />
          <h1 className="text-3xl font-bold text-center mb-2">
            {isLogin ? 'Chào mừng trở lại!' : 'Tạo tài khoản mới'}
          </h1>
          <p className="text-slate-400 text-sm text-center px-4 leading-relaxed">
            {isLogin
              ? 'Đăng nhập để đồng bộ và lưu bảng điểm của bạn.'
              : 'Đăng ký để bắt đầu theo dõi lộ trình học tập.'}
          </p>
        </div>

        {/* Error Message — animated */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-out ${
            error ? 'max-h-24 opacity-100 mb-5' : 'max-h-0 opacity-0 mb-0'
          }`}
        >
          <div className="bg-red-500/15 border border-red-500/30 text-red-200 px-4 py-3 rounded-xl text-sm text-center backdrop-blur-sm">
            {error}
          </div>
        </div>

        {/* Social Login */}
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white/8 backdrop-blur-md border border-white/15 h-14 rounded-2xl text-white font-semibold transition-all active:scale-[0.97] mb-6 shadow-xl"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <span>Tiếp tục với Google</span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-7">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">Hoặc</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* Form Fields */}
        <form onSubmit={handleAuth} className="space-y-3 mb-4">
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-slate-500 text-xl group-focus-within:text-[#e36488] transition-colors">mail</span>
            </div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-white focus:ring-2 focus:ring-[#e36488]/40 focus:border-[#e36488]/60 transition-all backdrop-blur-sm outline-none placeholder:text-slate-500"
              placeholder="Email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-slate-500 text-xl group-focus-within:text-[#e36488] transition-colors">lock</span>
            </div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-14 text-white focus:ring-2 focus:ring-[#e36488]/40 focus:border-[#e36488]/60 transition-all backdrop-blur-sm outline-none placeholder:text-slate-500"
              placeholder="Mật khẩu"
              type={showPassword ? 'text' : 'password'}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-3 flex items-center px-1 text-slate-500 active:text-slate-300"
              tabIndex={-1}
            >
              <span className="material-symbols-outlined text-xl">
                {showPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>

          {/* Primary CTA */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 mt-3 bg-gradient-to-r from-[#e36488] to-[#9333ea] rounded-2xl text-white font-bold text-lg shadow-lg shadow-[#e36488]/25 active:scale-[0.97] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:active:scale-100"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
                <span>Đang xử lý...</span>
              </>
            ) : (
              isLogin ? 'Đăng nhập' : 'Đăng ký'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-slate-400 text-sm">
            {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
            <button
              onClick={toggleMode}
              className="text-[#e36488] font-bold ml-1.5 hover:underline underline-offset-4 bg-transparent border-none cursor-pointer active:opacity-70 py-2 px-1"
            >
              {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
