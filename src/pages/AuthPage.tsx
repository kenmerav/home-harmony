import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HomeHarmonyLogo } from '@/components/branding/HomeHarmonyLogo';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthPage() {
  const { user, isSubscribed, isProfileComplete, signIn, signUp, startDemoSession } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [startingDemo, setStartingDemo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const search = new URLSearchParams(location.search);
  const onboardingIntent = search.get('onboarding') === '1';

  const from = (location.state as { from?: string } | null)?.from || (onboardingIntent ? '/onboarding?force=1' : '/billing');

  useEffect(() => {
    if (!user) return;
    if (onboardingIntent) {
      navigate('/onboarding?force=1', { replace: true });
      return;
    }
    if (!isProfileComplete) {
      navigate('/onboarding', { replace: true });
      return;
    }
    navigate(isSubscribed ? '/app' : '/billing', { replace: true });
  }, [isProfileComplete, isSubscribed, navigate, onboardingIntent, user]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        navigate(from, { replace: true });
      } else {
        await signUp(email, password, {
          fullName,
          householdName,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        setMessage('Account created. Check your email for confirmation if prompted, then sign in.');
        setMode('signin');
        setPassword('');
      }
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : 'Authentication failed';
      setMessage(text);
    } finally {
      setLoading(false);
    }
  };

  const enterDemo = async () => {
    setStartingDemo(true);
    await startDemoSession();
    navigate('/app', { replace: true });
    setStartingDemo(false);
  };

  return (
    <div className="min-h-screen bg-background grid place-items-center p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <HomeHarmonyLogo className="mb-6" />
        <h1 className="font-display text-2xl">{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {mode === 'signin'
            ? 'Welcome back. Sign in to continue.'
            : 'Create your Home Harmony account to start your trial.'}
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
          <Input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button className="w-full" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}

        <div className="mt-4 text-sm">
          {mode === 'signin' ? (
            <button type="button" className="text-primary underline" onClick={() => setMode('signup')}>
              Need an account? Create one
            </button>
          ) : (
            <button type="button" className="text-primary underline" onClick={() => setMode('signin')}>
              Have an account? Sign in
            </button>
          )}
        </div>

        <div className="mt-6">
          <Link to="/" className="text-xs text-muted-foreground underline">
            Back to homepage
          </Link>
        </div>
        <div className="mt-3">
          <Button variant="outline" className="w-full" onClick={enterDemo} disabled={startingDemo}>
            {startingDemo ? 'Starting demo...' : 'Continue as Demo Account'}
          </Button>
        </div>
      </div>
    </div>
  );
}
