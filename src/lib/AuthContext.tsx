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
  userRole: string | null;
  userOrgs: Organisation[];
  pendingInvites: any[];
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
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userOrgs, setUserOrgs] = useState<Organisation[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);


  const isMounted = useRef(true);
  const isCreatingOrg = useRef(false);

  // --- FETCH USER ORGANISATIONS ---
  const fetchUserOrgs = async (currentUser: User) => {
    if (!currentUser.id) return;

    const { data: memberData, error: memberError } = await supabase
      .from('org_members')
      .select('org_id, status, role') // Fetched role
      .eq('user_id', currentUser.id)
      .eq('status', 'active');

    if (memberError) {
      console.error('org_members query failed:', memberError);
      return;
    }

    if (!memberData || memberData.length === 0) {
      if (isMounted.current) {
        setOrganization(null);
        setUserOrgs([]);
        setUserRole(null);
      }
      return;
    }

    const orgIds = memberData.map(m => m.org_id);
    const { data: orgData, error: orgError } = await supabase
      .from('organisations')
      .select('id, name, created_by')
      .in('id', orgIds);

    if (orgError) {
      console.error('organisations query failed:', orgError);
      return;
    }

    if (!isMounted.current) return;

    const activeOrgs = (orgData ?? []) as Organisation[];
    setUserOrgs(activeOrgs);

    const currentOrg = organization || activeOrgs[0] || null;
    setOrganization(currentOrg);

    if (currentOrg) {
      const currentMemberInfo = memberData.find(m => m.org_id === currentOrg.id);
      setUserRole(currentMemberInfo?.role || null);
    }
  };

  const setActiveOrg = (org: Organisation) => {
    setOrganization(org);
    // You might need to refetch the role or have it stored to set it directly
    // For now, let's refetch user orgs to simplify state management
    if (user) {
      fetchUserOrgs(user);
    }
  };
  
  // --- INIT AUTH ---
  useEffect(() => {
    isMounted.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        const currentUser = newSession?.user ?? null;

        if (isMounted.current) {
          setSession(newSession);
          setUser(currentUser);
        }
        setTimeout(async () => {
          try {
            if (currentUser) {
              await fetchUserOrgs(currentUser);
            } else {
              if (isMounted.current) {
                setOrganization(null);
                setUserOrgs([]);
                setPendingInvites([]);
              }
            }
          } catch (err) {
            console.error('fetchUserOrgs failed:', err);
          } finally {
            setLoading(false);
          }
        }, 0);
      }
    );

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, []);

  // --- CREATE ORGANISATION ---
  const createOrganization = async (name: string) => {
    if (!user) {
      const error = new Error('User not authenticated');
      toast.error(error.message);
      return { error };
    }
    if (isCreatingOrg.current) {
      return { error: new Error('Organization creation already in progress') };
    }

    try {
      isCreatingOrg.current = true;

      const { data: newOrg, error: orgError } = await supabase
        .from('organisations')
        .insert({ name, created_by: user.id })
        .select()
        .single();

      if (orgError) {
        toast.error('Failed to create workspace');
        return { error: orgError };
      }
      
      // When creating an org, the creator should be an admin.
      const { error: memberError } = await supabase
        .from('org_members')
        .insert({
          org_id: newOrg.id,
          user_id: user.id,
          status: 'active',
          role: 'admin', // Assign admin role to creator
          invited_email: user.email!,
          joined_at: new Date().toISOString(),
        });

      if (memberError) {
        toast.error('Failed to add member to workspace');
        return { error: memberError };
      }

      const orgTyped = newOrg as Organisation;
      setUserOrgs(prev => [...prev, orgTyped]);
      setOrganization(orgTyped);
      setUserRole('admin'); // Set role in context
      toast.success('Workspace created successfully');

      return { error: null };
    } catch (error: any) {
      toast.error(error.message);
      return { error };
    } finally {
      isCreatingOrg.current = false;
    }
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      toast.error(error.message);
      return { error };
    }
    toast.success('Verification email sent');
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

  const signInWithProvider = async (provider: Provider) => {
    const { error } = await supabase.auth.signInWithOAuth({ provider });
    if (error) toast.error(error.message);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    if (isMounted.current) {
        setUser(null);
        setSession(null);
        setOrganization(null);
        setUserOrgs([]);
        setPendingInvites([]);
        setUserRole(null);
    }
  };

  const value = {
    user,
    session,
    loading,
    organization,
    userRole,
    userOrgs,
    pendingInvites,
    setOrganization,
    setActiveOrg,
    signUp,
    signIn,
    signInWithProvider,
    signOut,
    createOrganization,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}