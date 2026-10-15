import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BILLING_ENABLED } from '@/lib/billing';
import { loadPendingInviteOnboarding } from '@/lib/onboardingStore';
import { AuthLoadingState } from './AuthLoadingState';

export function RequireSubscription({ children }: { children: JSX.Element }) {
  const {
    user,
    loading,
    authLoadingError,
    subscriptionLoadingError,
    isSubscribed,
    subscriptionLoading,
    householdScopeLoading,
    retryLoading,
  } = useAuth();
  const location = useLocation();
  const targetLocation = `${location.pathname}${location.search}`;
  const pendingInvite = loadPendingInviteOnboarding();
  if (!BILLING_ENABLED) return children;

  const blockingError = !user
    ? authLoadingError
    : (!isSubscribed ? subscriptionLoadingError : null);
  const accessStillResolving = !isSubscribed && (subscriptionLoading || householdScopeLoading);
  if (loading || accessStillResolving || blockingError) {
    return (
      <AuthLoadingState
        message="Loading your household..."
        failed={Boolean(blockingError)}
        onRetry={retryLoading}
      />
    );
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
