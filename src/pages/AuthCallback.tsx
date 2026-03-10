import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

const AuthCallback = () => {
  const { session, organization, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) {
      return; // Wait for the loading to complete
    }

    if (session) {
      if (organization) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
    } else {
      // If there's no session after loading, redirect to auth page
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
