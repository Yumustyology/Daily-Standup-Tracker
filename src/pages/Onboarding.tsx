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
  const { user, organization, userOrgs, loading: authLoading, setActiveOrg, createOrganization, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);

  useEffect(() => {
    if (authLoading || !user) return;
  
    const checkAndRedirect = async () => {
      setLoading(true);
  
      const { data, error } = await supabase
        .from('org_members')
        .select('id, organisations (id, name)')
        .eq('invited_email', user.email!)
        .eq('status', 'pending');
  
      if (error && error.code !== 'PGRST116') {
        toast.error('Could not check for invitations.');
      } else if (data && data.length > 0) {
        setPendingInvites(data as unknown as PendingInvite[]);
      }
     
      setLoading(false);
    };
  
    checkAndRedirect();
  }, [user, authLoading]);
  
  useEffect(() => {
    if (authLoading || loading) return;
    if (pendingInvites.length > 0) return;
    if (organization || userOrgs.length > 0) {
      navigate('/dashboard');
    }
  }, [authLoading, loading, organization, userOrgs, pendingInvites, navigate]);

  const handleJoinOrg = async (inviteId: string) => {
    if (!user) return;
    setLoading(true);

    const { data: updatedMember, error } = await supabase
      .from('org_members')
      .update({ user_id: user.id, status: 'active', joined_at: new Date().toISOString() })
      .eq('id', inviteId)
      .select('*, organisations (*)')
      .single();

    if (error) {
      toast.error('Failed to join the organization.');
    } else if (updatedMember?.organisations) {
      const org = updatedMember.organisations as Organisation;
      await setActiveOrg(org);
      toast.success(`Successfully joined ${org.name}!`);
      navigate('/dashboard');
    }
    setLoading(false);
  };

  const handleRejectInvite = async (inviteId: string) => {
    setLoading(true);
    const { error } = await supabase.from('org_members').delete().eq('id', inviteId);

    if (error) {
      toast.error('Failed to decline invitation.');
    } else {
      toast.success('Invitation declined.');
      const remaining = pendingInvites.filter(i => i.id !== inviteId);
      setPendingInvites(remaining);
      if (remaining.length === 0 && (organization || userOrgs.length > 0)) {
        navigate('/dashboard');
      }
    }
    setLoading(false);
  };

  const handleCreateOwnWorkspace = async () => {
    if (!user || isCreating) return;
    setIsCreating(true);

    const orgName = `${user.email?.split('@')[0]}'s Workspace`;
    const { error } = await createOrganization(orgName);
    if (!error) {
        navigate('/dashboard');
    } else {
        setIsCreating(false);
    }
  };
  
  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (pendingInvites.length > 0) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center p-4">
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-8 w-full max-w-md shadow-lg">
          <h1 className="text-3xl font-semibold text-white mb-2">You've been invited!</h1>
          <p className="text-gray-400 mb-6">You have {pendingInvites.length} pending invitation{pendingInvites.length > 1 ? 's' : ''}.</p>
          
          <div className="space-y-3 mb-6">
            {pendingInvites.map(invite => (
              <div key={invite.id} className="bg-[#1f1f1f] rounded-lg p-4 flex items-center justify-between gap-4">
                <span className="text-amber-500 font-semibold">{invite.organisations.name}</span>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleJoinOrg(invite.id)}
                    disabled={loading}
                    className="bg-amber-500 text-black text-sm font-semibold py-1.5 px-3 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
                  >
                    Join
                  </button>
                  <button
                    onClick={() => handleRejectInvite(invite.id)}
                    disabled={loading}
                    className="bg-[#2f2f2f] text-gray-400 text-sm py-1.5 px-3 rounded-lg hover:text-white transition-colors disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>

          {userOrgs.length === 0 && (
            <button
              onClick={handleCreateOwnWorkspace}
              disabled={isCreating || loading}
              className="w-full bg-gray-700 text-white py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create my own workspace instead'}
            </button>
          )}

          {pendingInvites.length > 0 && (organization || userOrgs.length > 0) && (
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full mt-3 text-gray-400 hover:text-white py-2 rounded-lg text-sm transition-colors"
            >
              Continue without joining →
            </button>
          )}
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
          Welcome! Let's create a workspace to get you started.
        </p>

        <button
            onClick={handleCreateOwnWorkspace}
            className="w-full bg-amber-500 text-black py-2 rounded-lg font-semibold hover:bg-amber-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isCreating}
          >
            {isCreating ? 'Creating...' : 'Create Your Workspace'}
          </button>
      </div>
    </div>
  );
};

export default Onboarding;
