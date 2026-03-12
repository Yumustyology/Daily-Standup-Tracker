import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import type { Organisation } from '../lib/AuthContext';
import { supabase, supabaseAnonKey } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { Send, Trash2, Edit, Save, Shield } from 'lucide-react';
import { format } from 'date-fns';

interface Member {
  id: string;
  user_id: string;
  invited_email: string;
  joined_at: string;
  status: 'active' | 'pending';
  role: 'admin' | 'member';
}

const Team = () => {
  const { user, organization, setOrganization, userRole } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingInvites, setPendingInvites] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [newOrgName, setNewOrgName] = useState('');
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    if (organization) {
      fetchMembers();
      setNewOrgName(organization.name);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization, user, isAdmin]);

  const fetchMembers = async () => {
    if (!organization) return;
    let query = supabase
      .from('org_members')
      .select('id, user_id, invited_email, joined_at, status, role')
      .eq('org_id', organization.id);

    if (!isAdmin) {
      query = query.eq('status', 'active');
    }

    const { data, error } = await query;

    if (error) {
      toast.error('Failed to fetch team members.');
      console.error('Error:', error.message);
    } else {
      const typedData = data as Member[];
      setMembers(typedData.filter(m => m.status === 'active'));
      if (isAdmin) {
        setPendingInvites(typedData.filter(m => m.status === 'pending'));
      } else {
        setPendingInvites([]);
      }
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !organization || !user) return;
    if (!isAdmin) {
      toast.error("You don't have permission to invite members.");
      return;
    }

    const { error } = await supabase.functions.invoke('send-invite', {
      body: {
        orgId: organization.id,
        orgName: organization.name,
        email: inviteEmail,
        inviterEmail: user.email,
        inviterId: user.id,
      },
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
      }
    });

    if (error) {
      const serverError = error.context?.error;
      if (serverError && typeof serverError === 'string') {
        toast.error(serverError);
      } else {
        toast.error('An unexpected error occurred while sending the invite.');
      }
    } else {
      toast.success(`Invite sent to ${inviteEmail}`);
      setInviteEmail('');
      fetchMembers();
    }
  };
  
  const handleRevokeInvite = async (inviteId: string) => {
    if (!isAdmin) {
      toast.error("You don't have permission to revoke invites.");
      return;
    }
    const { error } = await supabase.from('org_members').delete().eq('id', inviteId);
    if (error) {
      toast.error('Failed to revoke invite.');
    } else {
      toast.success('Invite revoked.');
      fetchMembers();
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!isAdmin) {
      toast.error("You don't have permission to remove members.");
      return;
    }
    const { error } = await supabase.from('org_members').delete().eq('id', memberId);
    if (error) {
      toast.error('Failed to remove member.');
    } else {
      toast.success('Member removed.');
      fetchMembers();
    }
  };
  
  const handleUpdateOrgName = async () => {
    if (!isAdmin || !organization || !newOrgName.trim() || newOrgName === organization.name) {
      return;
    }

    const { data, error } = await supabase
      .from('organisations')
      .update({ name: newOrgName })
      .eq('id', organization.id)
      .select()
      .single();

    if (error) {
      toast.error('Failed to update workspace name.');
    } else {
      const updatedOrg = data as Organisation;
      toast.success('Workspace name updated.');
      setOrganization(updatedOrg);
    }
  };

  return (
    <div className="text-white">
      {isAdmin && (
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Admin Controls</h2>
          <div className="mb-6">
              <h3 className="text-lg font-medium text-amber-500 mb-2 flex items-center gap-2"><Edit size={20}/>Workspace Name</h3>
              <div className='flex items-center gap-4'>
                <input 
                    type="text" 
                    value={newOrgName} 
                    onChange={(e) => setNewOrgName(e.target.value)} 
                    className="w-full max-w-xs px-3 py-2 bg-[#1f1f1f] border border-[#2f2f2f] rounded-lg outline-none focus:ring-amber-500 focus:border-amber-500"
                />
                <button onClick={handleUpdateOrgName} className="bg-amber-500 text-black font-semibold py-2 px-4 rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2"><Save size={18}/>Save Changes</button>
              </div>
          </div>
        </div>
      )}
      
      {isAdmin && (
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Invite New Members</h2>
          <form onSubmit={handleInvite} className="flex items-center gap-4">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Enter email to invite..."
              className="w-full max-w-md px-4 py-2 bg-[#1f1f1f] border border-[#2f2f2f] rounded-lg focus:ring-amber-500 focus:border-amber-500 outline-none"
            />
            <button type="submit" className="bg-amber-500 text-black font-semibold py-2 px-4 rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2">
              <Send size={18} />
              Send Invite
            </button>
          </form>
        </div>
      )}

      <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-8`}>
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Active Members ({members.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#1f1f1f]">
                  <th className="p-2">Member</th>
                  <th className="p-2">Joined</th>
                  <th className="p-2">Role</th>
                  {isAdmin && <th className="p-2">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {members.map(member => (
                  <tr key={member.id} className="border-b border-[#1f1f1f]">
                    <td className="p-2">{member.invited_email}</td>
                    <td className="p-2">{format(new Date(member.joined_at), 'MMM dd, yyyy')}</td>
                    <td className="p-2 capitalize">
                        {member.role === 'admin' ? 
                            <span className='font-semibold text-amber-500 flex items-center gap-1.5'><Shield size={16}/>{member.role}</span> : 
                            <span>{member.role}</span>}
                    </td>
                    {isAdmin && member.user_id !== user?.id && (
                      <td className="p-2">
                        <button onClick={() => handleRemoveMember(member.id)} className="text-red-500 hover:text-red-700"><Trash2 size={18}/></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {isAdmin && (
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Pending Invites ({pendingInvites.length})</h2>
            <ul className="space-y-3">
              {pendingInvites.map(invite => (
                <li key={invite.id} className="flex items-center justify-between bg-[#1f1f1f] p-3 rounded-lg">
                  <span className="text-gray-400">{invite.invited_email}</span>
                  <button onClick={() => handleRevokeInvite(invite.id)} className="text-red-500 hover:text-red-700"><Trash2 size={18}/></button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Team;
