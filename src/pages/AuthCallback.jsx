import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
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

function translateCallbackError(errorCode, errorDescription, lang = 'vi') {
  const combined = `${errorCode || ''} ${errorDescription || ''}`
    .replace(/\+/g, ' ')
    .toLowerCase();

  if (
    combined.includes('access_denied') ||
    combined.includes('user_cancelled') ||
    combined.includes('canceled')
  ) {
    return translate(lang, 'authCallback.errors.cancelled');
  }

  if (
    combined.includes('otp_expired') ||
    combined.includes('flow_state_expired') ||
    combined.includes('expired')
  ) {
    return translate(lang, 'authCallback.errors.expired');
  }

  if (
    combined.includes('bad_oauth_state') ||
    combined.includes('invalid_request') ||
    combined.includes('code verifier') ||
    combined.includes('pkce')
  ) {
    return translate(lang, 'authCallback.errors.pkceOrState');
  }

  if (combined.includes('email not confirmed')) {
    return translate(lang, 'authCallback.errors.unconfirmed');
  }

  if (
    combined.includes('server_error') ||
    combined.includes('temporarily_unavailable')
  ) {
    return translate(lang, 'authCallback.errors.serverBusy');
  }

  if (
    combined.includes('failed to fetch') ||
    combined.includes('networkerror') ||
    combined.includes('network request failed') ||
    combined.includes('load failed')
  ) {
    return translate(lang, 'authCallback.errors.network');
  }

  const readable = (errorDescription || errorCode || '').replace(/\+/g, ' ').trim();
  if (readable) {
    return translate(lang, 'authCallback.errors.genericWithReason', {
      reason: readable,
    });
  }

  return translate(lang, 'authCallback.errors.genericFallback');
}

