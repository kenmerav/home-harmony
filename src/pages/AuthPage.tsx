import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HomeHarmonyLogo } from '@/components/branding/HomeHarmonyLogo';
import { useAuth } from '@/contexts/AuthContext';
import { stashPendingReferralCode } from '@/lib/referral';
import { trackGrowthEventSafe } from '@/lib/api/growthAnalytics';
import { getPostAuthRoute } from '@/lib/billing';
import { sendWelcomeEmail } from '@/lib/api/emails';

export default function AuthPage() {
  const {
    user,
    isSubscribed,
    isProfileComplete,
    profileLoading,
    subscriptionLoading,
    signIn,
    signUp,
    requestPasswordReset,
  } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const search = new URLSearchParams(location.search);
  const onboardingIntent = search.get('onboarding') === '1';
  const referralCode = search.get('ref');
  const source = search.get('source');
  const intent = search.get('intent');
  const ab = search.get('ab');

  const from = (location.state as { from?: string } | null)?.from || (onboardingIntent ? '/onboarding?force=1' : '/app');

  useEffect(() => {
    if (!referralCode) return;
    stashPendingReferralCode(referralCode);
  }, [referralCode]);

  useEffect(() => {
    if (!user) return;
    if (profileLoading || subscriptionLoading) return;
    if (onboardingIntent) {
      navigate('/onboarding?force=1', { replace: true });
      return;
    }
    if (!isProfileComplete) {
      navigate('/onboarding', { replace: true });
      return;
    }
    navigate(getPostAuthRoute(isSubscribed), { replace: true });
  }, [
    isProfileComplete,
    isSubscribed,
    navigate,
    onboardingIntent,
    profileLoading,
    subscriptionLoading,
    user,
  ]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        await trackGrowthEventSafe(
          'signin_success',
          {
            source: source || null,
            intent: intent || null,
            ab: ab || null,
            onboardingIntent,
          },
          `signin_success:${new Date().toISOString().slice(0, 10)}:${source || 'direct'}:${intent || 'none'}`,
        );
        navigate(from, { replace: true });
      } else if (mode === 'signup') {
        await signUp(email, password, {
          fullName,
          householdName,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        try {
          await sendWelcomeEmail();
        } catch (emailError) {
          console.error('Failed sending signup welcome email:', emailError);
        }
        await trackGrowthEventSafe(
          'signup_submitted',
          {
            source: source || null,
            intent: intent || null,
            ab: ab || null,
            onboardingIntent,
          },
          `signup_submitted:${new Date().toISOString().slice(0, 10)}:${source || 'direct'}:${intent || 'none'}`,
        );
        setMessage('Account created. Check your email for confirmation if prompted, then sign in.');
        setMode('signin');
        setPassword('');
      } else {
        const redirectTo =
          typeof window !== 'undefined'
            ? `${window.location.origin}/reset-password`
            : undefined;
        await requestPasswordReset(email, redirectTo);
        setMessage('Password reset email sent. Check your inbox and spam folder.');
        setMode('signin');
      }
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : 'Authentication failed';
      setMessage(text);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background grid place-items-center p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <HomeHarmonyLogo className="mb-6" />
        <h1 className="font-display text-2xl">
          {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Reset password'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {mode === 'signin'
            ? 'Welcome back. Sign in to continue.'
            : mode === 'signup'
            ? 'Create your Home Harmony account to start your trial.'
            : 'Enter your email to receive a password reset link.'}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          {mode === 'signup' && (
            <>
              <Input
                type="text"
                required
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <Input
                type="text"
                placeholder="Household name (optional)"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
              />
            </>
          )}
          <Input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {mode !== 'forgot' && (
            <Input
              type="password"
              required
              minLength={6}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
          <Button className="w-full" disabled={loading}>
            {loading
              ? 'Please wait...'
              : mode === 'signin'
              ? 'Sign In'
              : mode === 'signup'
              ? 'Create Account'
              : 'Send Reset Link'}
          </Button>
        </form>

        {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}

        <div className="mt-4 text-sm">
          {mode === 'signin' && (
            <div className="flex items-center gap-4">
              <button type="button" className="text-primary underline" onClick={() => setMode('signup')}>
                Need an account? Create one
              </button>
              <button type="button" className="text-primary underline" onClick={() => setMode('forgot')}>
                Forgot password?
              </button>
            </div>
          )}
          {mode === 'signup' && (
            <button type="button" className="text-primary underline" onClick={() => setMode('signin')}>
              Have an account? Sign in
            </button>
          )}
          {mode === 'forgot' && (
            <button type="button" className="text-primary underline" onClick={() => setMode('signin')}>
              Back to sign in
            </button>
          )}
        </div>

        <div className="mt-6">
          <Link to="/" className="text-xs text-muted-foreground underline">
            Back to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
