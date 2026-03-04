import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import {
  defaultSmsPreferences,
  loadSmsPreferences,
  saveSmsPreferences,
  sendSmsTestMessage,
  type SmsPreferences,
} from '@/lib/api/sms';
import { useToast } from '@/hooks/use-toast';

const START_STEPS = [
  {
    title: 'Import recipes',
    detail: 'Add your recipe library first so meal planning and swaps work with your real meals.',
    href: '/recipes',
    cta: 'Open Recipes',
  },
  {
    title: 'Build this week',
    detail: 'Generate or manually set meals for each day, then lock your must-keep days.',
    href: '/meals',
    cta: 'Open Meals',
  },
  {
    title: 'Confirm grocery list',
    detail: 'Review combined quantities and mark your order complete.',
    href: '/grocery',
    cta: 'Open Grocery',
  },
  {
    title: 'Invite family',
    detail: 'Add spouse and kids so chores, tasks, and meals stay in one shared flow.',
    href: '/family',
    cta: 'Open Family',
  },
];

export default function GetStartedPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [smsPrefs, setSmsPrefs] = useState<SmsPreferences>(() =>
    defaultSmsPreferences(Intl.DateTimeFormat().resolvedOptions().timeZone),
  );
  const [loadingSms, setLoadingSms] = useState(true);
  const [savingSms, setSavingSms] = useState(false);
  const [testingSms, setTestingSms] = useState(false);

  const canUseRemoteSms = Boolean(user?.id);

  useEffect(() => {
    if (!canUseRemoteSms) return;
    let mounted = true;
    const load = async () => {
      setLoadingSms(true);
      try {
        const prefs = await loadSmsPreferences();
        if (mounted) {
          setSmsPrefs(prefs);
        }
      } catch (error) {
        if (mounted) {
          toast({
            title: 'Could not load SMS settings',
            description: error instanceof Error ? error.message : 'Unknown error',
            variant: 'destructive',
          });
        }
      } finally {
        if (mounted) setLoadingSms(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [canUseRemoteSms, toast]);

  const smsReady = useMemo(
    () => smsPrefs.phone_e164.trim().length > 0 && smsPrefs.enabled,
    [smsPrefs.enabled, smsPrefs.phone_e164],
  );

  const saveSms = async () => {
    if (!canUseRemoteSms) return;
    setSavingSms(true);
    try {
      const saved = await saveSmsPreferences(smsPrefs);
      setSmsPrefs(saved);
      toast({ title: 'SMS settings saved' });
    } catch (error) {
      toast({
        title: 'Could not save SMS settings',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSavingSms(false);
    }
  };

  const sendTestSms = async () => {
    setTestingSms(true);
    try {
      await sendSmsTestMessage();
      toast({ title: 'Test SMS sent' });
    } catch (error) {
      toast({
        title: 'Could not send test SMS',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setTestingSms(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Start here"
        subtitle="Fast setup path so your first week runs smoothly"
        action={
          <Link to="/app">
            <Button size="sm">Go to dashboard</Button>
          </Link>
        }
      />

      <div className="space-y-6">
        <SectionCard title="Your first 30 minutes" subtitle="Follow this order for the best setup result.">
          <div className="space-y-3">
            {START_STEPS.map((step, index) => (
              <div key={step.title} className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Step {index + 1}</p>
                <p className="font-medium mt-1">{step.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{step.detail}</p>
                <Link to={step.href} className="inline-block mt-2">
                  <Button size="sm" variant="outline">{step.cta}</Button>
                </Link>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Enable SMS reminders"
          subtitle="Add your phone so Home Harmony can text schedules and reminders."
        >
          {loadingSms ? (
            <p className="text-sm text-muted-foreground">Loading SMS settings...</p>
          ) : (
            <div className="space-y-3">
              <label className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span className="text-sm">Enable SMS updates</span>
                <Switch
                  checked={smsPrefs.enabled}
                  onCheckedChange={(checked) =>
                    setSmsPrefs((prev) => ({ ...prev, enabled: Boolean(checked) }))
                  }
                />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Phone number (E.164)</p>
                  <Input
                    placeholder="+16155551234"
                    value={smsPrefs.phone_e164}
                    onChange={(event) =>
                      setSmsPrefs((prev) => ({ ...prev, phone_e164: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Timezone</p>
                  <Input
                    placeholder="America/Chicago"
                    value={smsPrefs.timezone}
                    onChange={(event) =>
                      setSmsPrefs((prev) => ({ ...prev, timezone: event.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void saveSms()} disabled={savingSms}>
                  {savingSms ? 'Saving...' : 'Save SMS settings'}
                </Button>
                <Button variant="outline" onClick={() => void sendTestSms()} disabled={testingSms || !smsReady}>
                  {testingSms ? 'Sending...' : 'Send test text'}
                </Button>
                <Link to="/settings">
                  <Button variant="ghost">Advanced SMS options</Button>
                </Link>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Need help?" subtitle="Use these pages when setting up your home system.">
          <div className="flex flex-wrap gap-2">
            <Link to="/calendar"><Button variant="outline" size="sm">Calendar setup</Button></Link>
            <Link to="/tasks"><Button variant="outline" size="sm">Task setup</Button></Link>
            <Link to="/chores"><Button variant="outline" size="sm">Chore setup</Button></Link>
            <Link to="/workouts"><Button variant="outline" size="sm">Workout setup</Button></Link>
            <Link to="/settings"><Button variant="outline" size="sm">Profile settings</Button></Link>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Signed in as {profile?.fullName || user?.email || 'your account'}.
          </p>
        </SectionCard>
      </div>
    </AppLayout>
  );
}
