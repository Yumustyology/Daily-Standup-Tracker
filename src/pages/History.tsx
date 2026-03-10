import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { Calendar, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

interface Standup {
  id: string;
  yesterday: string;
  today: string;
  blockers: string;
  standup_date: string;
  created_at: string;
}

export default function History() {
  const { user, organization } = useAuth();
  const navigate = useNavigate();
  const [standups, setStandups] = useState<Standup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && organization) {
      loadStandups();
    } else if (user && !organization && !loading) {
      // If user exists but no organization, redirect to onboarding
      navigate('/onboarding');
    }
  }, [user, organization, navigate, loading]);

  const loadStandups = async () => {
    if (!user || !organization?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('standups')
        .select('*')
        .eq('user_id', user.id)
        .eq('org_id', organization.id) // Filter by organization ID
        .order('standup_date', { ascending: false });

      if (error) throw error;
      setStandups(data || []);
    } catch (error: any) {
      toast.error(`Error loading standups: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-semibold text-white mb-6">History</h1>
        <div className="text-gray-400">Loading your standups...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-white mb-2">Standup History</h1>
        <p className="text-gray-400">
          {standups.length} {standups.length === 1 ? 'entry' : 'entries'} logged
        </p>
      </div>

      {standups.length === 0 ? (
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-12 text-center">
          <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No standups yet</h3>
          <p className="text-gray-400">Start logging your daily standups to see them here!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {standups.map((standup) => (
            <div
              key={standup.id}
              className="bg-[#111111] border border-[#1f1f1f] rounded-lg overflow-hidden"
            >
              <div className="bg-[#0f0f0f] border-b border-[#1f1f1f] px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-500" />
                    <h3 className="font-semibold text-white">{formatDate(standup.standup_date)}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(standup.created_at)}</span>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">
                    What I did yesterday
                  </h4>
                  <p className="text-white whitespace-pre-wrap">{standup.yesterday}</p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">
                    What I'm doing today
                  </h4>
                  <p className="text-white whitespace-pre-wrap">{standup.today}</p>
                </div>

                {standup.blockers && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-2">Blockers</h4>
                    <p className="text-white whitespace-pre-wrap">{standup.blockers}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
