import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react';
import { supabase } from './supabase';
import { User, Session } from '@supabase/supabase-js';
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
  setOrganization: (org: Organisation | null) => void;
  setActiveOrg: (org: Organisation) => Promise<void>;
  signOut: () => Promise<void>;
  createOrganization: (name: string) => Promise<{ error: Error | null; data: Organisation | null; }>;
  refreshUserOrgs: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<Organisation | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userOrgs, setUserOrgs] = useState<Organisation[]>([]);
  const isMounted = useRef(true);
  const isCreatingOrg = useRef(false);

  const fetchUserOrgsAndSetRole = useCallback(async (currentUser: User) => {
    if (!isMounted.current) return;

    const { data: memberData, error: memberError } = await supabase
      .from('org_members')
      .select('org_id, status, role')
      .eq('user_id', currentUser.id)
      .eq('status', 'active');

    if (memberError) {
      console.error('Failed to fetch user organisations:', memberError);
      toast.error('Failed to load your workspaces.');
      if (isMounted.current) setUserOrgs([]);
      return;
    }

    if (memberData.length === 0) {
      if (isMounted.current) {
        setUserOrgs([]);
        setOrganization(null);
        setUserRole(null);
        localStorage.removeItem('activeOrgId');
      }
      return;
    }

    const orgIds = memberData.map((m) => m.org_id);
    const { data: orgData, error: orgError } = await supabase
      .from('organisations')
      .select('id, name, created_by')
      .in('id', orgIds);

    if (orgError) {
      console.error('Failed to fetch organisation details:', orgError);
      if (isMounted.current) setUserOrgs([]);
      return;
    }

    if (!isMounted.current) return;

    const activeOrgs = (orgData as Organisation[]) || [];
    setUserOrgs(activeOrgs);

    const lastOrgId = localStorage.getItem('activeOrgId');
    const currentOrg = activeOrgs.find((o) => o.id === lastOrgId) || activeOrgs[0] || null;
    setOrganization(currentOrg);

    if (currentOrg) {
      localStorage.setItem('activeOrgId', currentOrg.id);
      const currentMemberInfo = memberData.find((m) => m.org_id === currentOrg.id);
      setUserRole(currentMemberInfo?.role || null);
    } else {
      localStorage.removeItem('activeOrgId');
      setUserRole(null);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    setLoading(true);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!isMounted.current) return;

        const currentUser = session?.user || null;
        setUser(currentUser);
        setSession(session);

        setTimeout(async () => {
          try {
            if (currentUser) {
              await fetchUserOrgsAndSetRole(currentUser);
            } else {
              localStorage.removeItem('activeOrgId');
              setOrganization(null);
              setUserOrgs([]);
              setUserRole(null);
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
  }, [fetchUserOrgsAndSetRole]);

  const setActiveOrg = async (org: Organisation) => {
    if (!user) return;
    localStorage.setItem('activeOrgId', org.id);
    setOrganization(org);

    const { data: memberData, error } = await supabase
      .from('org_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', org.id)
      .single();

    if (error || !memberData) {
      console.error('Failed to get role for the organisation:', error);
      toast.error('Could not switch workspaces.');
      if (isMounted.current) setUserRole(null);
      return;
    }

    if (isMounted.current) setUserRole(memberData.role);
  };

  const createOrganization = async (name: string) => {
    if (!user) {
        const error = new Error('User not authenticated');
        toast.error(error.message);
        return { data: null, error };
    }

    if (isCreatingOrg.current) {
        return { data: null, error: new Error('Organization creation already in progress') };
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
            return { data: null, error: orgError };
        }

        const orgTyped = newOrg as Organisation;
        
        setUserOrgs(prev => [...prev, orgTyped]);
        setOrganization(orgTyped);
        setUserRole('admin');
        localStorage.setItem('activeOrgId', orgTyped.id);

        toast.success('Workspace created successfully');
        return { data: orgTyped, error: null };
    } catch (error: any) {
        toast.error(error.message);
        return { data: null, error };
    } finally {
        isCreatingOrg.current = false;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshUserOrgs = useCallback(async () => {
    if (user) {
      await fetchUserOrgsAndSetRole(user);
    }
  }, [user, fetchUserOrgsAndSetRole]);

  const value = {
    user, session, loading, organization, userRole, userOrgs,
    setOrganization, setActiveOrg, signOut, createOrganization, refreshUserOrgs
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
