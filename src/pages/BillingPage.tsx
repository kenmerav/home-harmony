import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { HomeHarmonyLogo } from '@/components/branding/HomeHarmonyLogo';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BILLING_ENABLED } from '@/lib/billing';
import {
  BillingInterval,
  formatUsd,
  HOME_HARMONY_PRICING,
  yearlySavingsAmount,
} from '@/lib/pricing';

async function resolveInvokeErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error instanceof Error) {
    const invokeError = error as Error & { context?: Response };
    if (invokeError.context) {
      try {
        const cloned = invokeError.context.clone();
        const body = await cloned.json();
        if (body && typeof body.error === 'string' && body.error.trim()) {
          return body.error;
        }
      } catch {
        // keep fallback behavior
      }
    }
    if (invokeError.message?.trim()) return invokeError.message;
  }
  return fallback;
}

export default function BillingPage() {
  const { user, signOut, subscription, isSubscribed, refreshSubscription } = useAuth();
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<BillingInterval>('yearly');
  const navigate = useNavigate();
  const hasBillingAccess = isSubscribed || Boolean(subscription?.priceId);

  if (!BILLING_ENABLED) {
    return (
      <div className="min-h-screen bg-background grid place-items-center p-4">
        <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <HomeHarmonyLogo />
            <Button variant="ghost" onClick={() => signOut()}>Sign out</Button>
          </div>
          <h1 className="mt-6 font-display text-3xl">Free Access Enabled</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Billing is turned off right now. Your account has full access while we finish setup.
          </p>
          <div className="mt-6">
            <Button onClick={() => navigate('/app')}>Open App</Button>
          </div>
        </div>
      </div>
    );
  }

  const startCheckout = async (interval: BillingInterval) => {
    setLoadingCheckout(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          interval,
          successUrl: `${window.location.origin}/billing?checkout=success`,
          cancelUrl: `${window.location.origin}/billing?checkout=cancel`,
        },
      });
      if (error) {
        const detail = await resolveInvokeErrorMessage(error, 'Unable to start checkout');
        throw new Error(detail);
      }
      const url = data?.url as string | undefined;
      if (!url) throw new Error('No checkout URL returned');
      window.location.assign(url);
    } catch (error: unknown) {
      const text = await resolveInvokeErrorMessage(error, 'Unable to start checkout');
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
      if (error) {
        const detail = await resolveInvokeErrorMessage(error, 'Unable to open customer portal');
        throw new Error(detail);
      }
      const url = data?.url as string | undefined;
      if (!url) throw new Error('No portal URL returned');
      window.location.assign(url);
    } catch (error: unknown) {
      const text = await resolveInvokeErrorMessage(error, 'Unable to open customer portal');
      setMessage(text);
    } finally {
      setLoadingPortal(false);
    }
  };

  return (
    <div className="min-h-screen bg-background grid place-items-center p-4">
      <div className="w-full max-w-5xl rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
        <div className="flex items-center justify-between">
          <HomeHarmonyLogo />
          <Button variant="ghost" onClick={() => signOut()}>Sign out</Button>
        </div>

        <div className="mt-8 grid gap-8 md:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Pricing</p>
            <h1 className="mt-3 font-display text-4xl leading-tight md:text-5xl">
              Choose the plan that keeps your home running smoothly.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground">
              Start with a {HOME_HARMONY_PRICING.trialDays}-day free trial, then continue on the plan that fits your family best.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">Signed in as {user?.email || 'unknown user'}</p>

            <div className="mt-6 rounded-xl border border-border bg-background p-4">
              <p className="text-sm text-muted-foreground">Current plan status</p>
              <p className="text-xl font-semibold capitalize">{subscription?.status || 'inactive'}</p>
              {subscription?.currentPeriodEnd && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Current period ends: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-background p-5">
              <h2 className="font-display text-2xl">Everything included</h2>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>Meal planning, grocery automation, chores, tasks, shared calendar, workouts, and nutrition tracking</li>
                <li>Family member profiles, event reminders, and household coordination in one account</li>
                <li>One simple subscription for the whole household</li>
              </ul>
            </div>
          </div>

          <div className="grid gap-4">
            <button
              type="button"
              onClick={() => setSelectedInterval('yearly')}
              className={`rounded-2xl border p-6 text-left transition ${
                selectedInterval === 'yearly'
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border bg-background hover:border-primary/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-primary">Best Value</p>
                  <h2 className="mt-1 font-display text-3xl">Yearly</h2>
                  <p className="mt-3 text-4xl font-semibold">{formatUsd(HOME_HARMONY_PRICING.yearly)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Save {formatUsd(yearlySavingsAmount())} compared with paying monthly
                  </p>
                </div>
                <div className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Save {formatUsd(yearlySavingsAmount())}
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Pay once and keep your full household organized for the year.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSelectedInterval('monthly')}
              className={`rounded-2xl border p-6 text-left transition ${
                selectedInterval === 'monthly'
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border bg-background hover:border-primary/40'
              }`}
            >
              <h2 className="font-display text-3xl">Monthly</h2>
              <p className="mt-3 text-4xl font-semibold">{formatUsd(HOME_HARMONY_PRICING.monthly)}</p>
              <p className="mt-1 text-sm text-muted-foreground">per month after your free trial</p>
              <p className="mt-4 text-sm text-muted-foreground">
                Lower commitment upfront if you want to start month to month.
              </p>
            </button>

            <div className="rounded-2xl border border-border bg-muted/30 p-5">
              {!isSubscribed ? (
                <Button className="w-full" onClick={() => void startCheckout(selectedInterval)} disabled={loadingCheckout}>
                  {loadingCheckout
                    ? 'Opening checkout...'
                    : `Start ${HOME_HARMONY_PRICING.trialDays}-day free trial on ${selectedInterval}`}
                </Button>
              ) : (
                <Button className="w-full" onClick={() => navigate('/app')}>Open App</Button>
              )}
              <p className="mt-3 text-center text-xs text-muted-foreground">
                No charge today. Cancel anytime during the free trial.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {hasBillingAccess ? (
            <Button variant="outline" onClick={openPortal} disabled={loadingPortal}>
              {loadingPortal ? 'Opening portal...' : 'Manage billing'}
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Billing portal unlocks after you start your trial
            </Button>
          )}
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
