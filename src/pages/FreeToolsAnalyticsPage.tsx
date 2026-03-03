import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { freeToolPages } from '@/data/freeToolsContent';
import {
  CtaVariantId,
  CTA_VARIANTS,
  clearFreeToolsTracking,
  formatVariantLabel,
  FreeToolsCtaEvent,
  FreeToolsLeadCapture,
  getAssignedVariant,
  loadCtaEvents,
  loadLeadCaptures,
  maskEmail,
} from '@/lib/freeToolsConversion';
import {
  clearFreeToolsTrackingInSupabase,
  fetchFreeToolsTrackingFromSupabase,
  syncFreeToolsTrackingToSupabase,
} from '@/lib/api/freeToolsAnalytics';
import { useAuth } from '@/contexts/AuthContext';

interface VariantMetrics {
  impressions: number;
  clicks: number;
  leadEvents: number;
  captures: number;
}

interface ToolMetricsRow {
  slug: string;
  title: string;
  assignedVariant: CtaVariantId | null;
  impressions: number;
  clicks: number;
  leadEvents: number;
  captures: number;
  lastActivityTs: number | null;
  variants: Record<CtaVariantId, VariantMetrics>;
}

function pct(numerator: number, denominator: number): string {
  if (!denominator) return '0.0%';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function toDateLabel(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Date(timestamp).toLocaleString();
}

function variantWinner(row: ToolMetricsRow): string {
  const a = row.variants.a;
  const b = row.variants.b;
  if (a.impressions < 10 || b.impressions < 10) return 'Need more data';
  const aCtr = a.clicks / a.impressions;
  const bCtr = b.clicks / b.impressions;
  const diff = Math.abs(aCtr - bCtr);
  if (diff < 0.01) return 'Tie';
  return aCtr > bCtr ? 'A' : 'B';
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function createDefaultRow(slug: string, title: string): ToolMetricsRow {
  return {
    slug,
    title,
    assignedVariant: getAssignedVariant(slug),
    impressions: 0,
    clicks: 0,
    leadEvents: 0,
    captures: 0,
    lastActivityTs: null,
    variants: {
      a: { impressions: 0, clicks: 0, leadEvents: 0, captures: 0 },
      b: { impressions: 0, clicks: 0, leadEvents: 0, captures: 0 },
    },
  };
}

function buildAnalytics(events: FreeToolsCtaEvent[], captures: FreeToolsLeadCapture[]) {
  const bySlug = new Map<string, ToolMetricsRow>();

  for (const tool of freeToolPages) {
    bySlug.set(tool.slug, createDefaultRow(tool.slug, tool.title));
  }

  for (const event of events) {
    const row = bySlug.get(event.slug) || createDefaultRow(event.slug, event.slug);
    if (!bySlug.has(event.slug)) bySlug.set(event.slug, row);

    const eventTime = Date.parse(event.at);
    if (Number.isFinite(eventTime) && (!row.lastActivityTs || eventTime > row.lastActivityTs)) {
      row.lastActivityTs = eventTime;
    }

    if (event.type === 'impression') {
      row.impressions += 1;
      row.variants[event.variant].impressions += 1;
    } else if (event.type === 'primary_click') {
      row.clicks += 1;
      row.variants[event.variant].clicks += 1;
    } else if (event.type === 'lead_capture') {
      row.leadEvents += 1;
      row.variants[event.variant].leadEvents += 1;
    }
  }

  for (const capture of captures) {
    const row = bySlug.get(capture.slug) || createDefaultRow(capture.slug, capture.slug);
    if (!bySlug.has(capture.slug)) bySlug.set(capture.slug, row);

    row.captures += 1;
    row.variants[capture.variant].captures += 1;

    const captureTime = Date.parse(capture.capturedAt);
    if (Number.isFinite(captureTime) && (!row.lastActivityTs || captureTime > row.lastActivityTs)) {
      row.lastActivityTs = captureTime;
    }
  }

  const rows = [...bySlug.values()].sort((a, b) => {
    if (b.clicks !== a.clicks) return b.clicks - a.clicks;
    if (b.impressions !== a.impressions) return b.impressions - a.impressions;
    return a.title.localeCompare(b.title);
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.impressions += row.impressions;
      acc.clicks += row.clicks;
      acc.leadEvents += row.leadEvents;
      acc.captures += row.captures;
      return acc;
    },
    { impressions: 0, clicks: 0, leadEvents: 0, captures: 0 },
  );

  const variantSummary = CTA_VARIANTS.map((variant) => {
    const metrics = rows.reduce(
      (acc, row) => {
        acc.impressions += row.variants[variant.id].impressions;
        acc.clicks += row.variants[variant.id].clicks;
        acc.leadEvents += row.variants[variant.id].leadEvents;
        acc.captures += row.variants[variant.id].captures;
        return acc;
      },
      { impressions: 0, clicks: 0, leadEvents: 0, captures: 0 },
    );
    return { variant, ...metrics };
  });

  const recentCaptures = [...captures]
    .sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt))
    .slice(0, 12)
    .map((entry) => ({
      ...entry,
      title: bySlug.get(entry.slug)?.title || entry.slug,
    }));

  const toolsWithTraffic = rows.filter((row) => row.impressions > 0 || row.clicks > 0 || row.captures > 0).length;

  return {
    rows,
    totals,
    toolsWithTraffic,
    variantSummary,
    recentCaptures,
    eventsCount: events.length,
    capturesCount: captures.length,
  };
}

