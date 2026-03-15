import { useEffect, useState } from 'react';
import { useAuth, Organisation } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

interface PendingInvite {
  id: string;
  organisations: {
    id: string;
    name: string;
  };
}

export default function InvitesPage() {
  const { user, setActiveOrg, refreshUserOrgs } = useAuth();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchInvites = async () => {
      if (!user?.email) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('org_members')
        .select('id, organisations (id, name)')
        .eq('invited_email', user.email)
        .eq('status', 'pending');
      
      if (error) {
        toast.error('Could not fetch invitations.');
        console.error(error);
      } else {
        setInvites(data as unknown as PendingInvite[]);
      }
      setLoading(false);
    };
    fetchInvites();
  }, [user]);

  const handleJoin = async (invite: PendingInvite) => {
    if (!user) return;
    const { error } = await supabase
      .from('org_members')
      .update({ status: 'active', user_id: user.id, joined_at: new Date().toISOString() })
      .eq('id', invite.id);

    if (error) {
      toast.error(`Failed to join ${invite.organisations.name}.`);
    } else {
      toast.success(`Joined ${invite.organisations.name}!`);
      await refreshUserOrgs();
      await setActiveOrg(invite.organisations as Organisation);
      setInvites(invites.filter(i => i.id !== invite.id));
      navigate('/dashboard');
    }
  };

  const handleDecline = async (inviteId: string) => {
    const { error } = await supabase.from('org_members').delete().eq('id', inviteId);
    if (error) {
      toast.error('Failed to decline invitation.');
    } else {
      toast.success('Invitation declined.');
      setInvites(invites.filter(i => i.id !== inviteId));
    }
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold mb-6">My Invitations</h1>
      {loading ? (
        <p>Loading...</p>
      ) : invites.length > 0 ? (
        <div className="max-w-2xl space-y-4">
          {invites.map(invite => (
            <div key={invite.id} className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-4 flex items-center justify-between gap-4">
              <p className="font-semibold text-sm">You've been invited to join <span className="text-amber-500">{invite.organisations.name}</span></p>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleJoin(invite)}
                  className="bg-amber-500 text-black text-sm font-semibold py-1.5 px-3 rounded-lg hover:bg-amber-600 transition-colors"
                >
                  Join
                </button>
                <button
                  onClick={() => handleDecline(invite.id)}
                  className="bg-[#2f2f2f] text-gray-400 text-sm py-1.5 px-3 rounded-lg hover:text-white transition-colors"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p>You have no pending invitations.</p>
      )}
    </div>
  );
}