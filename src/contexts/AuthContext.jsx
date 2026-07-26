import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useMemo,
} from 'react';
import { supabase } from '../lib/supabase';
import useSWR from 'swr';

const AuthContext = createContext();

const fetcherProfile = async (userId) => {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, display_name, avatar_url, role, university,
      user_mode, target_gpa, target_thpt, target_dgnl, current_gpa,
      admission_scores, is_approved_bang_chu,
      exp, study_seconds, study_streak, last_study_date
    `)
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }

  return data;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const bootstrapSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;
        setUser(session?.user ?? null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    bootstrapSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const nextUser = session?.user ?? null;
      // Only update when the actual user changes (sign in / sign out),
      // NOT on every TOKEN_REFRESHED event — that would re-create the user object
      // reference and trigger downstream useEffects on tab focus.
      setUser(prev => {
        if (prev?.id === nextUser?.id) return prev; // same user → keep stable reference
        return nextUser;
      });
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const {
    data: profile = null,
    mutate: refreshProfile
  } = useSWR(
    user?.id ? `profile-${user.id}` : null,
    () => fetcherProfile(user?.id),
    {
      revalidateOnFocus: false,    // Tắt: không refetch profile khi quay lại tab (gây re-render)
      revalidateOnReconnect: true, // Bật: refetch khi mạng kết nối lại
      dedupingInterval: 5000,      // Không gọi API trùng lắp trong 5s
    }
  );

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    refreshProfile,
  }), [loading, profile, refreshProfile, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
