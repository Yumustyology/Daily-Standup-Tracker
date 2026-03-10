import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Calendar, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function NewStandup() {
  const { user, organization } = useAuth();
  const navigate = useNavigate();
  const [yesterday, setYesterday] = useState('');
  const [today, setToday] = useState('');
  const [blockers, setBlockers] = useState('');
  const [loading, setLoading] = useState(false);

  const formatDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!user) {
      toast.error('You must be logged in to submit a standup.');
      setLoading(false);
      return;
    }

    if (!organization) {
      toast.error('You must be part of an organization to submit a standup. Redirecting to onboarding...');
      setLoading(false);
      navigate('/onboarding');
      return;
    }

    try {
      const { error: submitError } = await supabase
        .from('standups')
        .insert({
          user_id: user.id,
          org_id: organization.id, // Include org_id
          yesterday: yesterday.trim(),
          today: today.trim(),
          blockers: blockers.trim(),
          standup_date: new Date().toISOString().split('T')[0],
        });

      if (submitError) throw submitError;

      toast.success('Standup saved successfully!');
      navigate('/history');
    } catch (err: any) {
      toast.error(`Failed to save standup: ${err.message || 'Please try again.'}`);
      console.error('Error submitting standup:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-white mb-2">New Standup</h1>
        <div className="flex items-center gap-2 text-gray-400">
          <Calendar className="w-4 h-4" />
          <span>{formatDate()}</span>
        </div>
      </div>

      <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="yesterday" className="block text-sm font-semibold text-white mb-3">
              What did you do yesterday?
            </label>
            <textarea
              id="yesterday"
              value={yesterday}
              onChange={(e) => setYesterday(e.target.value)}
              required
              rows={4}
              className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#1f1f1f] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
              placeholder="Completed the authentication module, fixed bugs in the dashboard..."
            />
          </div>

          <div>
            <label htmlFor="today" className="block text-sm font-semibold text-white mb-3">
              What are you doing today?
            </label>
            <textarea
              id="today"
              value={today}
              onChange={(e) => setToday(e.target.value)}
              required
              rows={4}
              className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#1f1f1f] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
              placeholder="Working on the API integration, implementing the new feature..."
            />
          </div>

          <div>
            <label htmlFor="blockers" className="block text-sm font-semibold text-white mb-3">
              Any blockers?
            </label>
            <textarea
              id="blockers"
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#1f1f1f] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
              placeholder="Waiting for API documentation, need help with deployment setup... (leave empty if none)"
            />
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading || !organization}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-5 h-5" />
              {loading ? 'Saving...' : 'Save Standup'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 border border-[#1f1f1f] text-gray-300 hover:text-white hover:border-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
