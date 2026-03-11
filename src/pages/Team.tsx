import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import type { Organisation } from '../lib/AuthContext';
import { supabase, supabaseAnonKey } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { Send, Trash2, Edit, Save } from 'lucide-react';
import { format } from 'date-fns';

interface Member {
  id: string;
  user_id: string;
  invited_email: string;
  joined_at: string;
  status: string;
}

const Team = () => {
  const { user, organization, setOrganization } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingInvites, setPendingInvites] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [editingOrgName, setEditingOrgName] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');

  useEffect(() => {
    if (organization) {
      fetchMembers();
      setIsOwner(organization.created_by === user?.id);
      setNewOrgName(organization.name);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization, user]);

  const fetchMembers = async () => {
    if (!organization) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('org_members')
      .select('id, user_id, invited_email, joined_at, status')
      .eq('org_id', organization.id);

    if (error) {
      toast.error('Failed to fetch team members.');
      console.error('Error:', error.message);
    } else {
      const typedData = data as unknown as Member[];
      setMembers(typedData.filter(m => m.status === 'active'));
      setPendingInvites(typedData.filter(m => m.status === 'pending'));
    }
    setLoading(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !organization || !user) return;

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
      // The error from invoke is a FunctionsError, which has a `context` property
      // containing the response body from the edge function.
      const serverError = error.context?.error;

      if (serverError && typeof serverError === 'string') {
        if (serverError.includes('verify a domain')) {
          toast.error('Email domain not verified. Please set up your domain on resend.com.');
        } else {
          toast.error(serverError);
        }
      } else {
        // Fallback for unexpected errors
        toast.error('An unexpected error occurred while sending the invite.');
      }
    } else {
      toast.success(`Invite sent to ${inviteEmail}`);
      setInviteEmail('');
      fetchMembers();
    }
  };
  
  const handleRevokeInvite = async (inviteId: string) => {
    const { error } = await supabase.from('org_members').delete().eq('id', inviteId);
    if (error) {
      toast.error('Failed to revoke invite.');
    } else {
      toast.success('Invite revoked.');
      fetchMembers();
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await supabase.from('org_members').delete().eq('id', memberId);
    if (error) {
      toast.error('Failed to remove member.');
    } else {
      toast.success('Member removed.');
      fetchMembers();
    }
  };
  
  const handleUpdateOrgName = async () => {
    if (!organization || !newOrgName.trim() || newOrgName === organization.name) {
      setEditingOrgName(false);
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
      setEditingOrgName(false);
    }
  };

  return (
    <div className="text-white">
      {isOwner && (
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Owner Controls</h2>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Active Members ({members.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#1f1f1f]">
                  <th className="p-2">Member</th>
                  <th className="p-2">Joined</th>
                  <th className="p-2">Role</th>
                  {isOwner && <th className="p-2">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {members.map(member => (
                  <tr key={member.id} className="border-b border-[#1f1f1f]">
                    <td className="p-2">{member.invited_email}</td>
                    <td className="p-2">{format(new Date(member.joined_at), 'MMM dd, yyyy')}</td>
                    <td className="p-2">{member.user_id === organization?.created_by ? <span className='font-semibold text-amber-500'>Owner</span> : 'Member'}</td>
                    {isOwner && member.user_id !== user?.id && (
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

        <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Pending Invites ({pendingInvites.length})</h2>
          <ul className="space-y-3">
            {pendingInvites.map(invite => (
              <li key={invite.id} className="flex items-center justify-between bg-[#1f1f1f] p-3 rounded-lg">
                <span className="text-gray-400">{invite.invited_email}</span>
                {isOwner && <button onClick={() => handleRevokeInvite(invite.id)} className="text-red-500 hover:text-red-700"><Trash2 size={18}/></button>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Team;
