import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function RequireSubscription({ children }: { children: JSX.Element }) {
  const { user, loading, isSubscribed, subscriptionLoading } = useAuth();
  const location = useLocation();

  if (loading || subscriptionLoading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading subscription...</div>;
  }

  if (!user) return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  if (!isSubscribed) return <Navigate to="/billing" replace state={{ from: location.pathname }} />;
  return children;
}
