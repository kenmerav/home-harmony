import { Component, ErrorInfo, ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { loadOnboardingResult } from '@/lib/onboardingStore';
import {
  defaultSmsPreferences,
  loadSmsPreferences,
  saveSmsPreferences,
  sendSmsTestMessage,
  type SmsPreferences,
} from '@/lib/api/sms';
import { useToast } from '@/hooks/use-toast';
import { FEATURE_TUTORIALS } from '@/data/getStartedTutorials';

const DEFAULT_START_STEPS = [
  {
    title: 'Run onboarding first',
    detail: 'Finish onboarding so your household profile, meal preferences, and fixed-day rules are saved.',
    href: '/onboarding?force=1',
    cta: 'Open onboarding',
  },
  {
    title: 'Import recipes you actually use',
    detail: 'Use links, PDFs, or manual input so meal planning has real options for your family.',
    href: '/getting-started/recipes-import-and-cleanup',
    cta: 'Import guide',
  },
  {
    title: 'Build next week',
    detail: 'Generate meals, lock recurring days, then verify swaps and meal slots.',
    href: '/getting-started/weekly-meal-planning-and-swaps',
    cta: 'Meal planning guide',
  },
  {
    title: 'Confirm grocery list and reminders',
    detail: 'Review merged quantities, check store links, and save SMS preferences.',
    href: '/getting-started/grocery-rollup-and-store-flow',
    cta: 'Grocery guide',
  },
];

interface LaunchChecklistItem {
  title: string;
  detail: string;
  href: string;
  cta: string;
}

const SAFE_GET_STARTED_ROUTES = new Set([
  '/app',
  '/family',
  '/meals',
  '/calendar',
  '/grocery',
  '/tasks',
  '/chores',
  '/settings',
  '/dashboard/me',
  '/recipes',
  '/workouts',
  '/getting-started',
]);

function normalizeInternalRoute(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return fallback;
  const pathOnly = trimmed.split('?')[0]?.split('#')[0] || trimmed;
  return SAFE_GET_STARTED_ROUTES.has(pathOnly) ? trimmed : fallback;
}

function readLaunchChecklist(input: unknown): LaunchChecklistItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({
      title: typeof item.title === 'string' ? item.title.trim() : '',
      detail: typeof item.detail === 'string' ? item.detail.trim() : '',
      href: typeof item.href === 'string' ? item.href.trim() : '',
      cta: typeof item.cta === 'string' ? item.cta.trim() : '',
    }))
    .filter((item) => item.title && item.detail && item.href && item.cta);
}

function buildWellnessSummary(input: unknown): string | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const parts: string[] = [];
  if (Number.isFinite(Number(value.waterTargetOz)) && Number(value.waterTargetOz) > 0) {
    parts.push(`${Math.round(Number(value.waterTargetOz))} oz water`);
  }
  if (typeof value.stepGoal === 'string' && value.stepGoal.trim()) {
    parts.push(`${value.stepGoal.trim()} steps`);
  }
  if (Number.isFinite(Number(value.alcoholLimitDrinks)) && Number(value.alcoholLimitDrinks) >= 0) {
    parts.push(`${Number(value.alcoholLimitDrinks)} alcohol limit`);
  }
  if (typeof value.wakeUpTime === 'string' && value.wakeUpTime.trim()) {
    parts.push(`wake-up ${value.wakeUpTime.trim()}`);
  }
  if (Number.isFinite(Number(value.sleepTargetHours)) && Number(value.sleepTargetHours) > 0) {
    parts.push(`${Math.round(Number(value.sleepTargetHours))}h sleep`);
  }
  return parts.length > 0 ? parts.join(' • ') : null;
}

function GetStartedPageContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [smsPrefs, setSmsPrefs] = useState<SmsPreferences>(() =>
    defaultSmsPreferences(Intl.DateTimeFormat().resolvedOptions().timeZone),
  );
  const [loadingSms, setLoadingSms] = useState(true);
  const [savingSms, setSavingSms] = useState(false);
  const [testingSms, setTestingSms] = useState(false);
  const [startSteps, setStartSteps] = useState<LaunchChecklistItem[]>(DEFAULT_START_STEPS);
  const [focusLabel, setFocusLabel] = useState('First-week setup');
  const [focusRoute, setFocusRoute] = useState('/app');
  const [wellnessSummary, setWellnessSummary] = useState<string | null>(null);

  const canUseRemoteSms = Boolean(user?.id);

  useEffect(() => {
    let mounted = true;
    const loadPlan = async () => {
      const stored = await loadOnboardingResult(user?.id);
      if (!mounted) return;
      const plan = stored?.personalizedPlan as Record<string, unknown> | undefined;
      const launchChecklist = readLaunchChecklist(plan?.launchChecklist);
      const incomingFocusLabel = plan?.focusLabel;
      const incomingFocusRoute = plan?.focusRoute;
      const incomingWellnessSummary = buildWellnessSummary(plan?.wellnessTargets);
      if (launchChecklist.length > 0) {
        setStartSteps(
          launchChecklist.map((step) => ({
            ...step,
            href: normalizeInternalRoute(step.href, '/getting-started'),
          })),
        );
      } else {
        setStartSteps(DEFAULT_START_STEPS);
      }
      if (typeof incomingFocusLabel === 'string' && incomingFocusLabel.trim()) {
        setFocusLabel(incomingFocusLabel.trim());
      } else {
        setFocusLabel('First-week setup');
      }
      if (typeof incomingFocusRoute === 'string' && incomingFocusRoute.trim()) {
        setFocusRoute(normalizeInternalRoute(incomingFocusRoute.trim(), '/app'));
      } else {
        setFocusRoute('/app');
      }
      setWellnessSummary(incomingWellnessSummary);
    };
    const safeLoadPlan = async () => {
      try {
        await loadPlan();
      } catch (error) {
        console.error('Failed loading Start Here plan:', error);
        if (!mounted) return;
        setStartSteps(DEFAULT_START_STEPS);
        setFocusLabel('First-week setup');
        setFocusRoute('/app');
        setWellnessSummary(null);
      }
    };
    void safeLoadPlan();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!canUseRemoteSms) {
      setLoadingSms(false);
      return;
    }
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

  const smsReady = smsPrefs.phone_e164.trim().length > 0 && smsPrefs.enabled;

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
        title="Setup + tutorials"
        subtitle="Step-by-step guides with screenshots so your household can start clean and run smoothly"
        action={
          <Link to={focusRoute}>
            <Button size="sm">Open {focusLabel}</Button>
          </Link>
        }
      />

      <div className="space-y-6">
        <SectionCard
          title="Fast start path"
          subtitle={`Use this order for your first week. Your current setup is centered on ${focusLabel.toLowerCase()}.`}
        >
          {wellnessSummary ? (
            <div className="mb-4 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Wellness targets from onboarding: <span className="font-medium text-foreground">{wellnessSummary}</span>
            </div>
          ) : null}
          <div className="space-y-3">
            {startSteps.map((step, index) => (
              <div key={step.title} className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Step {index + 1}</p>
                <p className="mt-1 font-medium">{step.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
                <Link to={step.href} className="mt-2 inline-block">
                  <Button size="sm" variant="outline">
                    {step.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Feature tutorials" subtitle="Open any guide for screenshots and exact clicks.">
          <div className="grid gap-4 md:grid-cols-2">
            {FEATURE_TUTORIALS.map((tutorial) => (
              <article key={tutorial.slug} className="overflow-hidden rounded-lg border border-border bg-card">
                <img
                  src={tutorial.heroImage}
                  alt={tutorial.heroAlt}
                  className="h-40 w-full object-cover"
                  loading="lazy"
                />
                <div className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{tutorial.audience}</p>
                    <p className="text-xs text-muted-foreground">{tutorial.timeToComplete}</p>
                  </div>
                  <h2 className="text-lg font-semibold leading-tight">{tutorial.title}</h2>
                  <p className="text-sm text-muted-foreground">{tutorial.summary}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Link to={`/getting-started/${tutorial.slug}`}>
                      <Button size="sm">Open tutorial</Button>
                    </Link>
                    <Link to={tutorial.primaryRoute}>
                      <Button size="sm" variant="outline">
                        {tutorial.primaryCta}
                      </Button>
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Enable SMS reminders"
          subtitle="Add your phone so Home Harmony can text schedule summaries and reminder nudges."
        >
          {loadingSms ? (
            <p className="text-sm text-muted-foreground">Loading SMS settings...</p>
          ) : (
            <div className="space-y-3">
              <label className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span className="text-sm">Enable SMS updates</span>
                <Switch
                  checked={smsPrefs.enabled}
                  onCheckedChange={(checked) => setSmsPrefs((prev) => ({ ...prev, enabled: Boolean(checked) }))}
                />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Phone number (E.164)</p>
                  <Input
                    placeholder="+16155551234"
                    value={smsPrefs.phone_e164}
                    onChange={(event) => setSmsPrefs((prev) => ({ ...prev, phone_e164: event.target.value }))}
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Timezone</p>
                  <Input
                    placeholder="America/Chicago"
                    value={smsPrefs.timezone}
                    onChange={(event) => setSmsPrefs((prev) => ({ ...prev, timezone: event.target.value }))}
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

        <SectionCard title="Need more help?" subtitle="These links jump directly to the right setup surfaces.">
          <div className="flex flex-wrap gap-2">
            <Link to="/calendar/connect-apple?platform=apple">
              <Button variant="outline" size="sm">
                Apple Calendar guide
              </Button>
            </Link>
            <Link to="/calendar/connect-apple?platform=google">
              <Button variant="outline" size="sm">
                Google Calendar guide
              </Button>
            </Link>
            <Link to="/calendar">
              <Button variant="outline" size="sm">
                Calendar planner
              </Button>
            </Link>
            <Link to="/recipes">
              <Button variant="outline" size="sm">
                Recipe import
              </Button>
            </Link>
            <Link to="/meals">
              <Button variant="outline" size="sm">
                Meals + macro planner
              </Button>
            </Link>
            <Link to="/settings">
              <Button variant="outline" size="sm">
                Profile settings
              </Button>
            </Link>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Signed in as {profile?.fullName || user?.email || 'your account'}.
          </p>
        </SectionCard>
      </div>
    </AppLayout>
  );
}

class GetStartedErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('GetStartedPage crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <AppLayout>
          <PageHeader
            title="Setup + tutorials"
            subtitle="We hit a snag loading this page, but you can still open the main setup areas below."
          />
          <div className="space-y-6">
            <SectionCard title="Quick links" subtitle="Use these while we keep tightening the tutorials page.">
              <div className="flex flex-wrap gap-2">
                <Link to="/family">
                  <Button variant="outline">Family</Button>
                </Link>
                <Link to="/meals">
                  <Button variant="outline">Meals</Button>
                </Link>
                <Link to="/grocery">
                  <Button variant="outline">Grocery</Button>
                </Link>
                <Link to="/calendar">
                  <Button variant="outline">Calendar</Button>
                </Link>
                <Link to="/recipes">
                  <Button variant="outline">Recipes</Button>
                </Link>
                <Link to="/settings">
                  <Button variant="outline">Settings</Button>
                </Link>
              </div>
            </SectionCard>
          </div>
        </AppLayout>
      );
    }

    return this.props.children;
  }
}

export function SafeGetStartedPage() {
  return (
    <GetStartedErrorBoundary>
      <GetStartedPageContent />
    </GetStartedErrorBoundary>
  );
}

export default SafeGetStartedPage;
