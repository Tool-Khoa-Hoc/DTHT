import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId) => {
    if (!userId) {
        setProfile(null);
        return;
    }
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url, role, university, user_mode, target_gpa, target_thpt, target_dgnl, current_gpa')
            .eq('id', userId)
            .single();
            
        if (error) {
            console.error('Error fetching profile:', error);
        } else {
            setProfile(data);
        }
    } catch (err) {
        console.error('Unexpected error fetching profile:', err);
    }
  };

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
          fetchProfile(currentUser.id).finally(() => setLoading(false));
      } else {
          setLoading(false);
      }
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
            fetchProfile(currentUser.id).finally(() => setLoading(false));
        } else {
            setProfile(null);
            setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
