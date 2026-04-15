import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BILLING_ENABLED } from '@/lib/billing';

export function RequireSubscription({ children }: { children: JSX.Element }) {
  const { user, loading, isSubscribed, subscriptionLoading, householdScopeLoading } = useAuth();
  const location = useLocation();
  const targetLocation = `${location.pathname}${location.search}`;
  if (!BILLING_ENABLED) return children;

  if (loading || subscriptionLoading || householdScopeLoading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading subscription...</div>;
  }

  if (!user) return <Navigate to="/signin" replace state={{ from: targetLocation }} />;
  if (location.pathname === '/family') {
    const params = new URLSearchParams(location.search);
    if (params.get('invite')) return children;
  }
  if (!isSubscribed) return <Navigate to="/billing" replace state={{ from: targetLocation }} />;
  return children;
}
