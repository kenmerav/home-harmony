import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AuthLoadingState } from './AuthLoadingState';

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading, authLoadingError, retryLoading } = useAuth();
  const location = useLocation();

  if (loading || (!user && authLoadingError)) {
    return (
      <AuthLoadingState
        message="Loading Home Harmony..."
        failed={Boolean(authLoadingError)}
        onRetry={retryLoading}
      />
    );
  }
  if (!user) return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  return children;
}
