import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();
const PROFILE_CACHE_PREFIX = 'dtht.profile-cache.v1:';

function readCachedProfile(userId) {
  if (!userId || typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(`${PROFILE_CACHE_PREFIX}${userId}`);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw);
  } catch (error) {
    console.warn('[AuthContext] Could not read cached profile.', error);
    return null;
  }
}

function writeCachedProfile(userId, profile) {
  if (!userId || !profile || typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(`${PROFILE_CACHE_PREFIX}${userId}`, JSON.stringify(profile));
  } catch (error) {
    console.warn('[AuthContext] Could not cache profile.', error);
  }
}

function clearCachedProfile(userId) {
  if (!userId || typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(`${PROFILE_CACHE_PREFIX}${userId}`);
  } catch (error) {
    console.warn('[AuthContext] Could not clear cached profile.', error);
  }
}

function normalizeProfile(data) {
  if (!data) {
    return null;
  }

  const isVipExpired = data.is_vip && data.vip_expired_at && new Date(data.vip_expired_at) < new Date();
  return isVipExpired ? { ...data, is_vip: false } : data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const activeProfileRequestRef = useRef(0);

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return null;
    }

    const requestId = activeProfileRequestRef.current + 1;
    activeProfileRequestRef.current = requestId;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, display_name, avatar_url, role, university,
          user_mode, target_gpa, target_thpt, target_dgnl, current_gpa,
          is_vip, vip_expired_at, admission_scores
        `)
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      const nextProfile = normalizeProfile(data);

      if (activeProfileRequestRef.current === requestId) {
        setProfile(nextProfile);
      }

      writeCachedProfile(userId, nextProfile);
      return nextProfile;
    } catch (error) {
      console.error('Unexpected error fetching profile:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrapSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) {
          return;
        }

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          const cachedProfile = readCachedProfile(currentUser.id);
          setProfile(cachedProfile);
          fetchProfile(currentUser.id);
        } else {
          setProfile(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    bootstrapSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) {
        return;
      }

      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setLoading(false);

      if (!currentUser) {
        activeProfileRequestRef.current += 1;
        setProfile(null);
        return;
      }

      const cachedProfile = readCachedProfile(currentUser.id);
      setProfile(cachedProfile);
      fetchProfile(currentUser.id);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const refreshProfile = useCallback(() => {
    if (!user?.id) {
      return Promise.resolve(null);
    }

    clearCachedProfile(user.id);
    return fetchProfile(user.id);
  }, [fetchProfile, user?.id]);

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    refreshProfile,
  }), [loading, profile, refreshProfile, user]);

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
