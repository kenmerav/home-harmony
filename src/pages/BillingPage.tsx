import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { HomeHarmonyLogo } from '@/components/branding/HomeHarmonyLogo';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export default function BillingPage() {
  const { user, signOut, subscription, isSubscribed, refreshSubscription } = useAuth();
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const startCheckout = async () => {
    setLoadingCheckout(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          successUrl: `${window.location.origin}/billing?checkout=success`,
          cancelUrl: `${window.location.origin}/billing?checkout=cancel`,
        },
      });
      if (error) throw new Error(error.message);
      const url = data?.url as string | undefined;
      if (!url) throw new Error('No checkout URL returned');
      window.location.assign(url);
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : 'Unable to start checkout';
      setMessage(text);
    } finally {
      setLoadingCheckout(false);
    }
  };

  const openPortal = async () => {
    setLoadingPortal(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: { returnUrl: `${window.location.origin}/billing` },
      });
      if (error) throw new Error(error.message);
      const url = data?.url as string | undefined;
      if (!url) throw new Error('No portal URL returned');
      window.location.assign(url);
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : 'Unable to open customer portal';
      setMessage(text);
    } finally {
      setLoadingPortal(false);
    }
  };

  return (
    <div className="min-h-screen bg-background grid place-items-center p-4">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <HomeHarmonyLogo />
          <Button variant="ghost" onClick={() => signOut()}>Sign out</Button>
        </div>

        <h1 className="mt-6 font-display text-3xl">Billing & Access</h1>
        <p className="text-sm text-muted-foreground mt-1">Signed in as {user?.email || 'unknown user'}</p>

        <div className="mt-6 rounded-lg border border-border bg-background p-4">
          <p className="text-sm text-muted-foreground">Current plan status</p>
          <p className="text-xl font-semibold capitalize">{subscription?.status || 'inactive'}</p>
          {subscription?.currentPeriodEnd && (
            <p className="text-xs text-muted-foreground mt-1">
              Current period ends: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {!isSubscribed ? (
            <Button onClick={startCheckout} disabled={loadingCheckout}>
              {loadingCheckout ? 'Opening checkout...' : 'Start 14-day trial'}
            </Button>
          ) : (
            <Button onClick={() => navigate('/app')}>Open App</Button>
          )}
          <Button variant="outline" onClick={openPortal} disabled={loadingPortal}>
            {loadingPortal ? 'Opening portal...' : 'Manage billing'}
          </Button>
          <Button variant="ghost" onClick={refreshSubscription}>Refresh status</Button>
        </div>

        {message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}

        <div className="mt-8 text-sm">
          <Link to="/" className="text-primary underline">Back to homepage</Link>
        </div>
      </div>
    </div>
  );
}
