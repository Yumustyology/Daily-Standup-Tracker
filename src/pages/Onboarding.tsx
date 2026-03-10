import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { LogOut } from 'lucide-react';
import { toast } from 'react-hot-toast';

const Onboarding = () => {
  const { user, organization, setOrganization } = useAuth();
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (organization) {
      navigate('/dashboard');
    }
  }, [organization, navigate]);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!user) {
      toast.error('You must be logged in to create an organization.');
      setLoading(false);
      return;
    }

    if (!orgName.trim()) {
      toast.error('Organization name cannot be empty.');
      setLoading(false);
      return;
    }

    try {
      // Create the organization
      const { data: orgData, error: orgError } = await supabase
        .from('organisations')
        .insert([{ name: orgName, created_by: user.id }])
        .select()
        .single();

      if (orgError) throw orgError;

      // Add the creator as an active member
      const { error: memberError } = await supabase
        .from('org_members')
        .insert([{ org_id: orgData.id, user_id: user.id, status: 'active', invited_email: user.email || '' }])
        .select()
        .single();

      if (memberError) throw memberError;

      setOrganization({ id: orgData.id, name: orgData.name });
      toast.success(`Organization "${orgName}" created!`);
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error creating organization:', error.message);
      toast.error(`Error creating organization: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!user) {
      toast.error('You must be logged in to join an organization.');
      setLoading(false);
      return;
    }

    if (!inviteEmail.trim()) {
      toast.error('Please enter the invite email.');
      setLoading(false);
      return;
    }

    try {
      // Find pending invite
      const { data: invite, error: findInviteError } = await supabase
        .from('org_members')
        .select('*, organisations(id, name)')
        .eq('invited_email', inviteEmail)
        .eq('status', 'pending')
        .single();

      if (findInviteError || !invite) {
        throw new Error('No pending invite found for this email.');
      }

      // Check if the invite matches the current user's email
      if (invite.invited_email !== user.email) {
        throw new Error('This invite is not for your email address.');
      }

      // Update org_members status to 'active'
      const { data: updatedMember, error: updateMemberError } = await supabase
        .from('org_members')
        .update({ user_id: user.id, status: 'active', joined_at: new Date().toISOString() })
        .eq('id', invite.id)
        .eq('invited_email', user.email)
        .select('*, organisations(id, name)')
        .single();

      if (updateMemberError) throw updateMemberError;

      if (updatedMember && updatedMember.organisations) {
        setOrganization({ id: updatedMember.organisations.id, name: updatedMember.organisations.name });
        toast.success(`Joined organization "${updatedMember.organisations.name}"!`);
        navigate('/dashboard');
      } else {
        throw new Error('Failed to retrieve organization details after joining.');
      }

    } catch (error: any) {
      console.error('Error joining organization:', error.message);
      toast.error(`Error joining organization: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center">
        <p>Loading user data or not logged in...</p>
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
          Welcome! It looks like you're not part of an organization yet.
        </p>

        {/* Create new workspace */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Create a new workspace</h2>
          <form onSubmit={handleCreateOrg} className="space-y-4">
            <div>
              <label htmlFor="orgName" className="block text-sm font-medium text-gray-400 mb-2">
                Workspace Name
              </label>
              <input
                type="text"
                id="orgName"
                className="w-full px-4 py-2 bg-[#1f1f1f] border border-[#2f2f2f] rounded-lg focus:ring-amber-500 focus:border-amber-500 outline-none text-white placeholder-gray-500"
                placeholder="e.g., My Team"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-amber-500 text-black py-2 rounded-lg font-semibold hover:bg-amber-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Workspace'}
            </button>
          </form>
        </div>

        <div className="relative flex items-center justify-center my-8">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[#1f1f1f]" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#111111] px-2 text-gray-500">Or</span>
          </div>
        </div>

        {/* Join with an invite */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Join with an invite</h2>
          <form onSubmit={handleJoinOrg} className="space-y-4">
            <div>
              <label htmlFor="inviteEmail" className="block text-sm font-medium text-gray-400 mb-2">
                Your Email (used for invite)
              </label>
              <input
                type="email"
                id="inviteEmail"
                className="w-full px-4 py-2 bg-[#1f1f1f] border border-[#2f2f2f] rounded-lg focus:ring-amber-500 focus:border-amber-500 outline-none text-white placeholder-gray-500"
                placeholder="your.email@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-amber-500 text-black py-2 rounded-lg font-semibold hover:bg-amber-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Joining...' : 'Join Workspace'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