export default function FreeToolsAnalyticsPage() {
  const { toast } = useToast();
  const { user, isDemoUser } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [cloudEvents, setCloudEvents] = useState<FreeToolsCtaEvent[]>([]);
  const [cloudCaptures, setCloudCaptures] = useState<FreeToolsLeadCapture[]>([]);
  const [source, setSource] = useState<'local' | 'cloud'>('local');
  const [cloudBusy, setCloudBusy] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);

  const localEvents = useMemo(() => loadCtaEvents(), [refreshKey]);
  const localCaptures = useMemo(() => loadLeadCaptures(), [refreshKey]);

  const canUseCloud = Boolean(user?.id && !isDemoUser);

  const syncCloud = async (showToast = false) => {
    if (!user?.id || isDemoUser) {
      setSource('local');
      return;
    }

    setCloudBusy(true);
    setCloudError(null);
    try {
      await syncFreeToolsTrackingToSupabase(user.id, localEvents, localCaptures);
      const cloud = await fetchFreeToolsTrackingFromSupabase(user.id);
      setCloudEvents(cloud.events);
      setCloudCaptures(cloud.captures);
      setSource('cloud');
      const now = new Date().toISOString();
      setLastSyncedAt(now);
      if (showToast) {
        toast({
          title: 'Cloud sync complete',
          description: `Loaded ${cloud.events.length} events and ${cloud.captures.length} captures.`,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not sync cloud analytics.';
      setCloudError(message);
      setSource('local');
      if (showToast) {
        toast({
          title: 'Cloud sync failed',
          description: message,
          variant: 'destructive',
        });
      }
    } finally {
      setCloudBusy(false);
    }
  };

  useEffect(() => {
    void syncCloud(false);
  }, [refreshKey, user?.id, isDemoUser]);

  const refresh = () => setRefreshKey((prev) => prev + 1);

  const eventsForMetrics = source === 'cloud' ? cloudEvents : localEvents;
  const capturesForMetrics = source === 'cloud' ? cloudCaptures : localCaptures;

  const analytics = useMemo(
    () => buildAnalytics(eventsForMetrics, capturesForMetrics),
    [eventsForMetrics, capturesForMetrics],
  );

  const exportCsv = () => {
    const header = [
      'slug',
      'title',
      'assigned_variant',
      'impressions',
      'clicks',
      'lead_events',
      'captured_emails',
      'ctr',
      'lead_capture_rate_from_click',
      'variant_a_ctr',
      'variant_b_ctr',
      'winner',
      'source',
    ];

    const lines = analytics.rows.map((row) => [
      row.slug,
      row.title,
      formatVariantLabel(row.assignedVariant),
      String(row.impressions),
      String(row.clicks),
      String(row.leadEvents),
      String(row.captures),
      pct(row.clicks, row.impressions),
      pct(row.captures, row.clicks),
      pct(row.variants.a.clicks, row.variants.a.impressions),
      pct(row.variants.b.clicks, row.variants.b.impressions),
      variantWinner(row),
      source,
    ]);

    const csv = [header, ...lines].map((row) => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `free-tools-conversion-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: 'CSV exported', description: 'Free tools conversion report downloaded.' });
  };

  const clearData = async () => {
    const cloudText = canUseCloud ? ' and in your cloud workspace' : '';
    const confirmed = window.confirm(`Clear all free-tools conversion tracking data on this device${cloudText}?`);
    if (!confirmed) return;

    try {
      clearFreeToolsTracking(freeToolPages.map((tool) => tool.slug));
      if (canUseCloud && user?.id) {
        await clearFreeToolsTrackingInSupabase(user.id);
        setCloudEvents([]);
        setCloudCaptures([]);
      }
      setCloudError(null);
      refresh();
      toast({ title: 'Tracking data cleared' });
    } catch (error) {
      toast({
        title: 'Could not clear cloud data',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Free Tools Conversion Dashboard"
        subtitle="A/B and lead-capture metrics from your free-tools pages"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={refresh}>Refresh</Button>
            {canUseCloud ? (
              <Button variant="outline" onClick={() => void syncCloud(true)} disabled={cloudBusy}>
                {cloudBusy ? 'Syncing...' : 'Sync Cloud'}
              </Button>
            ) : null}
            <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
            <Button variant="destructive" onClick={() => void clearData()}>Clear Data</Button>
          </div>
        }
      />

      <div className="space-y-6">
        <SectionCard title="Data Source" subtitle="Current analytics backend for this dashboard">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={source === 'cloud' ? 'default' : 'outline'}>
              {source === 'cloud' ? 'Cloud + Cross-device' : 'Local only'}
            </Badge>
            {canUseCloud ? <Badge variant="outline">Authenticated mode</Badge> : <Badge variant="outline">Demo/local mode</Badge>}
            {lastSyncedAt ? <Badge variant="outline">Last sync: {toDateLabel(lastSyncedAt)}</Badge> : null}
          </div>
          {cloudError ? (
            <p className="mt-3 text-sm text-destructive">Cloud sync error: {cloudError}</p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {source === 'cloud'
                ? 'Events are synced to Supabase and visible across signed-in devices.'
                : 'Showing local device analytics only.'}
            </p>
          )}
        </SectionCard>

        <SectionCard title="Performance Snapshot" subtitle="Top-level metrics across all free tools">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Tools with traffic</p>
              <p className="mt-1 text-2xl font-semibold">{analytics.toolsWithTraffic}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Impressions</p>
              <p className="mt-1 text-2xl font-semibold">{analytics.totals.impressions}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Clicks</p>
              <p className="mt-1 text-2xl font-semibold">{analytics.totals.clicks}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">CTR</p>
              <p className="mt-1 text-2xl font-semibold">{pct(analytics.totals.clicks, analytics.totals.impressions)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Lead captures</p>
              <p className="mt-1 text-2xl font-semibold">{analytics.totals.captures}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Lead CVR</p>
              <p className="mt-1 text-2xl font-semibold">{pct(analytics.totals.captures, analytics.totals.clicks)}</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Raw event rows: {analytics.eventsCount}. Raw lead captures: {analytics.capturesCount}. Source: {source}.
          </p>
        </SectionCard>

        <SectionCard title="Variant Performance" subtitle="Compare CTA A vs B globally">
          <div className="grid gap-3 md:grid-cols-2">
            {analytics.variantSummary.map((variantMetrics) => (
              <div key={variantMetrics.variant.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Variant {variantMetrics.variant.id.toUpperCase()}</p>
                  <Badge variant="outline">{variantMetrics.variant.label}</Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{variantMetrics.variant.subcopy}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Impressions</p>
                    <p className="font-semibold">{variantMetrics.impressions}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Clicks</p>
                    <p className="font-semibold">{variantMetrics.clicks}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">CTR</p>
                    <p className="font-semibold">{pct(variantMetrics.clicks, variantMetrics.impressions)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Lead captures</p>
                    <p className="font-semibold">{variantMetrics.captures}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Per-Tool Conversion" subtitle="Impressions, CTR, and lead rates by free tool">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tool</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Impr</TableHead>
                <TableHead>Clicks</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>CTR</TableHead>
                <TableHead>Lead CVR</TableHead>
                <TableHead>A CTR</TableHead>
                <TableHead>B CTR</TableHead>
                <TableHead>Winner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.rows.map((row) => (
                <TableRow key={row.slug}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{row.title}</p>
                      <p className="text-xs text-muted-foreground">/free-tools/{row.slug}</p>
                      {row.lastActivityTs ? (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last activity: {new Date(row.lastActivityTs).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{formatVariantLabel(row.assignedVariant)}</TableCell>
                  <TableCell>{row.impressions}</TableCell>
                  <TableCell>{row.clicks}</TableCell>
                  <TableCell>{row.captures}</TableCell>
                  <TableCell>{pct(row.clicks, row.impressions)}</TableCell>
                  <TableCell>{pct(row.captures, row.clicks)}</TableCell>
                  <TableCell>{pct(row.variants.a.clicks, row.variants.a.impressions)}</TableCell>
                  <TableCell>{pct(row.variants.b.clicks, row.variants.b.impressions)}</TableCell>
                  <TableCell>{variantWinner(row)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>

        <SectionCard title="Recent Lead Captures" subtitle="Most recent starter-kit capture activity">
          {analytics.recentCaptures.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Tool</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Variant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.recentCaptures.map((capture) => (
                  <TableRow key={`${capture.slug}-${capture.email}-${capture.capturedAt}`}>
                    <TableCell>{toDateLabel(capture.capturedAt)}</TableCell>
                    <TableCell>{capture.title}</TableCell>
                    <TableCell>{maskEmail(capture.email)}</TableCell>
                    <TableCell>{capture.variant.toUpperCase()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No captured leads yet.</p>
          )}
        </SectionCard>

        <div className="flex flex-wrap gap-2">
          <Link to="/free-tools">
            <Button variant="outline">Back to Free Tools</Button>
          </Link>
          <Link to="/settings">
            <Button variant="outline">Back to Settings</Button>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
