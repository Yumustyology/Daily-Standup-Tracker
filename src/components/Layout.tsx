import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { LogOut, LayoutDashboard, Users, Clock } from 'lucide-react';
import TeamSwitcher from './TeamSwitcher';

const Layout = ({ children }: { children: ReactNode }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
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
          </ul>
        </nav>
        <div>
          <div className="text-sm text-gray-400 mb-2">{user?.email}</div>
          <button onClick={handleLogout} className="flex items-center w-full gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-[#1f1f1f]">
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};

export default Layout;
