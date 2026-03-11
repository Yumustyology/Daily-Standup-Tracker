
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import NewStandup from './pages/NewStandup';
import History from './pages/History';
import Onboarding from './pages/Onboarding';
import Team from './pages/Team';
import AuthCallback from './pages/AuthCallback';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';

// Error Fallback Component defined directly in App.tsx
const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center p-4" role="alert">
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-8 w-full max-w-md shadow-lg text-center">
        <h1 className="text-2xl font-semibold text-red-500 mb-4">Something went wrong</h1>
        <p className="text-gray-400 mb-6">{error.message}</p>
        <button
          onClick={resetErrorBoundary}
          className="bg-amber-500 text-black py-2 px-4 rounded-lg font-semibold hover:bg-amber-600 transition-colors duration-200"
        >
          Try Again
        </button>
      </div>
    </div>
  );
};

function AppRoutes() {
  const { user, loading, organization } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/dashboard" replace /> : <Auth />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/auth" replace />} />

      {/* Onboarding Route: Only accessible if user is logged in but has no organization */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            {user && !organization ? <Onboarding /> : <Navigate to="/dashboard" replace />}
          </ProtectedRoute>
        }
      />

      {/* Protected Routes that require an organization */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/new-standup"
        element={
          <ProtectedRoute>
            <Layout>
              <NewStandup />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <Layout>
              <History />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/team"
        element={
          <ProtectedRoute>
            <Layout>
              <Team />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster />
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onReset={() => window.location.replace('/')}
        >
          <AppRoutes />
        </ErrorBoundary>
      </AuthProvider>
    </Router>
  );
}

export default App;
