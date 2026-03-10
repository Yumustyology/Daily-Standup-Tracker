import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from './supabase';
import { User, Session } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setLoading(true);
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await fetchUserOrganization(currentUser.id);
      }

      if (event === 'SIGNED_IN') {
        toast.success('Successfully signed in!');
      } else if (event === 'SIGNED_OUT') {
        toast.success('Successfully signed out!');
      } else if (event === 'USER_UPDATED') {
        toast.success('Email verified successfully!');
      }
      
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserOrganization = async (userId: string) => {
    // First, get the user's active organization ID from org_members
    const { data: memberData, error: memberError } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (memberError && memberError.code !== 'PGRST116') {
      console.error('Error fetching organization member:', memberError.message);
      setOrganization(null);
      return;
    }

    if (!memberData) {
      setOrganization(null);
      return;
    }

    // Next, fetch the organization details using the org_id
    const { data: orgData, error: orgError } = await supabase
      .from('organisations')
      .select('id, name')
      .eq('id', memberData.org_id)
      .single();

    if (orgError) {
      console.error('Error fetching organization details:', orgError.message);
      setOrganization(null);
      return;
    }

    if (orgData) {
      setOrganization(orgData);
    } else {
      setOrganization(null);
    }
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      toast.error(error.message);
      return { error };
    }
    toast.success('Verification email sent! Please check your inbox.');
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      return { error };
    }
    return { error: null };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
    }
  };

  const value = {
    user,
    session,
    loading,
    organization,
    setOrganization,
    signUp,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
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
