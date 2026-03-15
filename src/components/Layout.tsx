import { ReactNode, useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { LogOut, LayoutDashboard, Users, Clock, Mail } from 'lucide-react';
import TeamSwitcher from './TeamSwitcher';
import Modal from './Modal';
import { showToast } from '../util/toast';

const Layout = ({ children }: { children: ReactNode }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [inviteCount, setInviteCount] = useState(0);

  useEffect(() => {
    if (!user?.email) return;

    const fetchInviteCount = async () => {
      const { count, error } = await supabase
        .from('org_members')
        .select('id', { count: 'exact' })
        .eq('invited_email', user.email)
        .eq('status', 'pending');
      
      if (!error && count) {
        setInviteCount(count);
      }
    };

    fetchInviteCount();

    const subscription = supabase.channel('org_members')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'org_members', filter: `invited_email=eq.${user.email}` }, () => {
        fetchInviteCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut();
      showToast('Logged out successfully!', 'success');
      navigate('/auth');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setIsLogoutModalOpen(false);
    }
  };

  return (
    <>
      <div className="flex h-screen bg-[#0f0f0f]">
        <aside className="w-64 bg-[#111111] text-white p-4 border-r border-[#1f1f1f] flex flex-col">
          <div className="mb-8">
            <TeamSwitcher />
          </div>
          <nav className="flex-grow">
            <ul>
              <li><NavLink to="/dashboard" className={({isActive}) => `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${isActive ? 'bg-amber-500 text-black' : 'hover:bg-[#1f1f1f]'}`}><LayoutDashboard size={20}/>Dashboard</NavLink></li>
              <li><NavLink to="/new-standup" className={({isActive}) => `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${isActive ? 'bg-amber-500 text-black' : 'hover:bg-[#1f1f1f]'}`}><Clock size={20}/>New Standup</NavLink></li>
              <li><NavLink to="/history" className={({isActive}) => `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${isActive ? 'bg-amber-500 text-black' : 'hover:bg-[#1f1f1f]'}`}><Users size={20}/>History</NavLink></li>
              <li><NavLink to="/team" className={({isActive}) => `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${isActive ? 'bg-amber-500 text-black' : 'hover:bg-[#1f1f1f]'}`}><Users size={20}/>Team</NavLink></li>
              <li><NavLink to="/invite" className={({isActive}) => `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${isActive ? 'bg-amber-500 text-black' : 'hover:bg-[#1f1f1f]'}`}><Mail size={20}/>Invites {inviteCount > 0 && <span className="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">{inviteCount}</span>}</NavLink></li>
            </ul>
          </nav>
          <div>
            <div className="text-sm text-gray-400 mb-2">{user?.email}</div>
            <button onClick={() => setIsLogoutModalOpen(true)} className="flex items-center w-full gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-[#1f1f1f]">
              <LogOut size={20} />
              Logout
            </button>
          </div>
        </aside>
        <main className="flex-1 p-8 overflow-y-auto text-white">
          {children}
        </main>
      </div>
      <Modal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleLogout}
        title="Confirm Logout"
      >
        <p>Are you sure you want to log out?</p>
      </Modal>
    </>
  );
};

export default Layout;