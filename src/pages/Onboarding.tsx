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
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null);

  useEffect(() => {
    if (authLoading) return;

    const checkAndRedirect = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);

      const { data, error } = await supabase
        .from('org_members')
        .select('id, organisations (id, name)')
        .eq('invited_email', user.email!)
        .eq('status', 'pending')
        .limit(1);

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking for pending invites:', error.message);
        toast.error('Could not check for invitations.');
      } else if (data && data.length > 0) {
        const invite = data[0] as unknown as PendingInvite;
        setPendingInvite(invite);
      } else {
        if (organization || userOrgs.length > 0) {
          navigate('/dashboard');
        }
      }
      setLoading(false);
    };

    checkAndRedirect();
  }, [user, authLoading, organization, userOrgs, navigate]);

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
    } else if (updatedMember && updatedMember.organisations) {
      const org = updatedMember.organisations as Organisation;
      await setActiveOrg(org);
      toast.success(`Successfully joined ${org.name}!`);
      navigate('/dashboard');
    } else {
      toast.error('Could not retrieve organization details after joining.');
    }
    setLoading(false);
  };

  const handleRejectInvite = async () => {
    if (!pendingInvite) return;
    setLoading(true);

    const { error } = await supabase
      .from('org_members')
      .delete()
      .eq('id', pendingInvite.id);

    if (error) {
      toast.error('Failed to decline invitation.');
    } else {
      toast.success('Invitation declined.');
      setPendingInvite(null);
      if (organization || userOrgs.length > 0) {
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

  if (pendingInvite) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center p-4">
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-8 w-full max-w-md shadow-lg text-center">
          <h1 className="text-3xl font-semibold text-white mb-4">You've been invited!</h1>
          <p className="text-gray-400 mb-8">
            You have a pending invitation to join{' '}
            <span className="text-amber-500 font-semibold">{pendingInvite.organisations.name}</span>.
          </p>
          <div className="space-y-4">
            <button
              onClick={handleJoinOrg}
              disabled={isCreating || loading}
              className="w-full bg-amber-500 text-black py-2 rounded-lg font-semibold hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Joining...' : `Join ${pendingInvite.organisations.name}`}
            </button>
            {userOrgs.length === 0 && (
              <button
                onClick={handleCreateOwnWorkspace}
                disabled={isCreating || loading}
                className="w-full bg-gray-700 text-white py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? 'Creating...' : 'Create my own workspace instead'}
              </button>
            )}
            <button
              onClick={handleRejectInvite}
              disabled={isCreating || loading}
              className="w-full text-gray-400 hover:text-white py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              Decline invitation
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
