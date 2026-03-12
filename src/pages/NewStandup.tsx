import { useState, useEffect } from 'react';
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
  const [hasSubmittedToday, setHasSubmittedToday] = useState(false);

  const getCurrentDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const formatDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  useEffect(() => {
    const checkExistingStandup = async () => {
      if (user?.id && organization?.id) {
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from('standups')
            .select('id')
            .eq('user_id', user.id)
            .eq('org_id', organization.id)
            .eq('standup_date', getCurrentDate());

          if (error) throw error;

          if (data && data.length > 0) {
            setHasSubmittedToday(true);
            toast('You have already submitted a standup for today.');
          }
        } catch (err: any) {
          console.error('Error checking for existing standup:', err);
          toast.error('Failed to check for existing standup.');
        } finally {
          setLoading(false);
        }
      }
    };

    checkExistingStandup();
  }, [user, organization]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasSubmittedToday || !user || !organization) {
      toast.error(hasSubmittedToday ? 'You have already submitted a standup for today.' : 'User or organization not found.');
      return;
    }

    setLoading(true);

    try {
      const standupData = {
        user_id: user.id,
        org_id: organization.id,
        yesterday: yesterday.trim(),
        today: today.trim(),
        blockers: blockers.trim(),
        standup_date: getCurrentDate(),
      };

      const { error: submitError } = await supabase.from('standups').insert(standupData);
      if (submitError) throw new Error(`Failed to save standup: ${submitError.message}`);

      // Manually trigger the database function to update user stats
      // const { error: userStatsError } = await supabase.rpc('update_user_standup_stats', { p_user_id: user.id, p_org_id: organization.id });
      // if (userStatsError) throw new Error(`Failed to update user stats: ${userStatsError.message}`);

      toast.success('Standup saved successfully!');
      navigate('/history');

    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred.');
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
              disabled={loading || !organization || hasSubmittedToday}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-5 h-5" />
              {loading ? 'Saving...' : hasSubmittedToday ? 'Submitted Today' : 'Save Standup'}
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
