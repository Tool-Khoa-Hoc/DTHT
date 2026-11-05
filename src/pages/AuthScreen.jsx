import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import RankSeal from '../components/ui/RankSeal';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isUnconfirmedError, setIsUnconfirmedError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const navigate = useNavigate();
  const { signIn, signUp, resetPassword, resendConfirmation, user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/home');
    }
  }, [user, navigate]);

  const translateAuthError = (message) => {
    const msg = (message || '').toLowerCase();

    if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
      return 'Email hoặc mật khẩu không chính xác. Nếu bạn vừa đăng ký, hãy chắc chắn rằng bạn đã xác nhận email nhé!';
    }
    if (msg.includes('email not confirmed')) {
      setIsUnconfirmedError(true);
      return 'Tài khoản của bạn chưa được kích hoạt! Vui lòng mở hộp thư (cả mục Thư rác/Spam) và nhấn vào link xác nhận.';
    }
    if (msg.includes('user already registered') || msg.includes('already exists')) {
      return 'Email này đã được đăng ký. Vui lòng chuyển sang tab Đăng nhập hoặc dùng tính năng Quên mật khẩu.';
    }
    if (msg.includes('password should be at least')) {
      return 'Mật khẩu quá ngắn. Vui lòng nhập ít nhất 6 ký tự.';
    }
    if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('for security purposes')) {
      return 'Bạn đã thao tác quá nhanh. Vui lòng đợi khoảng 60 giây rồi thử lại nhé!';
    }
    if (msg.includes('unable to validate email') || msg.includes('invalid email')) {
      return 'Định dạng email không hợp lệ. Vui lòng kiểm tra lại.';
    }
    return 'Đã xảy ra lỗi: ' + message;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsUnconfirmedError(false);

    if (!email) {
      setErrorMsg('Vui lòng nhập địa chỉ email của bạn.');
      return;
    }

    if (isForgotPassword) {
      setIsSubmitting(true);
      try {
        const { error } = await resetPassword(email);
        if (error) throw error;
        setSuccessMsg('Link đặt lại mật khẩu đã được gửi! Vui lòng kiểm tra hộp thư email của bạn (kể cả mục Spam).');
      } catch (err) {
        setErrorMsg(translateAuthError(err.message));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!password) {
      setErrorMsg('Vui lòng nhập mật khẩu.');
      return;
    }

    if (!isLogin && !fullName) {
      setErrorMsg('Vui lòng nhập họ và tên của bạn.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) throw error;
        navigate('/home');
      } else {
        const { data, error } = await signUp(email, password, fullName);
        if (error) throw error;

        if (data?.user && data?.user?.identities && data.user.identities.length === 0) {
          setErrorMsg('Email này đã được đăng ký trước đó. Vui lòng chuyển sang Đăng nhập!');
          setIsSubmitting(false);
          return;
        }

        if (data?.user && !data?.session) {
          setSuccessMsg(
            `Đăng ký thành công! Một email xác nhận đã được gửi tới ${email}. Vui lòng kiểm tra hộp thư (và mục Thư rác/Spam) để kích hoạt tài khoản trước khi đăng nhập.`,
          );
          setIsLogin(true);
          setPassword('');
        } else {
          navigate('/home');
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      setErrorMsg(translateAuthError(err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendEmail = async () => {
    if (!email) {
      setErrorMsg('Vui lòng nhập email ở ô bên dưới trước khi yêu cầu gửi lại link.');
      return;
    }
    setIsResending(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const { error } = await resendConfirmation(email);
      if (error) throw error;
      setSuccessMsg(`Đã gửi lại email kích hoạt tới ${email}! Hãy kiểm tra kỹ cả hộp thư chính và mục Spam nhé.`);
      setIsUnconfirmedError(false);
    } catch (err) {
      setErrorMsg(translateAuthError(err.message));
    } finally {
      setIsResending(false);
    }
  };

  const switchMode = (loginMode) => {
    setIsLogin(loginMode);
    setIsForgotPassword(false);
    setErrorMsg('');
    setSuccessMsg('');
    setIsUnconfirmedError(false);
  };

  return (
    <div className="bg-background font-sans text-foreground min-h-dvh flex flex-col justify-between relative overflow-x-hidden">
      {/* Decorative Hanzi Watermarks */}
      <span
        aria-hidden="true"
        className="hanzi-watermark hidden md:block fixed top-12 left-10 text-[120px] font-bold text-accent/7"
      >
        文昌
      </span>
      <span
        aria-hidden="true"
        className="hanzi-watermark hidden md:block fixed bottom-10 right-10 text-[120px] font-bold text-primary/6"
      >
        登科
      </span>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 max-w-md mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary-soft border border-gold overflow-hidden no-shrink shadow-xs">
            <img src="/logo.webp" alt="Logo" width={40} height={40} className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="font-display font-extrabold text-base tracking-tight text-foreground block leading-none">
              Đấu Trường Học Tập
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
              Khoa Trường · 2027
            </span>
          </div>
        </div>
        <Link
          to="/home"
          className="text-xs font-bold text-primary hover:text-primary-hover flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary-soft border border-primary/25 transition-colors"
        >
          <span>Khám phá trước</span>
          <span className="material-symbols-outlined text-sm" aria-hidden="true">
            arrow_forward
          </span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col justify-center px-5 max-w-md mx-auto w-full pb-8">
        <div className="imperial-frame p-6 sm:p-7">
          {/* Welcome Text */}
          <div className="mb-6 text-center sm:text-left">
            <div className="mb-3">
              <RankSeal
                size="sm"
                icon="school"
                label={isForgotPassword ? 'Khôi phục tài khoản' : isLogin ? 'Ghi danh nhập trường' : 'Tân sĩ tử ghi danh'}
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-foreground mb-1.5">
              {isForgotPassword
                ? 'Khôi phục mật khẩu'
                : isLogin
                  ? 'Chào mừng trở lại!'
                  : 'Tạo tài khoản mới'}
            </h1>
            <p className="text-secondary-text text-xs sm:text-sm leading-relaxed">
              {isForgotPassword
                ? 'Nhập email bạn đã dùng đăng ký, hệ thống sẽ gửi link đặt lại mật khẩu mới.'
                : isLogin
                  ? 'Đăng nhập để lưu tiến độ ôn luyện, tính điểm và đua top bảng vàng.'
                  : 'Tham gia cùng hàng ngàn sĩ tử chinh phục kỳ thi THPT Quốc Gia.'}
            </p>
          </div>

          {/* Toggle Switch (Login / Register) */}
          {!isForgotPassword && (
            <div className="p-1 bg-surface-alt rounded-xl flex mb-5 border border-border">
              <button
                type="button"
                onClick={() => switchMode(true)}
                className={`flex-1 py-2.5 text-sm font-display font-bold rounded-lg transition-all cursor-pointer ${
                  isLogin
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'text-secondary-text hover:text-foreground'
                }`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => switchMode(false)}
                className={`flex-1 py-2.5 text-sm font-display font-bold rounded-lg transition-all cursor-pointer ${
                  !isLogin
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'text-secondary-text hover:text-foreground'
                }`}
              >
                Đăng ký
              </button>
            </div>
          )}

          {/* Thông báo Thành công (Success Box) */}
          {successMsg && (
            <div className="mb-5 p-4 rounded-xl bg-jade-soft border border-jade-border text-foreground text-sm flex flex-col gap-2">
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-jade no-shrink text-xl" aria-hidden="true">
                  mark_email_read
                </span>
                <span className="leading-relaxed font-medium text-xs sm:text-sm">{successMsg}</span>
              </div>
            </div>
          )}

          {/* Thông báo Lỗi (Error Box) */}
          {errorMsg && (
            <div className="mb-5 p-4 rounded-xl bg-primary-soft border border-primary/35 text-foreground text-sm flex flex-col gap-3">
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-primary no-shrink text-xl" aria-hidden="true">
                  error
                </span>
                <span className="leading-relaxed text-xs sm:text-sm">{errorMsg}</span>
              </div>

              {isUnconfirmedError && (
                <button
                  type="button"
                  onClick={handleResendEmail}
                  disabled={isResending}
                  className="self-start px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-alt text-primary border border-primary/30 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">
                    send
                  </span>
                  {isResending ? 'Đang gửi lại...' : 'Gửi lại email xác nhận'}
                </button>
              )}
            </div>
          )}

          {/* Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            {!isLogin && !isForgotPassword && (
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5 ml-1">
                  Họ và tên
                </label>
                <div className="relative flex items-center">
                  <span
                    className="material-symbols-outlined absolute left-3.5 text-muted-foreground text-xl"
                    aria-hidden="true"
                  >
                    badge
                  </span>
                  <input
                    className="w-full pl-11 pr-4 py-3 bg-paper border border-border-strong rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-foreground placeholder:text-muted-foreground text-sm transition-all outline-none"
                    placeholder="Nguyễn Văn A"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5 ml-1">Email</label>
              <div className="relative flex items-center">
                <span
                  className="material-symbols-outlined absolute left-3.5 text-muted-foreground text-xl"
                  aria-hidden="true"
                >
                  mail
                </span>
                <input
                  className="w-full pl-11 pr-4 py-3 bg-paper border border-border-strong rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-foreground placeholder:text-muted-foreground text-sm transition-all outline-none"
                  placeholder="hocsinh@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {!isForgotPassword && (
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5 ml-1">
                  Mật khẩu
                </label>
                <div className="relative flex items-center">
                  <span
                    className="material-symbols-outlined absolute left-3.5 text-muted-foreground text-xl"
                    aria-hidden="true"
                  >
                    lock
                  </span>
                  <input
                    className="w-full pl-11 pr-11 py-3 bg-paper border border-border-strong rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-foreground placeholder:text-muted-foreground text-sm transition-all outline-none"
                    placeholder="•••••••• (Tối thiểu 6 ký tự)"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    className="absolute right-3.5 text-muted-foreground hover:text-foreground transition-colors flex items-center cursor-pointer"
                    type="button"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="material-symbols-outlined text-xl" aria-hidden="true">
                      {showPassword ? 'visibility' : 'visibility_off'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {isLogin && !isForgotPassword && (
              <div className="flex items-center justify-between pt-0.5">
                <button
                  type="button"
                  onClick={handleResendEmail}
                  disabled={isResending}
                  className="text-xs font-medium text-secondary-text hover:text-primary transition-colors cursor-pointer"
                >
                  {isResending ? 'Đang gửi...' : 'Chưa nhận được mail kích hoạt?'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(true);
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="text-xs font-bold text-primary hover:underline cursor-pointer"
                >
                  Quên mật khẩu?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-arena btn-arena-primary w-full mt-2"
            >
              <span>
                {isSubmitting
                  ? 'Đang xử lý...'
                  : isForgotPassword
                    ? 'Gửi link khôi phục'
                    : isLogin
                      ? 'Vào học ngay'
                      : 'Đăng ký tài khoản'}
              </span>
              {!isSubmitting && (
                <span className="material-symbols-outlined text-lg" aria-hidden="true">
                  arrow_forward
                </span>
              )}
            </button>

            {isForgotPassword && (
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="btn-arena btn-arena-secondary w-full mt-2"
              >
                Quay lại Đăng nhập
              </button>
            )}
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-secondary-text mt-6">
          {isLogin ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
          <button
            type="button"
            onClick={() => switchMode(!isLogin)}
            className="font-bold text-primary hover:underline cursor-pointer"
          >
            {isLogin ? 'Đăng ký miễn phí' : 'Đăng nhập tại đây'}
          </button>
        </p>
      </main>

      <div className="h-4 w-full" />
    </div>
  );
}
