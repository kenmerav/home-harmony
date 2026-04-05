import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  APPLE_FEED_LAYERS,
  AppleCalendarFeedUrls,
  AppleFeedLayer,
  loadAppleCalendarFeedUrls,
  regenerateAppleCalendarFeedToken,
} from '@/lib/api/appleCalendar';
import { CheckCircle2, Copy, ExternalLink, RefreshCw } from 'lucide-react';

type CalendarPlatform = 'apple' | 'google';

const GOOGLE_CALENDAR_APP_URL = 'https://calendar.google.com/calendar/u/0/r';
const GOOGLE_CALENDAR_ADD_BY_URL = 'https://calendar.google.com/calendar/u/0/r/settings/addbyurl';

const layerLabel: Record<AppleFeedLayer, string> = {
  all: 'All events',
  family: 'Family',
  meals: 'Meals',
  kids: 'Kids',
  chores: 'Chores',
  deliveries: 'Deliveries',
  manual: 'Manual',
  tasks: 'Tasks',
  workouts: 'Workouts',
  reminders: 'Reminders',
};

function parsePlatform(value: string | null): CalendarPlatform {
  return value === 'google' ? 'google' : 'apple';
}

function isClipboardAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.clipboard?.writeText;
}

export default function AppleCalendarConnectPage() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [platform, setPlatform] = useState<CalendarPlatform>(() => parsePlatform(searchParams.get('platform')));
  const [state, setState] = useState<AppleCalendarFeedUrls | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    setPlatform(parsePlatform(searchParams.get('platform')));
  }, [searchParams]);

  const loadUrls = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadAppleCalendarFeedUrls();
      setState(next);
    } catch (error) {
      toast({
        title: 'Could not load calendar feeds',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadUrls();
  }, [loadUrls]);

  const feedRows = useMemo(
    () =>
      APPLE_FEED_LAYERS
        .filter((layer) => layer !== 'chores')
        .map((layer) => ({ layer, label: layerLabel[layer], url: state?.feeds[layer] || '' })),
    [state],
  );

  const copyText = async (value: string, label: string) => {
    if (!value) return;
    if (!isClipboardAvailable()) {
      toast({ title: 'Clipboard unavailable', description: 'Copy manually from the URL field.' });
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: 'Copied', description: `${label} URL copied.` });
    } catch {
      toast({ title: 'Could not copy', description: 'Try selecting and copying manually.', variant: 'destructive' });
    }
  };

  const regenerate = async () => {
    const proceed = window.confirm(
      'Regenerate private feed links? Existing Apple/Google subscriptions will stop updating until you subscribe again.',
    );
    if (!proceed) return;

    setRegenerating(true);
    try {
      const next = await regenerateAppleCalendarFeedToken();
      setState(next);
      toast({
        title: 'Feed links regenerated',
        description: 'Old links are revoked. Re-subscribe in Apple or Google Calendar with the new URLs.',
      });
    } catch (error) {
      toast({
        title: 'Could not regenerate links',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <AppLayout currentPath="/calendar">
      <PageHeader
        title="Connect Apple or Google Calendar"
        subtitle="Plan in Home Harmony, then see your schedule in Apple Calendar or Google Calendar. Edit events in Home Harmony."
        action={
          <Button variant="outline" onClick={regenerate} disabled={loading || regenerating}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {regenerating ? 'Regenerating...' : 'Regenerate private links'}
          </Button>
        }
      />

      <div className="space-y-6">
        <SectionCard title="Step 1: Copy your private feed URL" subtitle="Use All events first. Layer feeds are optional.">
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
            These links are private. Anyone with a link can view that feed. If shared accidentally, regenerate links.
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant={platform === 'apple' ? 'default' : 'outline'}
              onClick={() => setPlatform('apple')}
            >
              Apple setup
            </Button>
            <Button
              type="button"
              variant={platform === 'google' ? 'default' : 'outline'}
              onClick={() => setPlatform('google')}
            >
              Google setup
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading feed URLs...</p>
            ) : (
              feedRows.map((feed) => (
                <div key={feed.layer} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{feed.label}</p>
                      {feed.layer === 'all' && <Badge variant="outline">Recommended</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => void copyText(feed.url, feed.label)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={feed.url} target="_blank" rel="noreferrer">
                          Open
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                  <Input value={feed.url} readOnly className="text-xs" aria-label={`${feed.label} feed URL`} />
                </div>
              ))
            )}
          </div>
        </SectionCard>

        {platform === 'apple' ? (
          <>
            <SectionCard title="Step 2: Subscribe in Apple Calendar (iPhone/iPad)">
              <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
                <li>Open iPhone Settings.</li>
                <li>Go to Calendar &gt; Accounts &gt; Add Account &gt; Other.</li>
                <li>Tap Add Subscribed Calendar.</li>
                <li>Paste your Home Harmony URL, tap Next, then Save.</li>
              </ol>
            </SectionCard>

            <SectionCard title="Step 2 (Mac): Subscribe in Apple Calendar">
              <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
                <li>Open Calendar on Mac.</li>
                <li>Click File &gt; New Calendar Subscription.</li>
                <li>Paste your Home Harmony URL, then click Subscribe.</li>
                <li>Choose refresh settings and save.</li>
              </ol>
            </SectionCard>
          </>
        ) : (
          <SectionCard title="Step 2: Subscribe in Google Calendar">
            <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
              <li>Open Google Calendar on web (desktop browser).</li>
              <li>In the left sidebar, next to Other calendars, click +.</li>
              <li>Choose From URL.</li>
              <li>Paste your Home Harmony URL and click Add calendar.</li>
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={GOOGLE_CALENDAR_ADD_BY_URL} target="_blank" rel="noreferrer">
                  Open Google Add by URL
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href={GOOGLE_CALENDAR_APP_URL} target="_blank" rel="noreferrer">
                  Open Google Calendar
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Google currently requires web to add URL subscriptions. After subscription, events appear in mobile apps too.
            </p>
          </SectionCard>
        )}

        <SectionCard title="Step 3: Verify and maintain">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
              Edit events in Home Harmony. Apple/Google subscriptions update from your feed automatically.
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
              Refresh timing is controlled by Apple/Google. Home Harmony feed updates immediately.
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
              If links leak, regenerate private links here and re-subscribe.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/calendar/planner">Back to Calendar Planner</Link>
            </Button>
          </div>
        </SectionCard>
      </div>
    </AppLayout>
  );
}
