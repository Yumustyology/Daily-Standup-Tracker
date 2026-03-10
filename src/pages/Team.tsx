import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { Mail, User } from 'lucide-react';

interface Member {
  id: string;
  user_id: string | null;
  invited_email: string;
  status: string;
  invited_at: string;
  joined_at: string | null;
  profiles?: { email: string } | null;
}

interface Standup {
  id: string;
  user_id: string;
  yesterday: string;
  today: string;
  blockers: string;
  standup_date: string;
  created_at: string;
  profiles?: { email: string } | null;
  noStandup?: boolean;
}

const Team = () => {
  const { user, organization } = useAuth();
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<Member[]>([]);
  const [activeMembers, setActiveMembers] = useState<Member[]>([]);
  const [teamStandups, setTeamStandups] = useState<Standup[]>([]);
  const [membersWithoutStandup, setMembersWithoutStandup] = useState<Member[]>([]);

  useEffect(() => {
    if (organization?.id) {
      fetchTeamData();
      fetchTeamStandups();
    }
  }, [organization?.id]);

  useEffect(() => {
    if (activeMembers.length > 0) {
        fetchTeamStandups();
    }
  }, [activeMembers]);

  const fetchTeamData = async () => {
    if (!organization?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('org_members')
        .select('id, user_id, invited_email, status, invited_at, joined_at, profiles(email)')
        .eq('org_id', organization.id);

      if (error) throw error;

      const pending = data.filter(member => member.status === 'pending');
      const active = data.filter(member => member.status === 'active');
      setPendingInvites(pending as any);
      setActiveMembers(active as any);
    } catch (error: any) {
      console.error('Error fetching team members:', error.message);
      toast.error('Failed to fetch team members.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamStandups = async () => {
    if (!organization?.id || activeMembers.length === 0) return;

    const today = format(new Date(), 'yyyy-MM-dd');
    try {
      const { data, error } = await supabase
        .from('standups')
        .select('id, user_id, yesterday, today, blockers, standup_date, created_at, profiles(email)')
        .eq('org_id', organization.id)
        .eq('standup_date', today);

      if (error) throw error;

      setTeamStandups(data as any || []);
      const submittedUserIds = new Set(data.map(s => s.user_id));
      const membersWithout = activeMembers.filter(member => member.user_id && !submittedUserIds.has(member.user_id));
      setMembersWithoutStandup(membersWithout);
    } catch (error: any) {
      console.error('Error fetching team standups:', error.message);
      toast.error('Failed to fetch team standups.');
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address.');
      return;
    }
    if (!user || !organization || !user.email) {
      toast.error('You must be logged in to invite members.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-invite', {
        body: {
          orgId: organization.id,
          orgName: organization.name,
          email: inviteEmail,
          inviterEmail: user.email,
          inviterId: user.id,
        },
      });

      if (error) throw new Error(error.message);

      if (data.success) {
        toast.success(`Invite sent to ${inviteEmail}`);
        setInviteEmail('');
        fetchTeamData(); // Refresh pending invites
      } else {
        throw new Error(data.error || 'An unknown error occurred.');
      }
    } catch (err: any) {
      console.error('Error sending invite:', err);
      toast.error(err.message || 'Failed to send invite. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const allStandupsForDisplay = [
    ...teamStandups,
    ...membersWithoutStandup.map(member => ({
      id: `no-standup-${member.id}`,
      user_id: member.user_id!,
      yesterday: '',
      today: '',
      blockers: '',
      standup_date: format(new Date(), 'yyyy-MM-dd'),
      created_at: new Date().toISOString(),
      profiles: member.profiles || { email: member.invited_email },
      noStandup: true,
    }))
  ].sort((a, b) => (a.profiles?.email || '').localeCompare(b.profiles?.email || ''));

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-semibold text-amber-500 mb-8">Team Management</h1>

      <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-6 mb-8 shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-4">Invite a teammate</h2>
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-4">
          <input
            type="email"
            placeholder="teammate@example.com"
            className="flex-grow px-4 py-2 bg-[#1f1f1f] border border-[#2f2f2f] rounded-lg focus:ring-amber-500 focus:border-amber-500 outline-none text-white placeholder-gray-500"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />
          <button
            type="submit"
            className="bg-amber-500 text-black py-2 px-6 rounded-lg font-semibold hover:bg-amber-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || !organization}
          >
            {loading ? 'Sending...' : 'Send Invite'}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4">Active Members ({activeMembers.length})</h2>
          {activeMembers.length === 0 ? (
            <p className="text-gray-500">No active members yet.</p>
          ) : (
            <ul className="space-y-3">
              {activeMembers.map((member) => (
                <li key={member.id} className="flex items-center text-gray-300">
                  <User size={18} className="mr-2 text-amber-400" />
                  <span>{member.profiles?.email || member.invited_email}</span>
                  {member.joined_at && (
                    <span className="ml-auto text-sm text-gray-500">
                      Joined {format(new Date(member.joined_at), 'MMM dd, yyyy')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4">Pending Invites ({pendingInvites.length})</h2>
          {pendingInvites.length === 0 ? (
            <p className="text-gray-500">No pending invites.</p>
          ) : (
            <ul className="space-y-3">
              {pendingInvites.map((invite) => (
                <li key={invite.id} className="flex items-center text-gray-300">
                  <Mail size={18} className="mr-2 text-gray-400" />
                  <span>{invite.invited_email}</span>
                  <span className="ml-auto text-sm text-gray-500">
                    Invited {format(new Date(invite.invited_at), 'MMM dd, yyyy')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-4">Today's Team Standups</h2>
        {activeMembers.length <= 1 ? (
          <p className="text-gray-500 italic">Invite teammates to see their standups.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allStandupsForDisplay.map((standup) => (
              <div
                key={standup.id}
                className={`border rounded-lg p-5 ${standup.noStandup ? 'border-amber-800/20 bg-amber-900/10' : 'border-[#1f1f1f] bg-[#0f0f0f]'} flex flex-col`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className={`font-semibold ${standup.noStandup ? 'text-amber-600' : 'text-amber-500'}`}>
                    {standup.profiles?.email || 'Unknown'}
                  </p>
                  {!standup.noStandup && (
                    <p className="text-xs text-gray-400">{format(new Date(standup.created_at), 'HH:mm')}</p>
                  )}
                </div>
                {standup.noStandup ? (
                  <div className="flex-grow flex items-center justify-center">
                    <p className="text-amber-700 italic text-sm">No standup submitted yet</p>
                  </div>
                ) : (
                  <div className="space-y-3 flex-grow">
                    <div>
                      <h4 className="text-gray-400 text-sm mb-1">Yesterday</h4>
                      <p className="text-gray-200 text-sm">{standup.yesterday || 'N/A'}</p>
                    </div>
                    <div>
                      <h4 className="text-gray-400 text-sm mb-1">Today</h4>
                      <p className="text-gray-200 text-sm">{standup.today || 'N/A'}</p>
                    </div>
                    <div>
                      <h4 className="text-gray-400 text-sm mb-1">Blockers</h4>
                      <p className="text-gray-200 text-sm">{standup.blockers || 'None'}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Team;