export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const { user, isPasswordRecovery, signInWithGoogle, refreshProfile } =
    useAuth();

  const [runtimeErrorInfo, setRuntimeErrorInfo] = useState(null);
  const [dismissedUrlError, setDismissedUrlError] = useState(false);
  const [isRetryingGoogle, setIsRetryingGoogle] = useState(false);
  const redirectedRef = useRef(false);

  const parsedParams = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    const rawHash = location.hash ? location.hash.replace(/^#/, '') : '';
    const hashParams = new URLSearchParams(rawHash);

    const code = searchParams.get('code');
    const tokenHash = searchParams.get('token_hash');
    const flowType = searchParams.get('type') || hashParams.get('type') || '';
    const errorCode =
      searchParams.get('error_code') ||
      hashParams.get('error_code') ||
      searchParams.get('error') ||
      hashParams.get('error') ||
      '';
    const errorDescription =
      searchParams.get('error_description') ||
      hashParams.get('error_description') ||
      '';
    const safeNext = sanitizeNextPath(searchParams.get('next'), '/home');
    const hasUrlError = Boolean(errorCode || errorDescription);

    return {
      code,
      tokenHash,
      flowType,
      errorCode,
      errorDescription,
      safeNext,
      hasUrlError,
    };
  }, [location.hash, location.search]);

  const errorMessage = useMemo(() => {
    if (runtimeErrorInfo) {
      if (runtimeErrorInfo.isTimeout) {
        return translate(lang, 'authCallback.errors.timeout');
      }
      return translateCallbackError(
        runtimeErrorInfo.code,
        runtimeErrorInfo.message,
        lang,
      );
    }
    if (!dismissedUrlError && parsedParams.hasUrlError) {
      return translateCallbackError(
        parsedParams.errorCode,
        parsedParams.errorDescription,
        lang,
      );
    }
    return '';
  }, [
    dismissedUrlError,
    lang,
    parsedParams.errorCode,
    parsedParams.errorDescription,
    parsedParams.hasUrlError,
    runtimeErrorInfo,
  ]);

  const targetDestination = useMemo(() => {
    if (parsedParams.flowType === 'recovery' || isPasswordRecovery) {
      return '/auth?mode=update-password';
    }
    return parsedParams.safeNext;
  }, [isPasswordRecovery, parsedParams.flowType, parsedParams.safeNext]);

  // Redirect immediately once user is available when no explicit code/token exchange is pending
  useEffect(() => {
    if (
      redirectedRef.current ||
      parsedParams.hasUrlError ||
      parsedParams.code ||
      parsedParams.tokenHash
    ) {
      return;
    }
    if (user) {
      redirectedRef.current = true;
      navigate(targetDestination, { replace: true });
    }
  }, [
    navigate,
    parsedParams.code,
    parsedParams.hasUrlError,
    parsedParams.tokenHash,
    targetDestination,
    user,
  ]);

  // Process OAuth PKCE code, Email OTP token_hash, or Implicit hash session
  useEffect(() => {
    if (parsedParams.hasUrlError) {
      return undefined;
    }

    let active = true;

    const completeAuthExchange = async () => {
      try {
        if (parsedParams.code) {
          const { data, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(parsedParams.code);

          if (!active || redirectedRef.current) return;

          if (exchangeError) {
            // Re-check session in case detectSessionInUrl already consumed the PKCE code verifier
            const {
              data: { session: recheckedSession },
            } = await supabase.auth.getSession();

            if (!active || redirectedRef.current) return;

            if (recheckedSession?.user) {
              await refreshProfile?.();
              redirectedRef.current = true;
              navigate(targetDestination, { replace: true });
              return;
            }

            setRuntimeErrorInfo({
              code: exchangeError.code || exchangeError.name,
              message: exchangeError.message,
            });
            return;
          }

          if (data?.session?.user) {
            await refreshProfile?.();
            redirectedRef.current = true;
            navigate(targetDestination, { replace: true });
            return;
          }
        } else if (parsedParams.tokenHash && parsedParams.flowType) {
          const { data, error: otpError } = await supabase.auth.verifyOtp({
            token_hash: parsedParams.tokenHash,
            type: parsedParams.flowType,
          });

          if (!active || redirectedRef.current) return;

          if (otpError) {
            const {
              data: { session: recheckedSession },
            } = await supabase.auth.getSession();

            if (recheckedSession?.user) {
              await refreshProfile?.();
              redirectedRef.current = true;
              navigate(targetDestination, { replace: true });
              return;
            }

            setRuntimeErrorInfo({
              code: otpError.code,
              message: otpError.message,
            });
            return;
          }

          if (data?.session?.user) {
            await refreshProfile?.();
            redirectedRef.current = true;
            navigate(targetDestination, { replace: true });
            return;
          }
        }

        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        if (!active || redirectedRef.current) return;

        if (initialSession?.user) {
          redirectedRef.current = true;
          navigate(targetDestination, { replace: true });
        }
      } catch (err) {
        if (!active || redirectedRef.current) return;
        setRuntimeErrorInfo({
          code: '',
          message: err?.message,
        });
      }
    };

    completeAuthExchange();

    // 10-second safety timeout so user is never stuck on an infinite loading spinner
    const timeoutId = window.setTimeout(async () => {
      if (!active || redirectedRef.current) return;

      try {
        const {
          data: { session: lateSession },
        } = await supabase.auth.getSession();

        if (!active || redirectedRef.current) return;

        if (lateSession?.user) {
          redirectedRef.current = true;
          navigate(targetDestination, { replace: true });
          return;
        }
      } catch {
        // Ignore and fall through to friendly timeout prompt
      }

      setRuntimeErrorInfo((prev) => prev || { isTimeout: true });
    }, 10000);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [
    navigate,
    parsedParams.code,
    parsedParams.flowType,
    parsedParams.hasUrlError,
    parsedParams.tokenHash,
    refreshProfile,
    targetDestination,
  ]);

  const handleRetryGoogle = async () => {
    setDismissedUrlError(true);
    setRuntimeErrorInfo(null);
    setIsRetryingGoogle(true);
    try {
      const { error } = await signInWithGoogle(parsedParams.safeNext);
      if (error) {
        setRuntimeErrorInfo({
          code: error.code,
          message: error.message,
        });
        setIsRetryingGoogle(false);
      }
    } catch (err) {
      setRuntimeErrorInfo({
        code: '',
        message: err?.message,
      });
      setIsRetryingGoogle(false);
    }
  };

  const authFallbackHref =
    parsedParams.safeNext && parsedParams.safeNext !== '/home'
      ? `/auth?next=${encodeURIComponent(parsedParams.safeNext)}`
      : '/auth';

  return (
    <div className="bg-background font-sans text-foreground min-h-dvh flex flex-col justify-between relative overflow-hidden">
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

      <header className="relative z-10 flex items-center justify-between gap-3 px-4 sm:px-6 py-4 max-w-2xl mx-auto w-full">
        <Link to="/home" className="flex items-center gap-2.5 min-w-0">
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
            <span className="font-display font-extrabold text-base tracking-tight text-foreground block leading-none truncate">
              {t('brand.name')}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent block truncate mt-0.5">
              {t('brand.stationShort')}
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          <LanguageToggle variant="compact" />
          <ThemeToggle variant="compact" />
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-5 pb-10">
        <div className="imperial-frame w-full max-w-md p-6 sm:p-8 text-center">
          <div className="mb-4 flex justify-center">
            <RankSeal
              size="sm"
              variant={errorMessage ? 'outline' : 'solid'}
              icon={errorMessage ? 'error' : 'verified_user'}
              label={
                errorMessage
                  ? t('authCallback.sealError')
                  : t('authCallback.sealVerifying')
              }
            />
          </div>

          {errorMessage ? (
            <div role="alert" aria-live="assertive" className="space-y-5">
              <div>
                <h1 className="text-xl sm:text-2xl font-display font-extrabold text-foreground mb-2">
                  {t('authCallback.errorHeading')}
                </h1>
                <p className="text-sm text-secondary-text leading-relaxed">
                  {errorMessage}
                </p>
              </div>

              <div
                className="lattice-divider [&::before]:!bg-surface"
                aria-hidden="true"
              />

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleRetryGoogle}
                  disabled={isRetryingGoogle}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-surface hover:bg-surface-alt border-2 border-border-strong hover:border-gold text-foreground font-bold text-sm flex items-center justify-center gap-3 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-xs"
                >
                  {isRetryingGoogle ? (
                    <>
                      <span
                        className="material-symbols-outlined text-xl text-primary animate-spin"
                        aria-hidden="true"
                      >
                        progress_activity
                      </span>
                      <span>{t('authCallback.retryingGoogle')}</span>
                    </>
                  ) : (
                    <>
                      <GoogleLogoMark />
                      <span>{t('authCallback.retryGoogleBtn')}</span>
                    </>
                  )}
                </button>

                <Link
                  to={authFallbackHref}
                  className="btn-arena btn-arena-secondary w-full text-sm"
                >
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">
                    arrow_back
                  </span>
                  <span>{t('authCallback.backToLoginBtn')}</span>
                </Link>
              </div>
            </div>
          ) : (
            <div role="status" aria-live="polite" className="space-y-4 py-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft border border-gold/50 shadow-xs">
                <span
                  className="material-symbols-outlined text-3xl text-primary animate-spin"
                  aria-hidden="true"
                >
                  progress_activity
                </span>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-display font-extrabold text-foreground mb-1.5">
                  {t('authCallback.verifyingHeading')}
                </h1>
                <p className="text-xs sm:text-sm text-secondary-text leading-relaxed">
                  {t('authCallback.verifyingDesc')}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      <div className="h-4 w-full" />
    </div>
  );
}
