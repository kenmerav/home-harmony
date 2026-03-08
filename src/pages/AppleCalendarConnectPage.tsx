import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { Copy, ExternalLink, RefreshCw } from 'lucide-react';

const layerLabel: Record<AppleFeedLayer, string> = {
  all: 'All events',
  family: 'Family',
  meals: 'Meals',
  kids: 'Kids',
  chores: 'Chores',
  deliveries: 'Deliveries & reminders',
};

function isClipboardAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.clipboard?.writeText;
}

export default function AppleCalendarConnectPage() {
  const { toast } = useToast();
  const [state, setState] = useState<AppleCalendarFeedUrls | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const loadUrls = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadAppleCalendarFeedUrls();
      setState(next);
    } catch (error) {
      toast({
        title: 'Could not load Apple Calendar feeds',
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
    () => APPLE_FEED_LAYERS.map((layer) => ({ layer, label: layerLabel[layer], url: state?.feeds[layer] || '' })),
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
      'Regenerate private feed links? Existing Apple subscriptions will stop updating until you subscribe again.',
    );
    if (!proceed) return;

    setRegenerating(true);
    try {
      const next = await regenerateAppleCalendarFeedToken();
      setState(next);
      toast({
        title: 'Feed token regenerated',
        description: 'Old links are now revoked. Re-subscribe in Apple Calendar with the new URLs.',
      });
    } catch (error) {
      toast({
        title: 'Could not regenerate feed token',
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
        title="Connect Apple Calendar"
        subtitle="Plan in Home Harmony, see it in Apple Calendar. Edit events in Home Harmony and Apple Calendar will reflect them."
        action={
          <Button variant="outline" onClick={regenerate} disabled={loading || regenerating}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {regenerating ? 'Regenerating...' : 'Regenerate links'}
          </Button>
        }
      />

      <div className="space-y-6">
        <SectionCard
          title="Private subscribed calendar feeds"
          subtitle="One-way sync only. Apple Calendar is read-only in this v1."
        >
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
            Share these links only with people who should see your schedule. If links are exposed, regenerate them.
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
                        <Copy className="mr-2 h-4 w-4" />Copy
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={feed.url} target="_blank" rel="noreferrer">
                          Open<ExternalLink className="ml-2 h-4 w-4" />
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

        <SectionCard title="How to subscribe on iPhone / iPad" subtitle="Apple controls refresh timing after subscription.">
          <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
            <li>Open Settings.</li>
            <li>Go to Calendar &gt; Accounts &gt; Add Account &gt; Other.</li>
            <li>Tap Add Subscribed Calendar.</li>
            <li>Paste the Home Harmony feed URL and tap Next.</li>
            <li>Save. Your Home Harmony events will appear in Apple Calendar.</li>
          </ol>
        </SectionCard>

        <SectionCard title="How to subscribe on Mac" subtitle="Use your private feed URL from above.">
          <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
            <li>Open Calendar on Mac.</li>
            <li>In the menu bar, click File &gt; New Calendar Subscription.</li>
            <li>Paste your Home Harmony feed URL and click Subscribe.</li>
            <li>Choose refresh preferences and save.</li>
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            Need to manage filters first? Go to <Link className="underline" to="/calendar/planner">Calendar Planner</Link> and set your event layers.
          </p>
        </SectionCard>
      </div>
    </AppLayout>
  );
}
