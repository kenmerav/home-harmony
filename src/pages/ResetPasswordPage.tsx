import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HomeHarmonyLogo } from '@/components/branding/HomeHarmonyLogo';
import { useAuth } from '@/contexts/AuthContext';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      setMessage('Password updated. Redirecting to sign in...');
      setTimeout(() => {
        navigate('/signin', { replace: true });
      }, 900);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Could not update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background grid place-items-center p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <HomeHarmonyLogo className="mb-6" />
        <h1 className="font-display text-2xl">Set a new password</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Use the link from your email, then set your new password here.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <Input
            type="password"
            required
            minLength={6}
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            type="password"
            required
            minLength={6}
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Button className="w-full" disabled={loading}>
            {loading ? 'Updating...' : 'Update password'}
          </Button>
        </form>

        {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}

        <div className="mt-6">
          <Link to="/signin" className="text-xs text-muted-foreground underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
