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
import InvitesPage from './pages/Invite';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';
import OrgGuard from './routes/OrgGuard';

const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center p-4" role="alert">
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-8 w-full max-w-md shadow-lg text-center">
        <h1 className="text-2xl font-semibold text-red-500 mb-4">Something went wrong</h1>
        <p className="text-gray-400 mb-6">{(error as Error).message}</p>
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
  const { user, loading } = useAuth();

  if (loading) {
    return null; 
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/onboarding" replace /> : <Auth />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/" element={user ? <Navigate to="/onboarding" replace /> : <Navigate to="/auth" replace />} />

      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <OrgGuard>
              <Layout>
                <Dashboard />
              </Layout>
            </OrgGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/new-standup"
        element={
          <ProtectedRoute>
            <OrgGuard>
              <Layout>
                <NewStandup />
              </Layout>
            </OrgGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <OrgGuard>
              <Layout>
                <History />
              </Layout>
            </OrgGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/team"
        element={
          <ProtectedRoute>
            <OrgGuard>
              <Layout>
                <Team />
              </Layout>
            </OrgGuard>
          </ProtectedRoute>
        }
      />

      <Route 
        path="/invite"
        element={
          <ProtectedRoute>
            <Layout>
              <InvitesPage />
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
