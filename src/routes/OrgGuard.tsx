import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function OrgGuard({ children }: { children: React.ReactNode }) {
  const { organization, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!organization) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
