import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import useSWR from 'swr';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

const PROFILE_COLUMNS = `
  id, display_name, full_name, email, avatar_url, role,
  university, major, starting_year, user_mode,
  target_gpa, target_thpt, target_dgnl, current_gpa,
  admission_scores, is_approved_bang_chu,
  is_vip, vip_expired_at, roadmap_data,
  exp, study_seconds, study_streak, last_study_date
`;

const PROFILE_COLUMNS_FALLBACK = `
  id, display_name, full_name, email, avatar_url, role,
  university, major, starting_year, user_mode,
  target_gpa, target_thpt, target_dgnl, current_gpa,
  admission_scores, is_approved_bang_chu,
  is_vip, vip_expired_at, roadmap_data
`;

// eslint-disable-next-line react-refresh/only-export-components
export function sanitizeNextPath(rawNext, fallback = '/home') {
  if (typeof rawNext !== 'string') return fallback;
  const trimmed = rawNext.trim();
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/auth')
  ) {
    return fallback;
  }
  return trimmed;
}

const PRIMARY_SITE_ORIGIN = 'https://www.dautruonghoctap.dev';

const SUPPORTED_AUTH_ORIGINS = new Set([
  'https://www.dautruonghoctap.dev',
  'https://dautruonghoctap.dev',
  'https://www.dautruonghoctap.io.vn',
  'https://dautruonghoctap.io.vn',
]);

function getCallbackBaseUrl() {
  const envRedirect = import.meta.env.VITE_GOOGLE_REDIRECT_URL?.trim();
  if (typeof window !== 'undefined' && window.location?.origin) {
    const currentOrigin = window.location.origin;
    if (
      SUPPORTED_AUTH_ORIGINS.has(currentOrigin) ||
      currentOrigin.startsWith('http://localhost:') ||
      currentOrigin.startsWith('http://127.0.0.1:')
    ) {
      return `${currentOrigin}/auth/callback`;
    }
    if (envRedirect) {
      return envRedirect;
    }
    return `${currentOrigin}/auth/callback`;
  }
  if (envRedirect) {
    return envRedirect;
  }
  return `${PRIMARY_SITE_ORIGIN}/auth/callback`;
}

function buildCallbackUrl(nextPath = '/home') {
  const safeNext = sanitizeNextPath(nextPath, '/home');
  const base = getCallbackBaseUrl();
  if (typeof window === 'undefined') {
    return `${base}?next=${encodeURIComponent(safeNext)}`;
  }
  const url = new URL(base, window.location.origin);
  url.searchParams.set('next', safeNext);
  return url.toString();
}

function enrichProfile(row) {
  if (!row) return null;
  const studySeconds = Number(row.study_seconds) || 0;
  return {
    ...row,
    total_study_minutes:
      row.total_study_minutes ?? Math.floor(studySeconds / 60),
  };
}

const fetcherProfile = async (userOrId) => {
  const authUser =
    typeof userOrId === 'object' && userOrId !== null ? userOrId : null;
  const userId =
    authUser?.id || (typeof userOrId === 'string' ? userOrId : null);

  if (!userId) return null;

  let activeColumns = PROFILE_COLUMNS;
  let { data, error } = await supabase
    .from('profiles')
    .select(activeColumns)
    .eq('id', userId)
    .maybeSingle();

  if (error && String(error.code) === '42703') {
    activeColumns = PROFILE_COLUMNS_FALLBACK;
    const retry = await supabase
      .from('profiles')
      .select(activeColumns)
      .eq('id', userId)
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error('[AuthContext] Error fetching profile:', error);
    return null;
  }

  // Google OAuth & First Sign-In Profile Auto-Sync
  // Note: NEVER write protected columns (role, is_approved_bang_chu, is_vip,
  // vip_expired_at, exp, study_seconds, study_streak, last_study_date) from client.
  if (authUser) {
    const metadata = authUser.user_metadata || {};
    const metaName = String(
      metadata.full_name ||
        metadata.name ||
        authUser.email?.split('@')[0] ||
        'Sĩ tử',
    ).trim();
    const metaAvatar = metadata.avatar_url || metadata.picture || null;

    if (!data) {
      const insertPayload = {
        id: userId,
        display_name: metaName,
        full_name: metaName,
        avatar_url: metaAvatar,
        email: authUser.email || null,
      };

      const { data: createdProfile, error: upsertError } = await supabase
        .from('profiles')
        .upsert(insertPayload, { onConflict: 'id' })
        .select(activeColumns)
        .maybeSingle();

      if (upsertError) {
        console.warn(
          '[AuthContext] Profile auto-create encountered error, re-reading row:',
          upsertError,
        );
        const { data: refetched } = await supabase
          .from('profiles')
          .select(activeColumns)
          .eq('id', userId)
          .maybeSingle();
        return enrichProfile(
          refetched || {
            ...insertPayload,
            role: 'user',
          },
        );
      }

      return enrichProfile(createdProfile || { ...insertPayload, role: 'user' });
    }

    const gentlePatch = {};
    if (!data.display_name && metaName) {
      gentlePatch.display_name = metaName;
    }
    if (!data.full_name && metaName) {
      gentlePatch.full_name = metaName;
    }
    if (!data.avatar_url && metaAvatar) {
      gentlePatch.avatar_url = metaAvatar;
    }
    if (!data.email && authUser.email) {
      gentlePatch.email = authUser.email;
    }

    if (Object.keys(gentlePatch).length > 0) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update(gentlePatch)
        .eq('id', userId);

      if (!updateError) {
        return enrichProfile({ ...data, ...gentlePatch });
      }
      console.warn('[AuthContext] Gentle profile sync skipped:', updateError);
    }
  }

  return enrichProfile(data);
};

