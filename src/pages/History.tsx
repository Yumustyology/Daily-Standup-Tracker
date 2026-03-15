import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { Calendar, Clock, User, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

interface Standup {
  id: string;
  yesterday: string;
  today: string;
  blockers: string;
  standup_date: string;
  created_at: string;
  user_email: string;
}

export default function History() {
  const { user, organization } = useAuth();
  const navigate = useNavigate();
  const [standups, setStandups] = useState<Standup[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('me');
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    if (user && organization) {
      loadStandups();
    } else if (user && !organization && !loading) {
      navigate('/onboarding');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, organization, view, selectedDate]);

  const loadStandups = async () => {
    if (!user || !organization?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
  
    try {
      // Step 1: fetch standups without the broken join
      let query = supabase
        .from('standups')
        .select('id, yesterday, today, blockers, standup_date, created_at, user_id')
        .eq('org_id', organization.id)
        .eq('standup_date', format(selectedDate, 'yyyy-MM-dd'))
        .order('created_at', { ascending: false });
  
      if (view === 'me') {
        query = query.eq('user_id', user.id);
      }
  
      const { data, error } = await query;
      if (error) throw error;
  
      // Step 2: fetch emails from org_members to map user_id → email
      const { data: members, error: membersError } = await supabase
        .from('org_members')
        .select('user_id, invited_email')
        .eq('org_id', organization.id);
  
      if (membersError) throw membersError;
  
      const emailMap: Record<string, string> = {};
      members?.forEach(m => {
        if (m.user_id) emailMap[m.user_id] = m.invited_email;
      });
  
      const formattedData = (data ?? []).map((s: any) => ({
        ...s,
        user_email: emailMap[s.user_id] ?? 'Unknown',
      }));
  
      setStandups(formattedData);
    } catch (error: any) {
      toast.error(`Error loading standups: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(new Date(e.target.value));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    // Adjust for timezone to avoid showing the previous day
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('en-US', {
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
  
  const renderStandupCard = (standup: Standup) => (
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
        {view === 'all' && (
            <div className="flex items-center gap-2 text-sm text-gray-400 mt-2">
                <User className="w-3 h-3" />
                <span>{standup.user_email}</span>
            </div>
        )}
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
  );

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-3xl font-semibold text-white mb-2">Standup History</h1>
            <p className="text-gray-400">
              {loading ? 'Loading entries...' : `${standups.length} ${standups.length === 1 ? 'entry' : 'entries'}`}
            </p>
        </div>
        <div className="relative">
            <input 
                type="date" 
                value={format(selectedDate, 'yyyy-MM-dd')}
                max={format(new Date(), 'yyyy-MM-dd')}
                onChange={handleDateChange}
                className="bg-[#1f1f1f] border border-[#2f2f2f] rounded-lg text-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
        </div>
      </div>
      
      <div className="mb-6 flex items-center gap-2 border-b border-[#1f1f1f]">
        <button onClick={() => setView('me')} className={`flex items-center gap-2 px-4 py-2 font-semibold ${view === 'me' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-gray-400'}`}>
            <User size={18}/> My Standups
        </button>
        <button onClick={() => setView('all')} className={`flex items-center gap-2 px-4 py-2 font-semibold ${view === 'all' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-gray-400'}`}>
            <Users size={18}/> Team Standups
        </button>
      </div>

      {loading ? (
        <div className="text-gray-400">Loading standups...</div>
      ) : standups.length === 0 ? (
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-12 text-center">
          <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No standups found for this date</h3>
          <p className="text-gray-400">Try selecting a different date or log a standup for today.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {standups.map(renderStandupCard)}
        </div>
      )}
    </div>
  );
}
