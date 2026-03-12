import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import LoadingScreen from "../components/LoadingScreen";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
