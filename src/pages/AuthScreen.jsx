import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/toastContext';

function getFriendlyAuthError(error) {
  const message = error?.message?.toLowerCase() || '';

  if (message.includes('invalid login credentials')) {
    return 'Email hoặc mật khẩu chưa đúng. Vui lòng kiểm tra lại.';
  }

  if (message.includes('email not confirmed')) {
    return 'Email chưa được xác nhận. Vui lòng kiểm tra hộp thư của bạn.';
  }

  if (message.includes('password')) {
    return 'Mật khẩu chưa hợp lệ. Vui lòng dùng mật khẩu đủ mạnh hơn.';
  }

  if (message.includes('email')) {
    return 'Email chưa hợp lệ hoặc đã được sử dụng.';
  }

  return 'Không thể xử lý yêu cầu lúc này. Vui lòng thử lại sau.';
}

// Ba mốc trên hành trình — echo lại "con đường thăng hạng" ở trang chủ.
const journey = [
  { icon: 'auto_stories', tint: 'text-jade-300', bg: 'bg-jade-400/12', text: 'Học liệu và khóa học online trong một nơi' },
  { icon: 'timeline', tint: 'text-gold-300', bg: 'bg-gold-400/14', text: 'Đồng bộ bảng điểm và mục tiêu ôn thi' },
  { icon: 'military_tech', tint: 'text-ember-400', bg: 'bg-ember-500/14', text: 'Thăng hạng qua từng buổi luyện đề' },
];

const inputClass =
  'h-14 w-full rounded-2xl border border-white/10 bg-white/5 pl-12 pr-4 text-white outline-none transition-all placeholder:text-slate-500 focus:border-ember-500/60 focus:ring-2 focus:ring-ember-500/40';

