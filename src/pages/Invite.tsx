import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

interface Invitation {
  id: string;
  org_id: string;
  organisations: {
    name: string;
  }[];
}

export default function Invite() {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchInvitations = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('org_members')
          .select('id, org_id, organisations(name)')
          .eq('invited_email', user.email)
          .eq('status', 'pending');

        if (error) {
          throw error;
        }

        if (data) {
          const validInvitations = data.filter((invite: any) => invite.organisations && invite.organisations.length > 0);
          setInvitations(validInvitations as Invitation[]);
        }

      } catch (error: any) {
        toast.error('Failed to fetch invitations');
      } finally {
        setLoading(false);
      }
    };

    fetchInvitations();
  }, [user]);

  const handleAccept = async (membershipId: string) => {
    try {
      const { error } = await supabase
        .from('org_members')
        .update({ status: 'active', joined_at: new Date().toISOString() })
        .eq('id', membershipId);

      if (error) {
        throw error;
      }

      toast.success('Invitation accepted!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error('Failed to accept invitation');
    }
  };

  if (loading) {
    return <div>Loading invitations...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center">
      <div className="w-full max-w-md p-8 bg-[#111111] rounded-lg shadow-lg">
        <h1 className="text-2xl font-semibold mb-6">Pending Invitations</h1>
        {invitations.length > 0 ? (
          <ul className="space-y-4">
            {invitations.map(invite => (
              <li key={invite.id} className="p-4 bg-[#1f1f1f] rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-semibold">{invite.organisations[0]?.name}</p>
                  <p className="text-sm text-gray-400">You have a pending invitation</p>
                </div>
                <button 
                  onClick={() => handleAccept(invite.id)}
                  className="bg-amber-500 text-black py-2 px-4 rounded-lg font-semibold hover:bg-amber-600 transition-colors"
                >
                  Accept
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No pending invitations.</p>
        )}
      </div>
    </div>
  );
}