import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function OrgGuard({ children }: { children: React.ReactNode }) {
  const { organization, loading } = useAuth(); // Depend on loading from useAuth

  // Wait for the initial auth loading to complete
  if (loading) {
    return null; // Or a loading spinner if preferred, but ProtectedRoute already has one
  }

  if (!organization) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
