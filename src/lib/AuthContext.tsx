import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from './supabase';
import { User, Session } from '@supabase/supabase-js';

interface Organization {
  id: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  organization: Organization | null;
  setOrganization: (org: Organization | null) => void;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);

  useEffect(() => {
    const getSessionAndUser = async () => {
      setLoading(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Error getting session:', sessionError);
        setLoading(false);
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchUserOrganization(session.user.id);
      } else {
        setOrganization(null);
      }
      setLoading(false);
    };

    getSessionAndUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchUserOrganization(session.user.id);
        } else {
          setOrganization(null);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserOrganization = async (userId: string) => {
    const { data, error } = await supabase
      .from('org_members')
      .select('*, organisations(id, name)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error('Error fetching user organization:', error.message);
      setOrganization(null);
    } else if (data && data.organisations) {
      setOrganization({ id: data.organisations.id, name: data.organisations.name });
    } else {
      setOrganization(null);
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) return { error };
      // No org is set upon signup, onboarding will handle it
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error };
      if (data.user) {
        await fetchUserOrganization(data.user.id);
      }
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setOrganization(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, organization, setOrganization, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
