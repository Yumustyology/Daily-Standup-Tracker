import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, Organisation } from '../lib/AuthContext';
import { LogOut } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';

interface PendingInvite {
  id: string;
  organisations: {
    id: string;
    name: string;
  };
}

const Onboarding = () => {
  const { user, organization, setActiveOrg, createOrganization, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null);

  useEffect(() => {
    if (organization) {
      navigate('/dashboard');
    }
  }, [organization, navigate]);

  useEffect(() => {
    const checkInvites = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('org_members')
        .select('id, organisations (id, name)')
        .eq('invited_email', user.email!)
        .eq('status', 'pending')
        .limit(1);

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking for pending invites:', error.message);
      } else if (data && data.length > 0) {
        setPendingInvite(data[0] as unknown as PendingInvite);
      }
      setLoading(false);
    };
    checkInvites();
  }, [user]);

  const handleJoinOrg = async () => {
    if (!user || !pendingInvite) return;
    setLoading(true);

    const { data: updatedMember, error } = await supabase
      .from('org_members')
      .update({ user_id: user.id, status: 'active', joined_at: new Date().toISOString() })
      .eq('id', pendingInvite.id)
      .select('*, organisations (*)')
      .single();

    if (error) {
      toast.error('Failed to join the organization. Please try again.');
      console.error('Error joining organization:', error.message);
      setLoading(false);
      return;
    }

    if (updatedMember && updatedMember.organisations) {
      const org = updatedMember.organisations as Organisation;
      setActiveOrg(org);
      toast.success(`Successfully joined ${org.name}!`);
      navigate('/dashboard');
    } else {
      toast.error('Could not retrieve organization details after joining.');
    }
    setLoading(false);
  };

  const handleCreateOwnWorkspace = async () => {
    if (!user) return;
    setLoading(true);
    const orgName = `${user.email?.split('@')[0]}'s Workspace`;
    const { error } = await createOrganization(orgName);
    if (error) {
      setLoading(false);
      return;
    }
    navigate('/dashboard');
    setLoading(false);
  };
  
  const handleLogout = async () => {
    await signOut(); // Use signOut from useAuth
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center">
        <p>Checking for invites...</p>
      </div>
    );
  }

  if (pendingInvite) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center p-4">
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-8 w-full max-w-md shadow-lg text-center">
           <h1 className="text-3xl font-semibold text-white mb-4">You've been invited!</h1>
           <p className="text-gray-400 mb-8">You have a pending invitation to join <span className='text-amber-500 font-semibold'>{pendingInvite.organisations.name}</span>.</p>
           <div className="space-y-4">
             <button
              onClick={handleJoinOrg}
              className="w-full bg-amber-500 text-black py-2 rounded-lg font-semibold hover:bg-amber-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Joining...' : `Join ${pendingInvite.organisations.name}`}
            </button>
            <button
              onClick={handleCreateOwnWorkspace}
              className="w-full bg-gray-700 text-white py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create my own workspace instead'}
            </button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center p-4">
       <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-8 w-full max-w-md shadow-lg">
         <div className="flex justify-between items-center mb-6">
           <h1 className="text-3xl font-semibold text-amber-500 flex items-center gap-2">
             <span className="text-white">StandupLog</span>
           </h1>
           <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-amber-500 transition-colors flex items-center gap-1"
          >
            <LogOut size={18} />
            <span className="sr-only">Logout</span>
          </button>
         </div>

         <p className="text-gray-300 mb-8 text-center">
          Welcome! It looks like you're not part of an organization yet. Let's create one for you.
        </p>

        <button
            onClick={handleCreateOwnWorkspace}
            className="w-full bg-amber-500 text-black py-2 rounded-lg font-semibold hover:bg-amber-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Your Workspace'}
          </button>
      </div>
    </div>
  );
};

export default Onboarding;
