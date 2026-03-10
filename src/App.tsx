import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import NewStandup from './pages/NewStandup';
import History from './pages/History';
import Onboarding from './pages/Onboarding'; // Import Onboarding
import Team from './pages/Team'; // Import Team

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
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Auth />} />

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
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
