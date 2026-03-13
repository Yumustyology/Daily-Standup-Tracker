import { useState, useRef, useEffect } from 'react';
import { useAuth, Organisation } from '../lib/AuthContext';
import { ChevronsUpDown, Plus, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const TeamSwitcher = () => {
  const { user, organization, userOrgs, setActiveOrg, createOrganization } = useAuth();
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

  const handleSwitch = (org: Organisation) => {
    setActiveOrg(org);
    setIsOpen(false);
    toast.success(`Switched to ${org.name}`);
  };

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    setIsCreating(true);
    const { data, error } = await createOrganization(newOrgName);
    if (!error && data) {
      // AuthContext now handles setting the new org as active.
      // We just need to close the switcher UI.
      setNewOrgName('');
      setIsOpen(false);
    }
    setIsCreating(false);
  };

  if (!organization) return null;

  return (
    <div className="relative" ref={switcherRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-2 text-left bg-[#0f0f0f] border border-[#1f1f1f] rounded-lg text-white hover:bg-[#1f1f1f] transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
      >
        <span className="font-semibold">{organization.name}</span>
        <ChevronsUpDown className="w-4 h-4 text-gray-400" />
      </button>
      {isOpen && (
        <div className="absolute z-10 w-full mt-2 bg-[#111111] border border-[#1f1f1f] rounded-lg shadow-lg">
          <div className="p-2">
            {userOrgs.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSwitch(org)}
                disabled={org.id === organization.id}
                className="flex items-center justify-between w-full px-3 py-2 text-left text-white rounded-md hover:bg-[#1f1f1f] disabled:opacity-50 disabled:cursor-default transition-colors"
              >
                {org.name}
                {org.id === organization.id && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
          <div className="border-t border-[#1f1f1f] p-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="New workspace name..."
                className="w-full px-3 py-2 bg-[#0f0f0f] border border-[#1f1f1f] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                onClick={handleCreateOrg}
                disabled={isCreating || !newOrgName.trim()}
                className="p-2 bg-amber-500 text-gray-900 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {isCreating ? (
                  <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                ) : (
                  <Plus className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamSwitcher;
