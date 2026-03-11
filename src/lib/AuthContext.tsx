import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { supabase } from './supabase';
import { User, Session, Provider } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

export interface Organisation {
  id: string;
  name: string;
  created_by: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  organization: Organisation | null;
  userOrgs: Organisation[];
  setOrganization: (org: Organisation | null) => void;
  setActiveOrg: (org: Organisation) => void;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithProvider: (provider: Provider) => Promise<void>;
  signOut: () => Promise<void>;
  createOrganization: (name: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<Organisation | null>(null);
  const [userOrgs, setUserOrgs] = useState<Organisation[]>([]);
  const isCreatingOrg = useRef(false);

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await fetchUserOrgs(currentUser);
      }
      setLoading(false);
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setLoading(true);
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await fetchUserOrgs(currentUser);
      } else {
        setOrganization(null);
        setUserOrgs([]);
      }

      if (event === 'SIGNED_IN') {
        toast.success('Successfully signed in!');
      } else if (event === 'SIGNED_OUT') {
        setOrganization(null);
        setUserOrgs([]);
        toast.success('Successfully signed out!');
      } else if (event === 'USER_UPDATED') {
        toast.success('Email verified successfully!');
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUserOrgs = async (currentUser: User) => {
    const { data: orgMembers, error } = await supabase
      .from('org_members')
      .select('*, organisations (*)')
      .eq('user_id', currentUser.id)
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching user organisations:', error.message);
      return;
    }

    if (orgMembers && orgMembers.length > 0) {
      const orgs = orgMembers.map(m => m.organisations).filter(Boolean) as Organisation[];
      setUserOrgs(orgs);
      if (!organization || !orgs.find(o => o.id === organization.id)) {
        setOrganization(orgs[0]);
      }
    }
  };

  const createOrganization = async (name: string) => {
    if (!user) {
        const error = new Error("User not authenticated");
        toast.error(error.message);
        return { error };
    }
    if (isCreatingOrg.current) {
        const error = new Error("Organization creation already in progress.");
        return { error };
    }

    try {
      isCreatingOrg.current = true;

      const { data: newOrg, error: orgError } = await supabase
        .from('organisations')
        .insert({ name, created_by: user.id })
        .select()
        .single();

      if (orgError) {
        toast.error('Failed to create your workspace. Please try again.');
        console.error('Error creating workspace:', orgError.message);
        return { error: orgError };
      }

      const { error: memberError } = await supabase
        .from('org_members')
        .insert({
          org_id: newOrg.id,
          user_id: user.id,
          status: 'active',
          invited_email: user.email!,
          joined_at: new Date().toISOString(),
        });

      if (memberError) {
        toast.error('Failed to add you to your new workspace. Please try again.');
        console.error('Error adding member to workspace:', memberError.message);
        return { error: memberError };
      }
      
      const newOrgTyped = newOrg as Organisation;
      setUserOrgs(prevOrgs => [...prevOrgs, newOrgTyped]);
      setOrganization(newOrgTyped);
      toast.success('Successfully created your workspace!');
      return { error: null };

    } catch (error: any) {
        toast.error(error.message);
        return { error };
    } finally {
      isCreatingOrg.current = false;
    }
  };


  const setActiveOrg = (org: Organisation) => {
    setOrganization(org);
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
      if (error.message === 'Invalid login credentials') {
        toast.error('Invalid email or password. Please try again.');
      } else {
        toast.error(error.message);
      }
      return { error };
    }
    return { error: null };
  };

  const signInWithProvider = async (provider: Provider) => {
    const { error } = await supabase.auth.signInWithOAuth({ provider });
    if (error) {
      toast.error(error.message);
    }
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
    userOrgs,
    setOrganization,
    setActiveOrg,
    signUp,
    signIn,
    signInWithProvider,
    signOut,
    createOrganization,
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
