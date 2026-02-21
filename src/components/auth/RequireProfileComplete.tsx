import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function RequireProfileComplete({ children }: { children: JSX.Element }) {
  const { user, loading, profileLoading, isProfileComplete } = useAuth();
  const location = useLocation();

  if (loading || profileLoading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading profile...</div>;
  }

  if (!user) return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  if (!isProfileComplete) return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;

  return children;
}
