import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { sanitizeNextPath, useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { translate } from '../i18n';
import RankSeal from '../components/ui/RankSeal';
import LanguageToggle from '../components/ui/LanguageToggle';
import ThemeToggle from '../components/ui/ThemeToggle';

function GoogleLogoMark() {
  return (
    <svg className="h-5 w-5 no-shrink" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function isUnconfirmedAuthMessage(errOrMessage) {
  const raw =
    typeof errOrMessage === 'string'
      ? errOrMessage
      : errOrMessage?.message || errOrMessage?.code || '';
  return String(raw).toLowerCase().includes('email not confirmed');
}

function translateAuthError(errOrMessage, lang = 'vi') {
  const rawMessage =
    typeof errOrMessage === 'string'
      ? errOrMessage
      : errOrMessage?.message || '';
  const msg = String(rawMessage || '').toLowerCase();

  if (
    msg.includes('invalid login credentials') ||
    msg.includes('invalid credentials')
  ) {
    return translate(lang, 'authPage.errors.invalidCredentials');
  }
  if (msg.includes('email not confirmed')) {
    return translate(lang, 'authPage.errors.unconfirmedEmail');
  }
  if (
    msg.includes('user already registered') ||
    msg.includes('already exists')
  ) {
    return translate(lang, 'authPage.errors.alreadyRegistered');
  }
  if (msg.includes('password should be at least') || msg.includes('weak_password')) {
    return translate(lang, 'authPage.errors.passwordTooShort');
  }
  if (msg.includes('same password') || msg.includes('different from the old')) {
    return translate(lang, 'authPage.errors.samePassword');
  }
  if (
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('for security purposes') ||
    msg.includes('over_email_send_rate_limit')
  ) {
    return translate(lang, 'authPage.errors.rateLimited');
  }
  if (
    msg.includes('unable to validate email') ||
    msg.includes('invalid email')
  ) {
    return translate(lang, 'authPage.errors.invalidEmail');
  }
  if (msg.includes('provider is not enabled')) {
    return translate(lang, 'authPage.errors.providerDisabled');
  }
  if (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('fetch failed')
  ) {
    return translate(lang, 'authPage.errors.networkError');
  }
  return rawMessage
    ? translate(lang, 'authPage.errors.genericWithReason', { reason: rawMessage })
    : translate(lang, 'authPage.errors.genericFallback');
}

export default function AuthScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { lang, t } = useLanguage();

  const {
    user,
    loading: authLoading,
    isPasswordRecovery,
    clearPasswordRecovery,
    signIn,
    signUp,
    signInWithGoogle,
    resetPassword,
    updatePassword,
    resendConfirmation,
  } = useAuth();

  const queryMode = searchParams.get('mode');
  const safeNext = useMemo(
    () => sanitizeNextPath(searchParams.get('next'), '/home'),
    [searchParams],
  );

  // Modes: 'login' | 'register' | 'forgot-password' | 'update-password'
  const [mode, setMode] = useState(() => {
    if (queryMode === 'update-password' || isPasswordRecovery) {
      return 'update-password';
    }
    if (queryMode === 'forgot-password') {
      return 'forgot-password';
    }
    if (queryMode === 'register') {
      return 'register';
    }
    return 'login';
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errorState, setErrorState] = useState(null);
  const [successState, setSuccessState] = useState(null);
  const [isUnconfirmedError, setIsUnconfirmedError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const effectiveMode =
    isPasswordRecovery || queryMode === 'update-password'
      ? 'update-password'
      : mode;

  // Redirect authenticated users to safeNext unless they are setting a new password
  useEffect(() => {
    if (!authLoading && user && effectiveMode !== 'update-password') {
      navigate(safeNext, { replace: true });
    }
  }, [authLoading, effectiveMode, navigate, safeNext, user]);

  const errorMsg = useMemo(() => {
    if (!errorState) return '';
    if (errorState.key) return t(errorState.key, errorState.params);
    return translateAuthError(errorState.raw, lang);
  }, [errorState, lang, t]);

  const successMsg = useMemo(() => {
    if (!successState) return '';
    return t(successState.key, successState.params);
  }, [successState, t]);

  const clearFeedback = () => {
    setErrorState(null);
    setSuccessState(null);
    setIsUnconfirmedError(false);
  };

  const setValidationError = (key, params) => {
    setErrorState({ key, params });
  };

  const setAuthException = (err) => {
    if (isUnconfirmedAuthMessage(err)) {
      setIsUnconfirmedError(true);
    }
    setErrorState({ raw: err?.message || '' });
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    clearFeedback();

    if (queryMode === 'update-password' || isPasswordRecovery) {
      clearPasswordRecovery();
      const updated = new URLSearchParams(searchParams);
      updated.delete('mode');
      setSearchParams(updated, { replace: true });
    }
  };

  const handleGoogleSignIn = async () => {
    clearFeedback();
    setIsGoogleLoading(true);

    try {
      const { error } = await signInWithGoogle(safeNext);
      if (error) {
        throw error;
      }
      // Browser navigates to Google OAuth consent screen
    } catch (err) {
      console.error('[AuthScreen] Google OAuth error:', err);
      setAuthException(err);
      setIsGoogleLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!email.trim()) {
      setValidationError('authPage.validation.enterEmailBeforeResend');
      return;
    }

    setIsResending(true);
    setErrorState(null);
    setSuccessState(null);

    try {
      const { error } = await resendConfirmation(email);
      if (error) throw error;
      setSuccessState({
        key: 'authPage.success.resentEmail',
        params: { email: email.trim() },
      });
      setIsUnconfirmedError(false);
    } catch (err) {
      setAuthException(err);
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearFeedback();

    if (effectiveMode === 'update-password') {
      if (!password || password.length < 6) {
        setValidationError('authPage.validation.newPasswordMin');
        return;
      }
      if (password !== confirmPassword) {
        setValidationError('authPage.validation.passwordMismatch');
        return;
      }

      setIsSubmitting(true);
      try {
        const { error } = await updatePassword(password);
        if (error) throw error;

        clearPasswordRecovery();
        const cleanedParams = new URLSearchParams(searchParams);
        cleanedParams.delete('mode');
        setSearchParams(cleanedParams, { replace: true });

        setPassword('');
        setConfirmPassword('');
        setSuccessState({ key: 'authPage.success.passwordUpdated' });
        window.setTimeout(() => {
          navigate(safeNext, { replace: true });
        }, 900);
      } catch (err) {
        setAuthException(err);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setValidationError('authPage.validation.enterEmail');
      return;
    }

    if (effectiveMode === 'forgot-password') {
      setIsSubmitting(true);
      try {
        const { error } = await resetPassword(trimmedEmail);
        if (error) throw error;
        setSuccessState({
          key: 'authPage.success.resetLinkSent',
          params: { email: trimmedEmail },
        });
      } catch (err) {
        setAuthException(err);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!password) {
      setValidationError('authPage.validation.enterPassword');
      return;
    }

    if (effectiveMode === 'register' && !fullName.trim()) {
      setValidationError('authPage.validation.enterFullName');
      return;
    }

    if (effectiveMode === 'register' && password.length < 6) {
      setValidationError('authPage.validation.passwordMin');
      return;
    }

    setIsSubmitting(true);
    try {
      if (effectiveMode === 'login') {
        const { error } = await signIn(trimmedEmail, password);
        if (error) throw error;
        navigate(safeNext, { replace: true });
      } else {
        const { data, error } = await signUp(trimmedEmail, password, fullName);
        if (error) throw error;

        if (
          data?.user &&
          Array.isArray(data.user.identities) &&
          data.user.identities.length === 0
        ) {
          setValidationError('authPage.validation.alreadyRegisteredGoogleHint');
          return;
        }

        if (data?.user && !data?.session) {
          setSuccessState({
            key: 'authPage.success.registeredVerifyEmail',
            params: { email: trimmedEmail },
          });
          setMode('login');
          setPassword('');
        } else {
          navigate(safeNext, { replace: true });
        }
      }
    } catch (err) {
      console.error('[AuthScreen] Submit error:', err);
      setAuthException(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBusy = isSubmitting || isGoogleLoading;
  const showGoogleAndTabs =
    effectiveMode === 'login' || effectiveMode === 'register';

  const rawPillars = t('authPage.pillars');
  const scholarPillars = Array.isArray(rawPillars) ? rawPillars : [];

  const sealConfig =
    effectiveMode === 'update-password'
      ? { icon: 'lock_reset', label: t('authPage.sealUpdatePassword') }
      : effectiveMode === 'forgot-password'
        ? { icon: 'mail_lock', label: t('authPage.sealForgotPassword') }
        : effectiveMode === 'register'
          ? { icon: 'person_add', label: t('authPage.sealRegister') }
          : { icon: 'school', label: t('authPage.sealLogin') };

  const headingText =
    effectiveMode === 'update-password'
      ? t('authPage.headingUpdatePassword')
      : effectiveMode === 'forgot-password'
        ? t('authPage.headingForgotPassword')
        : effectiveMode === 'register'
          ? t('authPage.headingRegister')
          : t('authPage.headingLogin');

  const subtitleText =
    effectiveMode === 'update-password'
      ? t('authPage.subUpdatePassword')
      : effectiveMode === 'forgot-password'
        ? t('authPage.subForgotPassword')
        : effectiveMode === 'register'
          ? t('authPage.subRegister')
          : safeNext !== '/home'
            ? t('authPage.subLoginNext')
            : t('authPage.subLoginDefault');

  const inputBaseClass =
    'w-full pl-11 pr-4 py-3 bg-paper border border-border-strong rounded-xl focus:ring-2 focus:ring-primary/35 focus:border-primary text-foreground placeholder:text-muted-foreground text-sm transition-all outline-none disabled:opacity-60';

  return (
    <div className="bg-background font-sans text-foreground min-h-dvh flex flex-col justify-between relative overflow-x-hidden">
      {/* Decorative Classical Hanzi Watermarks */}
      <span
        aria-hidden="true"
        className="hanzi-watermark hidden md:block fixed top-14 left-8 text-[128px] font-bold text-accent/7"
      >
        文昌
      </span>
      <span
        aria-hidden="true"
        className="hanzi-watermark hidden md:block fixed bottom-10 right-8 text-[128px] font-bold text-primary/6"
      >
        登科
      </span>

      {/* Top Navigation Header */}
      <header className="relative z-10 flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-10 py-4 max-w-6xl mx-auto w-full">
        <Link to="/home" className="flex items-center gap-2.5 group min-w-0">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary-soft border border-gold overflow-hidden no-shrink shadow-xs">
            <img
              src="/logo.webp"
              alt={t('brand.name')}
              width={40}
              height={40}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <span className="font-display font-extrabold text-base sm:text-lg tracking-tight text-foreground block leading-none truncate">
              {t('brand.name')}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent block truncate mt-0.5">
              {t('brand.stationSub')}
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <LanguageToggle variant="compact" />
          <ThemeToggle variant="compact" />
          <Link
            to="/home"
            className="text-xs font-bold text-primary hover:text-primary-hover flex items-center gap-1 px-3 py-2 min-h-[36px] rounded-xl bg-primary-soft border border-primary/25 transition-colors"
          >
            <span className="hidden xs:inline sm:inline">{t('authPage.exploreFirst')}</span>
            <span className="material-symbols-outlined text-sm" aria-hidden="true">
              arrow_forward
            </span>
          </Link>
        </div>
      </header>

      {/* Main Responsive 2-Column Scholarly Split Layout */}
      <main className="relative z-10 flex-1 flex items-center px-4 sm:px-6 lg:px-10 py-4 sm:py-6 max-w-6xl mx-auto w-full">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12 items-center">
          {/* Left Panel: Brand Storytelling (Desktop) */}
          <section
            aria-label={t('authPage.showcaseAria')}
            className="hidden lg:flex lg:col-span-6 xl:col-span-7 flex-col justify-center space-y-6 pr-2 relative"
          >
            <div className="space-y-4">
              <RankSeal
                size="sm"
                variant="gold"
                icon="workspace_premium"
                label={t('brand.stationShort')}
                sublabel={t('authPage.showcaseSubseal')}
              />

              <h2 className="text-3xl xl:text-4xl font-display font-extrabold tracking-tight text-foreground leading-[1.22]">
                {t('authPage.showcaseTitleLead')}{' '}
                <span className="brush-underline text-primary">
                  {t('authPage.showcaseTitleHighlight')}
                </span>
              </h2>

              <p className="text-sm xl:text-base text-secondary-text leading-relaxed max-w-xl">
                {t('authPage.showcaseDesc')}
              </p>
            </div>

            <div className="space-y-3.5 max-w-xl">
              {scholarPillars.map((pillar) => (
                <div
                  key={pillar.title}
                  className="paper-card p-4 flex items-start gap-3.5 bg-paper/90 border border-border hover:border-border-strong"
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border no-shrink ${pillar.badgeClass}`}
                  >
                    <span
                      className="material-symbols-outlined text-xl icon-fill"
                      aria-hidden="true"
                    >
                      {pillar.icon}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-display font-bold text-foreground leading-snug">
                      {pillar.title}
                    </h3>
                    <p className="text-xs text-secondary-text leading-relaxed mt-1">
                      {pillar.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="max-w-xl pt-1 space-y-3">
              <div className="lattice-divider" aria-hidden="true" />
              <p className="text-xs text-muted-foreground italic font-serif">
                {t('authPage.quote')}
              </p>
            </div>
          </section>

          {/* Right Panel: Imperial Frame Auth Card */}
          <section className="lg:col-span-6 xl:col-span-5 w-full max-w-md mx-auto">
            <div className="imperial-frame p-6 sm:p-8">
              {/* Card Header */}
              <div className="mb-5 text-center sm:text-left">
                <div className="mb-3">
                  <RankSeal
                    size="sm"
                    icon={sealConfig.icon}
                    label={sealConfig.label}
                  />
                </div>
                <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-foreground mb-1.5">
                  {headingText}
                </h1>
                <p className="text-secondary-text text-xs sm:text-sm leading-relaxed">
                  {subtitleText}
                </p>
              </div>

              {/* Segmented Mode Switch (Login / Register / Forgot Password) */}
              {effectiveMode !== 'update-password' && (
                <div
                  className="p-1 bg-surface-alt rounded-xl grid grid-cols-3 gap-1 mb-5 border border-border"
                  role="group"
                  aria-label={t('authPage.modeGroupAria')}
                >
                  <button
                    type="button"
                    aria-pressed={effectiveMode === 'login'}
                    disabled={isBusy}
                    onClick={() => switchMode('login')}
                    className={`py-2 px-2 text-xs sm:text-sm font-display font-bold rounded-lg transition-all cursor-pointer truncate ${
                      effectiveMode === 'login'
                        ? 'bg-primary text-on-primary border border-primary-hover shadow-xs'
                        : 'border border-transparent text-secondary-text hover:text-foreground'
                    }`}
                  >
                    {t('authPage.tabLogin')}
                  </button>
                  <button
                    type="button"
                    aria-pressed={effectiveMode === 'register'}
                    disabled={isBusy}
                    onClick={() => switchMode('register')}
                    className={`py-2 px-2 text-xs sm:text-sm font-display font-bold rounded-lg transition-all cursor-pointer truncate ${
                      effectiveMode === 'register'
                        ? 'bg-primary text-on-primary border border-primary-hover shadow-xs'
                        : 'border border-transparent text-secondary-text hover:text-foreground'
                    }`}
                  >
                    {t('authPage.tabRegister')}
                  </button>
                  <button
                    type="button"
                    aria-pressed={effectiveMode === 'forgot-password'}
                    disabled={isBusy}
                    onClick={() => switchMode('forgot-password')}
                    className={`py-2 px-2 text-xs sm:text-sm font-display font-bold rounded-lg transition-all cursor-pointer truncate ${
                      effectiveMode === 'forgot-password'
                        ? 'bg-primary text-on-primary border border-primary-hover shadow-xs'
                        : 'border border-transparent text-secondary-text hover:text-foreground'
                    }`}
                  >
                    {t('authPage.tabForgot')}
                  </button>
                </div>
              )}

              {/* Prominent Primary Google OAuth CTA */}
              {showGoogleAndTabs && (
                <div className="mb-5">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isBusy}
                    className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-surface hover:bg-surface-alt border-2 border-border-strong hover:border-gold text-foreground font-bold text-sm sm:text-base flex items-center justify-center gap-3 transition-all cursor-pointer active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed shadow-xs"
                  >
                    {isGoogleLoading ? (
                      <>
                        <span
                          className="material-symbols-outlined text-xl text-primary animate-spin"
                          aria-hidden="true"
                        >
                          progress_activity
                        </span>
                        <span>{t('authPage.googleRedirecting')}</span>
                      </>
                    ) : (
                      <>
                        <GoogleLogoMark />
                        <span>
                          {effectiveMode === 'register'
                            ? t('authPage.googleRegister')
                            : t('authPage.googleContinue')}
                        </span>
                      </>
                    )}
                  </button>

                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground text-center px-1">
                    {t('authPage.googleHint')}
                  </p>

                  <div
                    className="mt-4 space-y-2"
                    role="separator"
                    aria-label={t('authPage.orUseEmail')}
                  >
                    <div
                      className="lattice-divider [&::before]:!bg-surface"
                      aria-hidden="true"
                    />
                    <p className="text-center text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      {t('authPage.orUseEmail')}
                    </p>
                  </div>
                </div>
              )}

              {/* Success Feedback Box */}
              {successMsg && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mb-5 p-4 rounded-xl bg-jade-soft border border-jade-border text-foreground text-sm flex items-start gap-2.5"
                >
                  <span
                    className="material-symbols-outlined text-jade no-shrink text-xl"
                    aria-hidden="true"
                  >
                    check_circle
                  </span>
                  <span className="leading-relaxed font-medium text-xs sm:text-sm">
                    {successMsg}
                  </span>
                </div>
              )}

              {/* Error Feedback Box */}
              {errorMsg && (
                <div
                  id="auth-error-box"
                  role="alert"
                  aria-live="assertive"
                  className="mb-5 p-4 rounded-xl bg-primary-soft border border-primary/35 text-foreground text-sm flex flex-col gap-3"
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className="material-symbols-outlined text-primary no-shrink text-xl"
                      aria-hidden="true"
                    >
                      error
                    </span>
                    <span className="leading-relaxed text-xs sm:text-sm">
                      {errorMsg}
                    </span>
                  </div>

                  {isUnconfirmedError && (
                    <button
                      type="button"
                      onClick={handleResendEmail}
                      disabled={isResending}
                      className="self-start px-3 py-2 min-h-[38px] rounded-lg bg-surface hover:bg-surface-alt text-primary border border-primary/30 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      <span
                        className="material-symbols-outlined text-sm"
                        aria-hidden="true"
                      >
                        send
                      </span>
                      <span>
                        {isResending
                          ? t('authPage.resendingBtn')
                          : t('authPage.resendConfirmBtn')}
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* Expired / Missing Session Notice in Update Password Mode */}
              {effectiveMode === 'update-password' && !authLoading && !user ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-gold-soft border border-gold-border text-foreground text-xs sm:text-sm leading-relaxed">
                    {t('authPage.expiredRecoveryNotice')}
                  </div>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot-password')}
                    className="btn-arena btn-arena-primary w-full"
                  >
                    <span>{t('authPage.requestNewRecoveryBtn')}</span>
                    <span
                      className="material-symbols-outlined text-lg"
                      aria-hidden="true"
                    >
                      arrow_forward
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="btn-arena btn-arena-secondary w-full"
                  >
                    {t('authPage.backToLogin')}
                  </button>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleSubmit} noValidate>
                  {/* Full Name (Register Mode) */}
                  {effectiveMode === 'register' && (
                    <div>
                      <label
                        htmlFor="auth-fullname"
                        className="block text-xs font-bold text-foreground mb-1.5 ml-1"
                      >
                        {t('authPage.fullNameLabel')}
                      </label>
                      <div className="relative flex items-center">
                        <span
                          className="material-symbols-outlined absolute left-3.5 text-muted-foreground text-xl pointer-events-none"
                          aria-hidden="true"
                        >
                          badge
                        </span>
                        <input
                          id="auth-fullname"
                          name="fullName"
                          type="text"
                          autoComplete="name"
                          disabled={isBusy}
                          aria-invalid={Boolean(errorMsg && !fullName.trim())}
                          aria-describedby={errorMsg ? 'auth-error-box' : undefined}
                          className={inputBaseClass}
                          placeholder={t('authPage.fullNamePlaceholder')}
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Email Input (Login / Register / Forgot Password) */}
                  {effectiveMode !== 'update-password' && (
                    <div>
                      <label
                        htmlFor="auth-email"
                        className="block text-xs font-bold text-foreground mb-1.5 ml-1"
                      >
                        {t('authPage.emailLabel')}
                      </label>
                      <div className="relative flex items-center">
                        <span
                          className="material-symbols-outlined absolute left-3.5 text-muted-foreground text-xl pointer-events-none"
                          aria-hidden="true"
                        >
                          mail
                        </span>
                        <input
                          id="auth-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          disabled={isBusy}
                          aria-invalid={Boolean(errorMsg)}
                          aria-describedby={errorMsg ? 'auth-error-box' : undefined}
                          className={inputBaseClass}
                          placeholder={t('authPage.emailPlaceholder')}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Password Input (Login / Register / Update Password) */}
                  {effectiveMode !== 'forgot-password' && (
                    <div>
                      <label
                        htmlFor="auth-password"
                        className="block text-xs font-bold text-foreground mb-1.5 ml-1"
                      >
                        {effectiveMode === 'update-password'
                          ? t('authPage.newPasswordLabel')
                          : t('authPage.passwordLabel')}
                      </label>
                      <div className="relative flex items-center">
                        <span
                          className="material-symbols-outlined absolute left-3.5 text-muted-foreground text-xl pointer-events-none"
                          aria-hidden="true"
                        >
                          lock
                        </span>
                        <input
                          id="auth-password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete={
                            effectiveMode === 'login'
                              ? 'current-password'
                              : 'new-password'
                          }
                          disabled={isBusy}
                          aria-invalid={Boolean(errorMsg)}
                          aria-describedby={errorMsg ? 'auth-error-box' : undefined}
                          className={`${inputBaseClass} pr-12`}
                          placeholder={t('authPage.passwordPlaceholder')}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          aria-label={
                            showPassword
                              ? t('authPage.hidePasswordAria')
                              : t('authPage.showPasswordAria')
                          }
                          aria-pressed={showPassword}
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute right-1.5 h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-alt transition-colors flex items-center justify-center cursor-pointer"
                        >
                          <span
                            className="material-symbols-outlined text-xl"
                            aria-hidden="true"
                          >
                            {showPassword ? 'visibility' : 'visibility_off'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Confirm New Password Input (Update Password Mode) */}
                  {effectiveMode === 'update-password' && (
                    <div>
                      <label
                        htmlFor="auth-confirm-password"
                        className="block text-xs font-bold text-foreground mb-1.5 ml-1"
                      >
                        {t('authPage.confirmPasswordLabel')}
                      </label>
                      <div className="relative flex items-center">
                        <span
                          className="material-symbols-outlined absolute left-3.5 text-muted-foreground text-xl pointer-events-none"
                          aria-hidden="true"
                        >
                          verified_user
                        </span>
                        <input
                          id="auth-confirm-password"
                          name="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          disabled={isBusy}
                          aria-invalid={Boolean(errorMsg)}
                          aria-describedby={errorMsg ? 'auth-error-box' : undefined}
                          className={`${inputBaseClass} pr-12`}
                          placeholder={t('authPage.confirmPasswordPlaceholder')}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          aria-label={
                            showConfirmPassword
                              ? t('authPage.hideConfirmPasswordAria')
                              : t('authPage.showConfirmPasswordAria')
                          }
                          aria-pressed={showConfirmPassword}
                          onClick={() =>
                            setShowConfirmPassword((prev) => !prev)
                          }
                          className="absolute right-1.5 h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-alt transition-colors flex items-center justify-center cursor-pointer"
                        >
                          <span
                            className="material-symbols-outlined text-xl"
                            aria-hidden="true"
                          >
                            {showConfirmPassword
                              ? 'visibility'
                              : 'visibility_off'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Helper Actions Row (Login Mode) */}
                  {effectiveMode === 'login' && (
                    <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
                      <button
                        type="button"
                        onClick={handleResendEmail}
                        disabled={isResending || isBusy}
                        className="text-xs font-medium text-secondary-text hover:text-primary transition-colors cursor-pointer py-1"
                      >
                        {isResending
                          ? t('authPage.sendingShort')
                          : t('authPage.missingActivationPrompt')}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => switchMode('forgot-password')}
                        className="text-xs font-bold text-primary hover:underline cursor-pointer py-1"
                      >
                        {t('authPage.forgotPasswordPrompt')}
                      </button>
                    </div>
                  )}

                  {/* Primary Submit CTA */}
                  <button
                    type="submit"
                    disabled={isBusy}
                    className="btn-arena btn-arena-primary w-full mt-2"
                  >
                    {isSubmitting ? (
                      <>
                        <span
                          className="material-symbols-outlined text-lg animate-spin"
                          aria-hidden="true"
                        >
                          progress_activity
                        </span>
                        <span>{t('authPage.processing')}</span>
                      </>
                    ) : (
                      <>
                        <span>
                          {effectiveMode === 'update-password'
                            ? t('authPage.submitUpdatePassword')
                            : effectiveMode === 'forgot-password'
                              ? t('authPage.submitForgotPassword')
                              : effectiveMode === 'login'
                                ? t('authPage.submitLogin')
                                : t('authPage.submitRegister')}
                        </span>
                        <span
                          className="material-symbols-outlined text-lg"
                          aria-hidden="true"
                        >
                          arrow_forward
                        </span>
                      </>
                    )}
                  </button>

                  {/* Back to Login Button (Forgot / Update Password Modes) */}
                  {(effectiveMode === 'forgot-password' ||
                    effectiveMode === 'update-password') && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => switchMode('login')}
                      className="btn-arena btn-arena-secondary w-full mt-2"
                    >
                      {t('authPage.backToLogin')}
                    </button>
                  )}
                </form>
              )}
            </div>

            {/* Bottom Mode Switch Prompt */}
            {showGoogleAndTabs && (
              <p className="text-center text-xs text-secondary-text mt-5">
                {effectiveMode === 'login'
                  ? t('authPage.noAccountPrompt')
                  : t('authPage.hasAccountPrompt')}
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    switchMode(
                      effectiveMode === 'login' ? 'register' : 'login',
                    )
                  }
                  className="font-bold text-primary hover:underline cursor-pointer py-1"
                >
                  {effectiveMode === 'login'
                    ? t('authPage.switchRegisterLink')
                    : t('authPage.switchLoginLink')}
                </button>
              </p>
            )}
          </section>
        </div>
      </main>

      <div className="h-4 w-full" />
    </div>
  );
}
