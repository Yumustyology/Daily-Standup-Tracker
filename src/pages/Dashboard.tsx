import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Calendar, TrendingUp, PlusCircle, Users, Flame, CheckCircle, XCircle, LucideIcon } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

interface Standup {
  id: string;
  yesterday: string;
  today: string;
  blockers: string;
  standup_date: string;
}

interface StatCardProps {
    title: string;
    value: number | null;
    icon: LucideIcon;
    subValue?: number | null;
    loading: boolean;
}

interface StreakCardProps {
    title: string;
    value: number | null;
    icon: LucideIcon;
    loading: boolean;
}

export default function Dashboard() {
  const { user, organization, userOrgs, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [totalStandups, setTotalStandups] = useState<number | null>(null);
  const [teamStandupsTodayCount, setTeamStandupsTodayCount] = useState<number | null>(null);
  const [totalTeamMembers, setTotalTeamMembers] = useState<number | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittedToday, setSubmittedToday] = useState(false);
  const [recentStandups, setRecentStandups] = useState<Standup[]>([]);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadStats = useCallback(async () => {
    if (!user || !organization) return;
    
    setLoading(true);
    setError(null);
    let hasError = false;
    const today = format(new Date(), 'yyyy-MM-dd');

    // Check if standup submitted today
    const { data: todayStandup, error: todayStandupError } = await supabase
      .from('standups')
      .select('id')
      .eq('user_id', user.id)
      .eq('org_id', organization.id)
      .eq('standup_date', today)
      .single();

    if (todayStandupError && todayStandupError.code !== 'PGRST116') { // PGRST116: no rows found
        console.error("Error checking for today's standup:", todayStandupError);
        hasError = true;
    } else if (isMounted.current) {
        setSubmittedToday(!!todayStandup);
    }

    // Fetch recent standups
    const { data: recentStandupsData, error: recentStandupsError } = await supabase
      .from('standups')
      .select('id, yesterday, today, blockers, standup_date')
      .eq('user_id', user.id)
      .eq('org_id', organization.id)
      .order('standup_date', { ascending: false })
      .limit(3);

    if (recentStandupsError) {
        console.error('Error fetching recent standups:', recentStandupsError);
        hasError = true; // Or handle as non-critical
    } else if (isMounted.current) {
        setRecentStandups(recentStandupsData || []);
    }

    // Fetch user stats
    const { data: userStats, error: userStatsError } = await supabase
      .from('user_standup_stats')
      .select('total_standups, current_streak')
      .eq('user_id', user.id)
      .eq('org_id', organization.id)
      .single();

    if (userStatsError && userStatsError.code !== 'PGRST116') {
      console.error('Error fetching user stats:', userStatsError);
      hasError = true;
    } else if (isMounted.current) {
      setTotalStandups(userStats?.total_standups || 0);
      setStreak(userStats?.current_streak || 0);
    }

    // Fetch team members count
    const { count: membersCount, error: membersError } = await supabase
      .from('org_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('org_id', organization.id)
      .eq('status', 'active');

    if (membersError) {
      console.error('Error fetching team members:', membersError);
      hasError = true;
    } else if (isMounted.current) {
      setTotalTeamMembers(membersCount || 0);
    }

    // Fetch team daily stats
    const { data: teamStats, error: teamStatsError } = await supabase
      .from('team_daily_stats')
      .select('submissions')
      .eq('org_id', organization.id)
      .eq('standup_date', today)
      .single();

    if (teamStatsError && teamStatsError.code !== 'PGRST116') {
      console.error('Error fetching team daily stats:', teamStatsError);
      hasError = true;
    } else if (isMounted.current) {
      setTeamStandupsTodayCount(teamStats?.submissions || 0);
    }

    if (isMounted.current) {
        setLoading(false);
        if (hasError) {
            setError('Some dashboard stats failed to load. Please try again later.');
            toast.error('Some dashboard stats failed to load.');
        }
    }
  }, [user, organization]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate('/auth');
      return;
    }

    if (!organization && userOrgs.length === 0) {
      navigate('/onboarding');
      return;
    }

    if (organization) {
      loadStats();
    }
  }, [authLoading, user, organization, userOrgs, navigate, loadStats]);

  const formatDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };
  
  const formatStandupDate = (dateString: string) => {
    // Adjust for timezone to display correct day
    const date = new Date(dateString.replace(/-/g, '/'));
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  const StatCard = ({ title, value, icon: Icon, subValue, loading }: StatCardProps) => {
    const displayValue = loading || value === null ? '...' : value;
    return (
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Icon className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-medium text-gray-400">{title}</h3>
          </div>
          <p className="text-3xl font-semibold text-white">
            {displayValue}
            {subValue !== undefined && !loading && ` / ${subValue}`}
          </p>
        </div>
    );
  }
  
  const StreakCard = ({ title, value, icon: Icon, loading }: StreakCardProps) => {
    const displayValue = loading || value === null ? '...' : value;
    const label = value === 1 ? 'day' : 'days';
    return (
         <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Icon className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-medium text-gray-400">{title}</h3>
          </div>
          <p className="text-3xl font-semibold text-white">
            {displayValue} {!loading && label}
          </p>
        </div>
    );
  }


  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center">
        <p>Loading...</p>
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
      
      {error && !loading && (
        <div className="bg-red-900/20 border border-red-500/30 text-red-300 p-4 rounded-lg mb-6">
            <p>{error}</p>
            <button
                onClick={loadStats}
                className="mt-2 bg-red-500/50 hover:bg-red-500/70 text-white font-semibold py-1 px-3 rounded-lg text-sm transition-colors"
            >
                Try Again
            </button>
        </div>
      )}

      {!loading && (
        <div className={`p-4 rounded-lg mb-6 flex items-center gap-3 ${submittedToday ? 'bg-green-900/20 border border-green-500/30 text-green-300' : 'bg-amber-900/20 border border-amber-500/30 text-amber-300'}`}>
            {submittedToday ? <CheckCircle size={20} /> : <XCircle size={20} />}
            <p className="font-medium">
                {submittedToday ? "You've submitted your standup for today. Great job!" : "You have not submitted your standup for today."}
            </p>
        </div>
      )}


      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard 
            title="Your Total Standups" 
            value={totalStandups} 
            icon={TrendingUp}
            loading={loading}
        />
        <StatCard 
            title="Team Submitted Today" 
            value={teamStandupsTodayCount} 
            subValue={totalTeamMembers}
            icon={Users}
            loading={loading}
        />
        <StreakCard
            title="Your Streak" 
            value={streak} 
            icon={Flame}
            loading={loading}
        />
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Your Recent Standups</h2>
        {loading ? (
            <p className="text-gray-400">Loading recent standups...</p>
        ) : recentStandups.length > 0 ? (
            <div className="space-y-4">
                {recentStandups.map((standup) => (
                    <div key={standup.id} className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-6">
                        <p className="text-sm font-semibold text-amber-500 mb-3">{formatStandupDate(standup.standup_date)}</p>
                        <div className="space-y-3">
                            <div>
                                <h4 className="text-sm font-semibold text-gray-400 mb-1">Yesterday</h4>
                                <p className="text-white whitespace-pre-wrap">{standup.yesterday}</p>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-gray-400 mb-1">Today</h4>
                                <p className="text-white whitespace-pre-wrap">{standup.today}</p>
                            </div>
                            {standup.blockers && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-400 mb-1">Blockers</h4>
                                    <p className="text-white whitespace-pre-wrap">{standup.blockers}</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        ) : (
             <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-12 text-center">
                <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No standups yet</h3>
                <p className="text-gray-400">Once you log your first standup, you'll see your recent entries here.</p>
            </div>
        )}
      </div>

      {!loading && !submittedToday && (
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-white mb-3">Ready to log today's standup?</h2>
            <p className="text-gray-400 mb-6">Keep track of your progress and stay accountable to your goals</p>
            <button
            onClick={() => navigate('/new-standup')}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-colors"
            >
            <PlusCircle className="w-5 h-5" />
            Log Today's Standup
            </button>
        </div>
      )}
    </div>
  );
}
