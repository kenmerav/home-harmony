import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { loadPendingInviteOnboarding } from '@/lib/onboardingStore';
import { AuthLoadingState } from './AuthLoadingState';

export function RequireProfileComplete({ children }: { children: JSX.Element }) {
  const { user, loading, loadingError, profileLoading, isProfileComplete } = useAuth();
  const location = useLocation();
  const targetLocation = `${location.pathname}${location.search}`;
  const pendingInvite = loadPendingInviteOnboarding();
  const isFamilyInviteRoute =
    location.pathname === '/family' && new URLSearchParams(location.search).has('invite');

  if (loading || profileLoading || loadingError) {
    return <AuthLoadingState message="Loading your profile..." failed={Boolean(loadingError)} />;
  }

  if (!user) return <Navigate to="/signin" replace state={{ from: targetLocation }} />;
  if (isFamilyInviteRoute) return children;
  if (!isProfileComplete) {
    if (pendingInvite?.token) {
      const params = new URLSearchParams();
      params.set('force', '1');
      params.set('invite', pendingInvite.token);
      if (pendingInvite.role) params.set('role', pendingInvite.role);
      return <Navigate to={`/onboarding?${params.toString()}`} replace state={{ from: targetLocation }} />;
    }
    return <Navigate to="/onboarding" replace state={{ from: targetLocation }} />;
  }

  return children;
}
