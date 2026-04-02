import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

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

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-[#201216] via-[#2d1b2e] to-[#1a1025] flex flex-col justify-center px-6 py-12 text-white font-display">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] right-[-20%] w-[300px] h-[300px] bg-primary/20 rounded-full blur-[80px]"></div>
      <div className="absolute bottom-[5%] left-[-15%] w-[250px] h-[250px] bg-indigo-500/10 rounded-full blur-[70px]"></div>

      <div className="relative z-10 flex flex-col h-full max-w-md mx-auto w-full">
        {/* Header Section */}
        <div className="flex flex-col items-center mb-12">
          <img src="/logo.png" alt="Đấu Trường Học Tập" className="h-20 rounded-2xl object-contain mb-4 drop-shadow-[0_0_15px_rgba(227,100,136,0.4)]" />
          <h1 className="text-3xl font-bold text-center mb-2">{isLogin ? 'Chào mừng trở lại!' : 'Tạo tài khoản mới'}</h1>
          <p className="text-slate-400 text-center px-4 leading-relaxed">
            {isLogin ? 'Đăng nhập để đồng bộ và lưu bảng điểm của bạn.' : 'Đăng ký để bắt đầu theo dõi lộ trình học tập.'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl mb-6 text-sm text-center">
            {error}
          </div>
        )}

        {/* Social Login */}
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 h-14 rounded-xl text-white font-semibold transition-all hover:bg-white/15 active:scale-[0.98] mb-6 shadow-xl"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
          </svg>
          <span>Tiếp tục với Google</span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-8">
          <div className="h-[1px] flex-1 bg-white/10"></div>
          <span className="text-slate-500 text-sm font-medium uppercase tracking-wider">Hoặc</span>
          <div className="h-[1px] flex-1 bg-white/10"></div>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleAuth} className="space-y-4 mb-6">
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-slate-500 group-focus-within:text-[#e36488] transition-colors">mail</span>
            </div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-14 bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 text-white focus:ring-2 focus:ring-[#e36488]/50 focus:border-[#e36488] transition-all backdrop-blur-sm outline-none placeholder:text-slate-500"
              placeholder="Email"
              type="email"
              required
            />
          </div>
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-slate-500 group-focus-within:text-[#e36488] transition-colors">lock</span>
            </div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-14 bg-white/5 border border-white/10 rounded-xl pl-12 pr-12 text-white focus:ring-2 focus:ring-[#e36488]/50 focus:border-[#e36488] transition-all backdrop-blur-sm outline-none placeholder:text-slate-500"
              placeholder="Mật khẩu"
              type="password"
              required
            />
          </div>

          {/* Primary CTA */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 mt-4 bg-gradient-to-r from-[#e36488] to-[#9333ea] rounded-xl text-white font-bold text-lg shadow-lg shadow-[#e36488]/30 active:scale-[0.98] transition-transform flex items-center justify-center mb-8 disabled:opacity-50"
          >
            {loading ? 'Đang xử lý...' : (isLogin ? 'Đăng nhập' : 'Đăng ký')}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-auto text-center pb-4">
          <p className="text-slate-400">
            {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-[#e36488] font-bold ml-1 hover:underline underline-offset-4 bg-transparent border-none cursor-pointer"
            >
              {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
