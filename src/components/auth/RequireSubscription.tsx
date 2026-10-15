import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BILLING_ENABLED } from '@/lib/billing';
import { loadPendingInviteOnboarding } from '@/lib/onboardingStore';
import { AuthLoadingState } from './AuthLoadingState';

export function RequireSubscription({ children }: { children: JSX.Element }) {
  const { user, loading, loadingError, isSubscribed, subscriptionLoading, householdScopeLoading } = useAuth();
  const location = useLocation();
  const targetLocation = `${location.pathname}${location.search}`;
  const pendingInvite = loadPendingInviteOnboarding();
  if (!BILLING_ENABLED) return children;

  if (loading || subscriptionLoading || householdScopeLoading || loadingError) {
    return <AuthLoadingState message="Loading your household..." failed={Boolean(loadingError)} />;
  }

  if (!user) return <Navigate to="/signin" replace state={{ from: targetLocation }} />;
  if (pendingInvite?.token) return children;
  if (location.pathname === '/family') {
    const params = new URLSearchParams(location.search);
    if (params.get('invite')) return children;
  }
  if (!isSubscribed) return <Navigate to="/billing" replace state={{ from: targetLocation }} />;
  return children;
}