function detectInitialRecoveryState() {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  return (
    hash.includes('type=recovery') || search.includes('mode=update-password')
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(
    detectInitialRecoveryState,
  );

  const userRef = useRef(null);
  userRef.current = user;

  useEffect(() => {
    let active = true;

    const bootstrapSession = async () => {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();
        if (!active) return;
        setSession(initialSession ?? null);
        setUser(initialSession?.user ?? null);
      } catch (err) {
        console.error('[AuthContext] Session bootstrap error:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    bootstrapSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      } else if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false);
      }

      setSession((prevSession) => {
        if (!nextSession) return null;
        if (prevSession?.access_token === nextSession.access_token) {
          return prevSession;
        }
        return nextSession;
      });

      const nextUser = nextSession?.user ?? null;
      // Preserve stable user object reference on TOKEN_REFRESHED when identity/metadata
      // did not change, avoiding unnecessary downstream useEffect re-runs on tab focus.
      setUser((prevUser) => {
        if (!nextUser) return null;
        if (
          prevUser?.id === nextUser.id &&
          prevUser?.email === nextUser.email &&
          prevUser?.updated_at === nextUser.updated_at &&
          prevUser?.last_sign_in_at === nextUser.last_sign_in_at &&
          (prevUser?.identities?.length ?? 0) ===
            (nextUser.identities?.length ?? 0)
        ) {
          return prevUser;
        }
        return nextUser;
      });

      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const isGoogleLinked = Boolean(
    user?.app_metadata?.provider === 'google' ||
      user?.app_metadata?.providers?.includes?.('google') ||
      user?.identities?.some((identity) => identity.provider === 'google'),
  );

  const { data: profile = null, mutate: refreshProfile } = useSWR(
    user?.id ? `profile-${user.id}-${isGoogleLinked ? 'g' : 'e'}` : null,
    () => fetcherProfile(userRef.current || user?.id),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
    },
  );

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
  }, []);

  const signIn = useCallback(async (email, password) => {
    return supabase.auth.signInWithPassword({
      email: String(email || '').trim(),
      password,
    });
  }, []);

  const signUp = useCallback(async (email, password, fullName) => {
    const cleanEmail = String(email || '').trim();
    const cleanName = String(fullName || '').trim();
    const emailRedirectTo = getCallbackBaseUrl();

    return supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo,
        data: {
          full_name: cleanName,
          display_name: cleanName,
        },
      },
    });
  }, []);

  const signInWithGoogle = useCallback(async (redirectPath = '/home') => {
    const safeNext = sanitizeNextPath(redirectPath, '/home');
    const redirectTo = buildCallbackUrl(safeNext);

    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });
  }, []);

  const signOut = useCallback(async () => {
    const res = await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsPasswordRecovery(false);
    refreshProfile(null, false);
    return res;
  }, [refreshProfile]);

  const resetPassword = useCallback(async (email) => {
    const cleanEmail = String(email || '').trim();
    const redirectTo =
      typeof window !== 'undefined' && window.location?.origin
        ? `${window.location.origin}/auth?mode=update-password`
        : `${PRIMARY_SITE_ORIGIN}/auth?mode=update-password`;

    return supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
  }, []);

  const updatePassword = useCallback(async (newPassword) => {
    const res = await supabase.auth.updateUser({ password: newPassword });
    if (!res.error) {
      setIsPasswordRecovery(false);
    }
    return res;
  }, []);

  const resendConfirmation = useCallback(async (email) => {
    const cleanEmail = String(email || '').trim();
    const emailRedirectTo = getCallbackBaseUrl();

    return supabase.auth.resend({
      type: 'signup',
      email: cleanEmail,
      options: {
        emailRedirectTo,
      },
    });
  }, []);

  const isAdmin = profile?.role === 'admin';
  const isCollaborator =
    profile?.role === 'collaborator' || profile?.role === 'admin';

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      loading,
      refreshProfile,
      isAdmin,
      isCollaborator,
      isGoogleLinked,
      isPasswordRecovery,
      clearPasswordRecovery,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      resetPassword,
      updatePassword,
      resendConfirmation,
    }),
    [
      user,
      session,
      profile,
      loading,
      refreshProfile,
      isAdmin,
      isCollaborator,
      isGoogleLinked,
      isPasswordRecovery,
      clearPasswordRecovery,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      resetPassword,
      updatePassword,
      resendConfirmation,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
