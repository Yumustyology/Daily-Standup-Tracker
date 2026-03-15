import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import toast from 'react-hot-toast';

const AuthCallback = () => {
  const { session, organization, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    const hash = new URLSearchParams(window.location.hash.substring(1));
    const type = hash.get('type');

    if (type === 'signup') {
      toast.success('Email verified! Welcome to StandupLog 🎉');
    }

    if (session) {
      navigate(organization ? '/dashboard' : '/onboarding', { replace: true });
    } else {
      navigate('/auth', { replace: true });
    }
  }, [session, organization, loading, navigate]);

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <div className="text-white">Processing authentication...</div>
    </div>
  );
};

export default AuthCallback;