export default function AuthScreen() {
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/home', { replace: true });
    }
  }, [authLoading, navigate, user]);

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
              // Chỉ lưu tên hiển thị; avatar để trống → Avatar sinh sẵn cục bộ
              // (không gửi email sang dịch vụ bên thứ ba để tạo ảnh).
              full_name: email.split('@')[0],
            },
          },
        });
        if (error) throw error;
        showToast({
          type: 'success',
          title: 'Đăng ký thành công',
          description: 'Bạn có thể đăng nhập ngay bây giờ.',
        });
        setIsLogin(true);
      }
    } catch (error) {
      setError(getFriendlyAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/home`,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Lỗi đăng nhập Google:', error);
      setError(getFriendlyAuthError(error));
    }
  };

  const toggleMode = () => {
    setIsLogin((current) => !current);
    setError(null);
  };

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-ink-950 text-white font-display safe-top safe-bottom">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_18%_-5%,rgba(227,100,136,0.18),transparent_60%),radial-gradient(45%_40%_at_100%_15%,rgba(242,193,89,0.1),transparent_55%),radial-gradient(60%_55%_at_50%_115%,rgba(95,207,166,0.08),transparent_60%)]" />

      <div className="relative z-10 mx-auto grid min-h-dvh w-full max-w-6xl lg:grid-cols-2">
        {/* ══════════ Brand panel (desktop) ══════════ */}
        <aside className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
          <div className="flex items-center gap-3">
            <img
              src="/logo.webp"
              width="44"
              height="44"
              alt="Đấu Trường Học Tập"
              className="h-11 w-11 rounded-xl object-contain"
            />
            <span className="font-arena text-sm font-extrabold uppercase tracking-[0.14em] text-ember-400">
              Đấu Trường Học Tập
            </span>
          </div>

          <div className="max-w-md">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/25 bg-gold-400/10 px-3.5 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-400 ember-pulse" />
              <span className="font-arena text-[11px] font-bold uppercase tracking-[0.28em] text-gold-300">
                Học tập &amp; Chinh phục
              </span>
            </span>
            <h1 className="font-arena mt-6 text-4xl font-extrabold leading-[1.02] tracking-tight xl:text-[3.1rem]">
              Vào đấu trường,
              <br />
              bắt đầu hành trình{' '}
              <span className="bg-gradient-to-r from-ember-400 to-gold-400 bg-clip-text text-transparent">
                chinh phục
              </span>
              .
            </h1>
            <ul className="mt-8 flex flex-col gap-3.5">
              {journey.map((item) => (
                <li key={item.text} className="flex items-center gap-3.5">
                  <span className={`rank-seal grid h-10 w-10 shrink-0 place-items-center ${item.bg}`}>
                    <span className={`material-symbols-outlined text-[20px] ${item.tint}`}>{item.icon}</span>
                  </span>
                  <span className="text-sm text-slate-300">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-slate-500">
            Nền tảng ôn thi THPTQG · Tính điểm xét tuyển · Học liệu miễn phí
          </p>
        </aside>

        {/* ══════════ Auth form ══════════ */}
        <main className="flex flex-col justify-center px-6 py-10 sm:px-10">
          <div className="mx-auto flex w-full max-w-md flex-col">
            {/* Mobile brand header */}
            <div className="mb-8 flex flex-col items-center lg:hidden">
              <img
                src="/logo.webp"
                width="114"
                height="114"
                loading="eager"
                decoding="sync"
                fetchPriority="high"
                alt="Đấu Trường Học Tập"
                className="mb-4 h-20 w-20 rounded-2xl object-contain"
              />
              <span className="font-arena mb-1 text-[11px] font-bold uppercase tracking-[0.28em] text-gold-300">
                Học tập &amp; Chinh phục
              </span>
            </div>

            <div className="mb-8">
              <h2 className="font-arena text-3xl font-extrabold tracking-tight text-center lg:text-left">
                {isLogin ? 'Chào mừng trở lại!' : 'Tạo tài khoản mới'}
              </h2>
              <p className="mt-2 text-center text-sm leading-relaxed text-slate-400 lg:text-left">
                {isLogin
                  ? 'Đăng nhập để đồng bộ bảng điểm và tiếp tục hành trình.'
                  : 'Đăng ký để bắt đầu theo dõi lộ trình và thăng hạng.'}
              </p>
            </div>

            {/* Error Message — animated */}
            <div
              id="auth-error"
              role={error ? 'alert' : undefined}
              aria-hidden={!error}
              className={`overflow-hidden transition-all duration-300 ease-out ${
                error ? 'max-h-24 opacity-100 mb-5' : 'max-h-0 opacity-0 mb-0'
              }`}
            >
              <div className="rounded-xl border border-red-500/30 bg-red-500/15 px-4 py-3 text-center text-sm text-red-200">
                {error}
              </div>
            </div>

            {/* Social Login */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="mb-6 flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-white/[0.12] bg-white/[0.07] text-white shadow-lg transition-all hover:bg-white/[0.1] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500/50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span className="font-semibold">Tiếp tục với Google</span>
            </button>

            {/* Divider */}
            <div className="mb-7 flex items-center gap-4">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Hoặc</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            {/* Form Fields */}
            <form onSubmit={handleAuth} className="mb-4 space-y-3">
              <div className="group relative">
                <label htmlFor="auth-email" className="mb-2 block text-sm font-semibold text-slate-200">
                  Email
                </label>
                <div className="pointer-events-none absolute bottom-0 left-4 flex h-14 items-center">
                  <span className="material-symbols-outlined text-xl text-slate-500 transition-colors group-focus-within:text-ember-400">mail</span>
                </div>
                <input
                  id="auth-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'auth-error' : undefined}
                  required
                />
              </div>
              <div className="group relative">
                <label htmlFor="auth-password" className="mb-2 block text-sm font-semibold text-slate-200">
                  Mật khẩu
                </label>
                <div className="pointer-events-none absolute bottom-0 left-4 flex h-14 items-center">
                  <span className="material-symbols-outlined text-xl text-slate-500 transition-colors group-focus-within:text-ember-400">lock</span>
                </div>
                <input
                  id="auth-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-14`}
                  placeholder="Nhập mật khẩu"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'auth-error' : undefined}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute bottom-0 right-3 flex h-14 items-center px-1 text-slate-500 transition-colors hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500/60"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  aria-pressed={showPassword}
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
                className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-ember-500 to-ember-600 text-lg font-bold text-white shadow-lg shadow-ember-500/25 transition-all active:scale-[0.97] disabled:opacity-60 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  isLogin ? 'Đăng nhập' : 'Đăng ký'
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-4 text-center">
              <p className="text-sm text-slate-400">
                {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
                <button
                  onClick={toggleMode}
                  className="ml-1.5 cursor-pointer border-none bg-transparent px-1 py-2 font-bold text-ember-400 underline-offset-4 hover:underline active:opacity-70"
                >
                  {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
                </button>
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
