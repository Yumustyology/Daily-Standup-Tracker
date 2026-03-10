import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Calendar, TrendingUp, PlusCircle } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [totalStandups, setTotalStandups] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [user]);

  const loadStats = async () => {
    if (!user) return;

    try {
      const { count, error } = await supabase
        .from('standups')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (error) throw error;
      setTotalStandups(count || 0);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-white mb-2">
          Welcome back, {user?.email?.split('@')[0]}
        </h1>
        <div className="flex items-center gap-2 text-gray-400">
          <Calendar className="w-4 h-4" />
          <span>{formatDate()}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-medium text-gray-400">Total Standups</h3>
          </div>
          <p className="text-3xl font-semibold text-white">
            {loading ? '...' : totalStandups}
          </p>
        </div>

        <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-medium text-gray-400">Current Streak</h3>
          </div>
          <p className="text-3xl font-semibold text-white">
            {totalStandups > 0 ? '🔥' : '—'}
          </p>
        </div>
      </div>

      <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-8 text-center">
        <h2 className="text-xl font-semibold text-white mb-3">Ready to log today's standup?</h2>
        <p className="text-gray-400 mb-6">
          Keep track of your progress and stay accountable to your goals
        </p>
        <button
          onClick={() => navigate('/new-standup')}
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          <PlusCircle className="w-5 h-5" />
          Log Today's Standup
        </button>
      </div>
    </div>
  );
}
