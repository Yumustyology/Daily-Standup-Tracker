import { useState, useRef, useEffect } from 'react';
import { useAuth, Organisation } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { ChevronsUpDown, Plus, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const TeamSwitcher = () => {
  const { user, organization, userOrgs, setActiveOrg } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateOrg = async () => {
    if (!user || !newOrgName.trim()) return;
    setIsCreating(true);

    const { data, error: orgError } = await supabase
      .from('organisations')
      .insert({ name: newOrgName, created_by: user.id })
      .select()
      .single();

    if (orgError) {
      toast.error('Failed to create workspace.');
      console.error('Error:', orgError.message);
      setIsCreating(false);
      return;
    }
    const newOrg = data as Organisation;

    const { error: memberError } = await supabase.from('org_members').insert({
      org_id: newOrg.id,
      user_id: user.id,
      status: 'active',
      invited_email: user.email!,
      joined_at: new Date().toISOString(),
    });

    if (memberError) {
      toast.error('Failed to join new workspace.');
      console.error('Error:', memberError.message);
      setIsCreating(false);
      return;
    }

    setActiveOrg(newOrg);
    setNewOrgName('');
    setIsOpen(false);
    toast.success(`Switched to ${newOrg.name}`);
    setIsCreating(false);
  };

  return (
    <div className="relative" ref={switcherRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-md bg-[#1f1f1f] px-3 py-2 text-sm font-medium text-white hover:bg-[#2f2f2f]"
      >
        <span>{organization?.name}</span>
        <ChevronsUpDown className="h-4 w-4 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 w-64 rounded-lg bg-[#111111] border border-[#1f1f1f] shadow-lg">
          <div className="p-2">
            <p className="px-2 py-1 text-xs font-semibold text-amber-500">YOUR WORKSPACES</p>
            <div className="mt-1 space-y-1">
              {userOrgs.map(org => (
                <button
                  key={org.id}
                  onClick={() => { setActiveOrg(org); setIsOpen(false); }}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm text-white hover:bg-[#1f1f1f] disabled:opacity-50"
                  disabled={org.id === organization?.id}
                >
                  <span>{org.name}</span>
                  {org.id === organization?.id && <Check className="h-4 w-4 text-amber-500" />}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[#1f1f1f] p-2">
            <div className="mt-1 space-y-2">
                <p className='text-xs px-2 text-gray-400'>Create a new workspace</p>
                <div className='flex gap-2 px-2'>
                    <input 
                        type="text" 
                        value={newOrgName} 
                        onChange={(e) => setNewOrgName(e.target.value)} 
                        placeholder="New workspace name..."
                        className="w-full px-2 py-1 bg-[#1f1f1f] border border-[#2f2f2f] rounded-md text-sm outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <button 
                        onClick={handleCreateOrg}
                        disabled={isCreating || !newOrgName.trim()}
                        className="rounded-md bg-amber-500 px-3 py-1 text-sm font-semibold text-black hover:bg-amber-600 disabled:opacity-50"
                    >
                        {isCreating ? <Plus className='animate-spin'/> : 'Create'}
                    </button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamSwitcher;
