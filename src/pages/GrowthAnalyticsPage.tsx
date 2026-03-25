import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  fetchGrowthEventCountsByType,
  fetchRecentGrowthEvents,
  GrowthEventRow,
  trackGrowthEventSafe,
} from '@/lib/api/growthAnalytics';
import { getReferralStats, ReferralStats } from '@/lib/api/referrals';

interface FunnelRow {
  label: string;
  eventType: string;
}

function isDeprecatedGrowthEvent(eventType: string): boolean {
  return eventType.startsWith('free_tool_');
}

const FUNNEL: FunnelRow[] = [
  { label: 'Landing view', eventType: 'landing_view' },
  { label: 'Sign-in success', eventType: 'signin_success' },
  { label: 'Onboarding complete', eventType: 'onboarding_complete' },
  { label: 'Meals regenerated', eventType: 'meals_regenerated' },
];

export default function GrowthAnalyticsPage() {
  const { user, isDemoUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [events, setEvents] = useState<GrowthEventRow[]>([]);
  const [referralStats, setReferralStats] = useState<ReferralStats>({ clicked: 0, signedUp: 0, subscribed: 0 });

  const refresh = useCallback(async () => {
    if (!user?.id || isDemoUser) {
      setCounts({});
      setEvents([]);
      setReferralStats({ clicked: 0, signedUp: 0, subscribed: 0 });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [nextCounts, nextEvents, nextReferrals] = await Promise.all([
        fetchGrowthEventCountsByType(30),
        fetchRecentGrowthEvents(100),
        getReferralStats(),
      ]);
      setCounts(
        Object.fromEntries(
          Object.entries(nextCounts).filter(([eventType]) => !isDeprecatedGrowthEvent(eventType)),
        ),
      );
      setEvents(nextEvents.filter((row) => !isDeprecatedGrowthEvent(row.eventType)));
      setReferralStats(nextReferrals);
    } catch (error) {
      toast({
        title: 'Could not load growth analytics',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, isDemoUser, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user?.id || isDemoUser) return;
    const dayKey = new Date().toISOString().slice(0, 10);
    void trackGrowthEventSafe('growth_dashboard_view', {}, `growth_dashboard_view:${dayKey}`);
  }, [user?.id, isDemoUser]);

  const totalEvents = useMemo(() => Object.values(counts).reduce((sum, n) => sum + n, 0), [counts]);

  return (
    <AppLayout>
      <PageHeader
        title="Growth Analytics"
        subtitle="30-day funnel, engagement events, and referral performance"
        action={<Button variant="outline" onClick={() => void refresh()} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</Button>}
      />

      {isDemoUser ? (
        <SectionCard title="Demo mode">
          <p className="text-sm text-muted-foreground">
            Growth analytics are disabled in demo mode because events sync to your authenticated Supabase user.
          </p>
        </SectionCard>
      ) : null}

      <div className="space-y-6">
        <SectionCard title="30-Day Snapshot" subtitle="High-level event volume and referral outcomes">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Growth events</p>
              <p className="mt-1 text-2xl font-semibold">{totalEvents}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Referral clicks</p>
              <p className="mt-1 text-2xl font-semibold">{referralStats.clicked}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Referral signups</p>
              <p className="mt-1 text-2xl font-semibold">{referralStats.signedUp}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Referral subscribed</p>
              <p className="mt-1 text-2xl font-semibold">{referralStats.subscribed}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Funnel Events" subtitle="Current key events tracked in-app">
          <div className="space-y-2">
            {FUNNEL.map((step) => (
              <div key={step.eventType} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium">{step.label}</p>
                  <p className="text-xs text-muted-foreground">{step.eventType}</p>
                </div>
                <Badge variant="outline">{counts[step.eventType] || 0}</Badge>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Recent Events" subtitle="Most recent event activity for debugging growth flows">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Dedupe key</TableHead>
                <TableHead>Metadata</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length ? (
                events.slice(0, 40).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{new Date(row.occurredAt).toLocaleString()}</TableCell>
                    <TableCell>{row.eventType}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{row.dedupeKey}</TableCell>
                    <TableCell className="max-w-[320px] truncate">{row.metadata ? JSON.stringify(row.metadata) : '-'}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">No events found yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </SectionCard>

        <div className="flex flex-wrap gap-2">
          <Link to="/settings">
            <Button variant="outline">Back to Settings</Button>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
