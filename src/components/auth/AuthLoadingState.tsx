import { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AuthLoadingStateProps {
  message: string;
  failed?: boolean;
}

export function AuthLoadingState({ message, failed = false }: AuthLoadingStateProps) {
  const [isTakingLonger, setIsTakingLonger] = useState(false);

  useEffect(() => {
    if (failed) {
      setIsTakingLonger(true);
      return;
    }

    const timeoutId = window.setTimeout(() => setIsTakingLonger(true), 8_000);
    return () => window.clearTimeout(timeoutId);
  }, [failed]);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <Loader2 className="mb-4 h-7 w-7 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">
          {isTakingLonger ? 'Home Harmony is having trouble connecting.' : message}
        </p>
        {isTakingLonger && (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Check your connection, then try loading again.
            </p>
            <Button className="mt-5" onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Try again
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
