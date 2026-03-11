import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Calendar, TrendingUp, PlusCircle, Users, Flame } from 'lucide-react';
import { format, differenceInDays, startOfDay } from 'date-fns';
import { toast } from 'react-hot-toast';

export default function Dashboard() {
  const { user, organization } = useAuth();
  const navigate = useNavigate();
  const [totalStandups, setTotalStandups] = useState<number>(0);
  const [teamStandupsTodayCount, setTeamStandupsTodayCount] = useState<number>(0);
  const [totalTeamMembers, setTotalTeamMembers] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && organization) {
      loadStats();
    } else if (user && !organization) {
      // If user exists but no organization, redirect to onboarding
      navigate('/onboarding');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, organization, navigate]);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    if (!user || !organization?.id) {
      setLoading(false);
      return;
    }

    const timeout = setTimeout(() => {
      setError('Having trouble loading your dashboard? Please try again later.');
      setLoading(false);
    }, 10000);

    try {
      // Fetch total individual standups
      const { count: individualCount, error: individualError } = await supabase
        .from('standups')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('org_id', organization.id);

      if (individualError) throw individualError;
      setTotalStandups(individualCount || 0);

      // Fetch team members
      const { data: members, error: membersError } = await supabase
        .from('org_members')
        .select('id, user_id, status')
        .eq('org_id', organization.id)
        .eq('status', 'active');

      if (membersError) throw membersError;
      setTotalTeamMembers(members?.length || 0);

      const activeMemberIds = members?.map(m => m.user_id).filter(Boolean) as string[] || [];
      const today = format(new Date(), 'yyyy-MM-dd');

      // Fetch team standups today
      const { count: teamStandupsCount, error: teamStandupsError } = await supabase
        .from('standups')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', organization.id)
        .eq('standup_date', today)
        .in('user_id', activeMemberIds);

      if (teamStandupsError) throw teamStandupsError;
      setTeamStandupsTodayCount(teamStandupsCount || 0);

      // Calculate streak
      const { data: userStandups, error: userStandupsError } = await supabase
        .from('standups')
        .select('standup_date')
        .eq('user_id', user.id)
        .eq('org_id', organization.id)
        .order('standup_date', { ascending: false });
      
      if (userStandupsError) throw userStandupsError;

      let currentStreak = 0;
      if (userStandups && userStandups.length > 0) {
        let previousDate: Date | null = null;
        const todayDate = startOfDay(new Date());

        for (let i = 0; i < userStandups.length; i++) {
          const standup = userStandups[i];
          const standupDate = startOfDay(new Date(standup.standup_date));
          
          if (i === 0) {
            // If the most recent standup is today or yesterday
            if (differenceInDays(todayDate, standupDate) <= 1) {
              currentStreak = 1;
            } else {
              break; // No streak
            }
          } else if (previousDate) {
            if (differenceInDays(previousDate, standupDate) === 1) {
              currentStreak++;
            } else {
              break; // Gap in standups, so streak is broken
            }
          }
          previousDate = standupDate;
        }
      }
      setStreak(currentStreak);

    } catch (error: any) {
      setError(error.message);
      toast.error(`Error loading stats: ${error.message}`);
    } finally {
      clearTimeout(timeout);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col items-center justify-center">
        <p className="mb-4">{error}</p>
        <button
          onClick={loadStats}
          className="bg-amber-500 hover:bg-amber-600 text-gray-900 font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-medium text-gray-400">Your Total Standups</h3>
          </div>
          <p className="text-3xl font-semibold text-white">
            {totalStandups}
          </p>
        </div>

        <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-medium text-gray-400">Team Submitted Today</h3>
          </div>
          <p className="text-3xl font-semibold text-white">
            {teamStandupsTodayCount} / {totalTeamMembers}
          </p>
        </div>

        <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Flame className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-medium text-gray-400">Your Streak</h3>
          </div>
          <p className="text-3xl font-semibold text-white">
            {streak} {streak === 1 ? 'day' : 'days'}
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
