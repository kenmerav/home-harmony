import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  deleteAdminUser,
  fetchAdminMetrics,
  type AdminMetricsResponse,
  updateAdminFeedbackStatus,
} from '@/lib/api/admin';
import { sendLifecyclePreviewEmail } from '@/lib/api/emails';
import { useAuth } from '@/contexts/AuthContext';

function numberFmt(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function usdFmt(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: value < 1 ? 3 : 2,
    maximumFractionDigits: value < 1 ? 3 : 2,
  }).format(value);
}

function percentFmt(part: number, whole: number): string {
  if (whole <= 0) return '0%';
  return `${Math.round((part / whole) * 100)}%`;
}

function dateTimeFmt(value: string | null): string {
  if (!value) return '-';
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return value;
  return new Date(ts).toLocaleString();
}

function safeRatio(numerator: number, denominator: number): string {
  if (denominator <= 0) return '0.0';
  return (numerator / denominator).toFixed(1);
}

function csvEscape(value: string | null | undefined): string {
  const normalized = value ?? '';
  return `"${normalized.replace(/"/g, '""')}"`;
}

function feedbackKindLabel(kind: 'feature_request' | 'bug_report' | 'general_feedback'): string {
  if (kind === 'feature_request') return 'Feature Request';
  if (kind === 'bug_report') return 'Bug Report';
  return 'General Feedback';
}

function feedbackStatusLabel(
  kind: 'feature_request' | 'bug_report' | 'general_feedback',
  status: string,
): string {
  if (status === 'new') return 'New';
  if (status === 'reviewed') return 'Reviewed';
  if (status === 'resolved') {
    return kind === 'feature_request' ? 'Completed' : 'Resolved';
  }
  return status;
}

const EMAIL_TEMPLATE_OPTIONS = [
  {
    value: 'welcome',
    label: 'Welcome',
    description: 'The main first email that gets a new user to one useful week quickly.',
  },
  {
    value: 'plan_meals',
    label: 'Plan Meals',
    description: 'Pushes users toward adding real recipes and building their first useful meal week.',
  },
  {
    value: 'review_grocery',
    label: 'Review Grocery',
    description: 'Focuses on using the grocery list well once meals are in place.',
  },
  {
    value: 'invite_household',
    label: 'Invite Household',
    description: 'Encourages adding a spouse or family so the household actually runs in one place.',
  },
  {
    value: 'set_reminders',
    label: 'Set Reminders',
    description: 'Helps users set texts and reminder routing without making the app noisy.',
  },
  {
    value: 'calendar_setup',
    label: 'Calendar Setup',
    description: 'Shows how to make the calendar useful without turning it into clutter.',
  },
  {
    value: 'power_up',
    label: 'Power Up',
    description: 'Week-two style upgrades like recurring meals, staples, and optional advanced features.',
  },
] as const;

type EmailTemplateOption = typeof EMAIL_TEMPLATE_OPTIONS[number]['value'];

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<AdminMetricsResponse | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<AdminMetricsResponse['recentUsers'][number] | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [welcomePreviewEmail, setWelcomePreviewEmail] = useState('kroberts035@gmail.com');
  const [welcomePreviewName, setWelcomePreviewName] = useState('Ken');
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplateOption>('welcome');
  const [sendingWelcomePreview, setSendingWelcomePreview] = useState(false);
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [feedbackKindFilter, setFeedbackKindFilter] = useState<'all' | 'feature_request' | 'bug_report' | 'general_feedback'>('all');
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState<'all' | 'new' | 'reviewed' | 'resolved'>('all');
  const [updatingFeedbackId, setUpdatingFeedbackId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErrorText(null);
    try {
      const data = await fetchAdminMetrics();
      setMetrics(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load admin metrics.';
      setErrorText(message);
      setMetrics(null);
      toast({
        title: 'Admin metrics unavailable',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const subscriptionRows = useMemo(
    () =>
      Object.entries(metrics?.subscriptionsByStatus || {})
        .sort((a, b) => b[1] - a[1])
        .map(([status, count]) => ({ status, count })),
    [metrics?.subscriptionsByStatus],
  );

  const moduleRows = useMemo(
    () =>
      Object.entries(metrics?.moduleUsage30d || {})
        .sort((a, b) => b[1] - a[1])
        .map(([module, count]) => ({ module, count })),
    [metrics?.moduleUsage30d],
  );

  const topEventsWithShare = useMemo(() => {
    const rows = metrics?.topGrowthEvents30d || [];
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    return rows.map((row) => ({
      ...row,
      share: total > 0 ? Math.round((row.count / total) * 100) : 0,
    }));
  }, [metrics?.topGrowthEvents30d]);

  const filteredFeedback = useMemo(() => {
    const rows = metrics?.recentFeedback || [];
    const search = feedbackSearch.trim().toLowerCase();
    return rows.filter((row) => {
      if (feedbackKindFilter !== 'all' && row.kind !== feedbackKindFilter) return false;
      if (feedbackStatusFilter !== 'all' && row.status !== feedbackStatusFilter) return false;
      if (!search) return true;

      const haystack = [
        row.subject,
        row.details,
        row.email,
        row.userName,
        row.pagePath,
        row.pageTitle,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [feedbackKindFilter, feedbackSearch, feedbackStatusFilter, metrics?.recentFeedback]);

  const derived = useMemo(() => {
    if (!metrics) return null;
    const { summary, totals } = metrics;
    return {
      verificationRate: percentFmt(summary.verifiedUsers, summary.totalUsers),
      onboardingRate: percentFmt(totals.onboardingCompleted, summary.totalUsers),
      weeklyActiveRate: percentFmt(summary.activeUsers7d, summary.totalUsers),
      monthlyActiveRate: percentFmt(summary.activeUsers30d, summary.totalUsers),
      growthEventsPerMau: safeRatio(summary.growthEvents30d, summary.activeUsers30d),
      recipesPerHousehold: safeRatio(totals.recipes, totals.households),
      plannedMealsPerHousehold: safeRatio(totals.plannedMeals, totals.households),
      referralPerUserRate: percentFmt(totals.referralEvents, summary.totalUsers),
    };
  }, [metrics]);

  const flags = useMemo(() => {
    if (!metrics || !derived) return [];
    const list: Array<{ label: string; detail: string; tone: 'neutral' | 'warning' }> = [];
    if (metrics.summary.totalUsers > 0 && metrics.summary.activeUsers7d === 0) {
      list.push({
        label: 'No weekly activity',
        detail: '0 active users in the last 7 days.',
        tone: 'warning',
      });
    }
    if (Number.parseInt(derived.onboardingRate, 10) < 60) {
      list.push({
        label: 'Onboarding conversion is low',
        detail: `Only ${derived.onboardingRate} of users have completed onboarding.`,
        tone: 'warning',
      });
    }
    if (!list.length) {
      list.push({
        label: 'No major alerts',
        detail: 'Core acquisition and engagement metrics are collecting normally.',
        tone: 'neutral',
      });
    }
    return list;
  }, [derived, metrics]);

  const handleDeleteUser = useCallback(async () => {
    if (!pendingDeleteUser) return;

    setDeletingUserId(pendingDeleteUser.id);
    try {
      await deleteAdminUser(pendingDeleteUser.id);
      toast({
        title: 'Account deleted',
        description: pendingDeleteUser.email
          ? `${pendingDeleteUser.email} was deleted.`
          : 'The selected account was deleted.',
      });
      setPendingDeleteUser(null);
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not delete account.';
      toast({
        title: 'Delete failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setDeletingUserId(null);
    }
  }, [pendingDeleteUser, refresh, toast]);

  const handleSendWelcomePreview = useCallback(async () => {
    const email = welcomePreviewEmail.trim().toLowerCase();
    const userName = welcomePreviewName.trim();
    if (!email) {
      toast({
        title: 'Email required',
        description: 'Enter the email address that should receive the welcome email.',
        variant: 'destructive',
      });
      return;
    }

    setSendingWelcomePreview(true);
    try {
      await sendLifecyclePreviewEmail({
        email,
        userName: userName || 'Home Harmony User',
        templateKey: emailTemplate,
        appUrl: window.location.origin,
      });
      toast({
        title: 'Test email sent',
        description: `Sent the ${EMAIL_TEMPLATE_OPTIONS.find((option) => option.value === emailTemplate)?.label || 'selected'} email to ${email}.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not send the welcome email.';
      toast({
        title: 'Email send failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSendingWelcomePreview(false);
    }
  }, [emailTemplate, toast, welcomePreviewEmail, welcomePreviewName]);

  const handleCopyFeedback = useCallback(async () => {
    if (!filteredFeedback.length) {
      toast({
        title: 'Nothing to copy',
        description: 'There are no feedback items in the current filter.',
        variant: 'destructive',
      });
      return;
    }

    const text = filteredFeedback
      .map((row, index) => [
        `${index + 1}. ${feedbackKindLabel(row.kind)} | ${row.subject?.trim() || '(No subject)'}`,
        `Submitted: ${dateTimeFmt(row.createdAt)}`,
        `From: ${row.email || '(no email)'}${row.userName ? ` (${row.userName})` : ''}`,
        `Page: ${row.pagePath}${row.pageTitle ? ` | ${row.pageTitle}` : ''}`,
        `Status: ${row.status}`,
        `Details: ${row.details}`,
      ].join('\n'))
      .join('\n\n---\n\n');

    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Feedback copied',
        description: `Copied ${filteredFeedback.length} item${filteredFeedback.length === 1 ? '' : 's'} for review.`,
      });
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: error instanceof Error ? error.message : 'Could not copy feedback.',
        variant: 'destructive',
      });
    }
  }, [filteredFeedback, toast]);

  const handleDownloadFeedbackCsv = useCallback(() => {
    if (!filteredFeedback.length) {
      toast({
        title: 'Nothing to export',
        description: 'There are no feedback items in the current filter.',
        variant: 'destructive',
      });
      return;
    }

    const header = [
      'created_at',
      'kind',
      'status',
      'email',
      'user_name',
      'page_path',
      'page_title',
      'subject',
      'details',
    ].join(',');

    const rows = filteredFeedback.map((row) => [
      csvEscape(row.createdAt),
      csvEscape(row.kind),
      csvEscape(row.status),
      csvEscape(row.email),
      csvEscape(row.userName),
      csvEscape(row.pagePath),
      csvEscape(row.pageTitle),
      csvEscape(row.subject),
      csvEscape(row.details),
    ].join(','));

    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `home-harmony-feedback-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: 'CSV downloaded',
      description: `Exported ${filteredFeedback.length} feedback item${filteredFeedback.length === 1 ? '' : 's'}.`,
    });
  }, [filteredFeedback, toast]);

  const handleMarkFeedbackCompleted = useCallback(async (feedbackId: string) => {
    setUpdatingFeedbackId(feedbackId);
    try {
      await updateAdminFeedbackStatus(feedbackId, 'resolved');
      setMetrics((current) => {
        if (!current) return current;
        return {
          ...current,
          recentFeedback: current.recentFeedback.map((row) =>
            row.id === feedbackId ? { ...row, status: 'resolved' } : row,
          ),
        };
      });
      toast({
        title: 'Feature marked completed',
        description: 'The feedback item is now marked as completed.',
      });
    } catch (error) {
      toast({
        title: 'Could not update feedback',
        description: error instanceof Error ? error.message : 'Could not update feedback status.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingFeedbackId(null);
    }
  }, [toast]);

  return (
    <AppLayout contentWidthClassName="max-w-7xl">
      <PageHeader
        title="Admin Dashboard"
        subtitle="Acquisition, activation, and product usage for your account base"
        action={
          <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        }
      />

      {errorText ? (
        <SectionCard title="Access" subtitle="Admin access is required for global metrics">
          <p className="text-sm text-muted-foreground">{errorText}</p>
        </SectionCard>
      ) : null}

      {!metrics && loading ? (
        <SectionCard title="Loading">
          <p className="text-sm text-muted-foreground">Loading admin metrics...</p>
        </SectionCard>
      ) : null}

      {metrics && derived ? (
        <div className="space-y-6">
          <SectionCard title="Snapshot" subtitle={`Generated ${dateTimeFmt(metrics.generatedAt)}`}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Total users</p>
                <p className="mt-1 text-2xl font-semibold">{numberFmt(metrics.summary.totalUsers)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Verified users</p>
                <p className="mt-1 text-2xl font-semibold">{numberFmt(metrics.summary.verifiedUsers)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">New users (7d)</p>
                <p className="mt-1 text-2xl font-semibold">{numberFmt(metrics.summary.newUsers7d)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">New users (30d)</p>
                <p className="mt-1 text-2xl font-semibold">{numberFmt(metrics.summary.newUsers30d)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Active users (7d)</p>
                <p className="mt-1 text-2xl font-semibold">{numberFmt(metrics.summary.activeUsers7d)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Active users (30d)</p>
                <p className="mt-1 text-2xl font-semibold">{numberFmt(metrics.summary.activeUsers30d)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Growth events (7d)</p>
                <p className="mt-1 text-2xl font-semibold">{numberFmt(metrics.summary.growthEvents7d)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Growth events (30d)</p>
                <p className="mt-1 text-2xl font-semibold">{numberFmt(metrics.summary.growthEvents30d)}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Core Ratios" subtitle="Conversion and quality health">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Verification rate</p>
                <p className="mt-1 text-xl font-semibold">{derived.verificationRate}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Onboarding completion</p>
                <p className="mt-1 text-xl font-semibold">{derived.onboardingRate}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Weekly active rate</p>
                <p className="mt-1 text-xl font-semibold">{derived.weeklyActiveRate}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Monthly active rate</p>
                <p className="mt-1 text-xl font-semibold">{derived.monthlyActiveRate}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Growth events per MAU</p>
                <p className="mt-1 text-xl font-semibold">{derived.growthEventsPerMau}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Referral events per user</p>
                <p className="mt-1 text-xl font-semibold">{derived.referralPerUserRate}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Product Utilization" subtitle="How much data users are creating">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Profiles</p>
                <p className="mt-1 text-xl font-semibold">{numberFmt(metrics.totals.profiles)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Households</p>
                <p className="mt-1 text-xl font-semibold">{numberFmt(metrics.totals.households)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Recipes</p>
                <p className="mt-1 text-xl font-semibold">{numberFmt(metrics.totals.recipes)}</p>
                <p className="text-xs text-muted-foreground">{derived.recipesPerHousehold} per household</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Planned meals</p>
                <p className="mt-1 text-xl font-semibold">{numberFmt(metrics.totals.plannedMeals)}</p>
                <p className="text-xs text-muted-foreground">{derived.plannedMealsPerHousehold} per household</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Referral events</p>
                <p className="mt-1 text-xl font-semibold">{numberFmt(metrics.totals.referralEvents)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Growth events (all time)</p>
                <p className="mt-1 text-xl font-semibold">{numberFmt(metrics.totals.growthEventsAllTime)}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Estimated Cost (30d)" subtitle="SMS is estimated from actual sends; AI and email are metered from live provider calls">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Total estimated cost</p>
                <p className="mt-1 text-2xl font-semibold">{usdFmt(metrics.costSummary30d.estimatedCost30d)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">SMS estimated cost</p>
                <p className="mt-1 text-2xl font-semibold">{usdFmt(metrics.costSummary30d.smsEstimatedCost30d)}</p>
                <p className="text-xs text-muted-foreground">{numberFmt(metrics.costSummary30d.smsMessagesSent30d)} outbound sends</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">AI estimated cost</p>
                <p className="mt-1 text-2xl font-semibold">{usdFmt(metrics.costSummary30d.aiEstimatedCost30d)}</p>
                <p className="text-xs text-muted-foreground">{numberFmt(metrics.costSummary30d.aiCalls30d)} AI calls</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Email estimated cost</p>
                <p className="mt-1 text-2xl font-semibold">{usdFmt(metrics.costSummary30d.emailEstimatedCost30d)}</p>
                <p className="text-xs text-muted-foreground">{numberFmt(metrics.costSummary30d.emailSends30d)} emails sent</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Inbound texts</p>
                <p className="mt-1 text-2xl font-semibold">{numberFmt(metrics.costSummary30d.inboundTexts30d)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Metered users</p>
                <p className="mt-1 text-2xl font-semibold">{numberFmt(metrics.costSummary30d.activeMeteredUsers30d)}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              This is an operational estimate, not a billing ledger. Outbound SMS is approximated from actual send logs, while AI and email are tracked from live app calls after the metering deploy.
            </p>
          </SectionCard>

          <SectionCard title="Highest-Cost Users (30d)" subtitle="Households generating the most estimated variable cost right now">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">SMS</TableHead>
                  <TableHead className="text-right">AI</TableHead>
                  <TableHead className="text-right">Email</TableHead>
                  <TableHead className="text-right">SMS sends</TableHead>
                  <TableHead className="text-right">AI calls</TableHead>
                  <TableHead className="text-right">Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.topCostUsers30d.length ? (
                  metrics.topCostUsers30d.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.email || '(no email)'}</TableCell>
                      <TableCell className="text-right">{usdFmt(row.totalEstimatedCost30d)}</TableCell>
                      <TableCell className="text-right">{usdFmt(row.smsEstimatedCost30d)}</TableCell>
                      <TableCell className="text-right">{usdFmt(row.aiEstimatedCost30d)}</TableCell>
                      <TableCell className="text-right">{usdFmt(row.emailEstimatedCost30d)}</TableCell>
                      <TableCell className="text-right">{numberFmt(row.smsMessagesSent30d)}</TableCell>
                      <TableCell className="text-right">{numberFmt(row.aiCalls30d)}</TableCell>
                      <TableCell className="text-right">{dateTimeFmt(row.lastSeenAt)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-sm text-muted-foreground">
                      No cost telemetry yet. Once the updated functions are deployed and used, this table will fill in.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </SectionCard>

          <SectionCard title="Signals" subtitle="Automatic checks to catch issues quickly">
            <div className="space-y-2">
              {flags.map((flag) => (
                <div key={flag.label} className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={flag.tone === 'warning' ? 'destructive' : 'outline'}>{flag.label}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{flag.detail}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Test Emails" subtitle="Send the live onboarding email templates to yourself before using them with new users">
            <div className="grid gap-3 md:grid-cols-[minmax(220px,0.9fr)_minmax(0,1.1fr)_minmax(220px,0.7fr)_auto]">
              <div className="space-y-2">
                <p className="text-sm font-medium">Template</p>
                <Select value={emailTemplate} onValueChange={(value) => setEmailTemplate(value as EmailTemplateOption)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMAIL_TEMPLATE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Recipient email</p>
                <Input
                  type="email"
                  value={welcomePreviewEmail}
                  onChange={(event) => setWelcomePreviewEmail(event.target.value)}
                  placeholder="name@example.com"
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">First name</p>
                <Input
                  value={welcomePreviewName}
                  onChange={(event) => setWelcomePreviewName(event.target.value)}
                  placeholder="Ken"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={() => void handleSendWelcomePreview()} disabled={sendingWelcomePreview}>
                  {sendingWelcomePreview ? 'Sending...' : 'Send Test Email'}
                </Button>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {EMAIL_TEMPLATE_OPTIONS.find((option) => option.value === emailTemplate)?.description}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              This sends the live email template using the current production app URL so you can review it in a real inbox.
            </p>
          </SectionCard>

          <SectionCard title="Feedback Inbox" subtitle="Latest feature requests and bug reports from inside the app">
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_220px_180px_auto_auto]">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Search</p>
                  <Input
                    value={feedbackSearch}
                    onChange={(event) => setFeedbackSearch(event.target.value)}
                    placeholder="Search subject, details, email, or page"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Type</p>
                  <Select value={feedbackKindFilter} onValueChange={(value) => setFeedbackKindFilter(value as typeof feedbackKindFilter)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="feature_request">Feature Request</SelectItem>
                      <SelectItem value="bug_report">Bug Report</SelectItem>
                      <SelectItem value="general_feedback">General Feedback</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Status</p>
                  <Select value={feedbackStatusFilter} onValueChange={(value) => setFeedbackStatusFilter(value as typeof feedbackStatusFilter)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="reviewed">Reviewed</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button variant="outline" onClick={() => void handleCopyFeedback()}>
                    Copy for Codex
                  </Button>
                </div>
                <div className="flex items-end">
                  <Button variant="outline" onClick={() => handleDownloadFeedbackCsv()}>
                    Download CSV
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Showing {filteredFeedback.length} of {metrics.recentFeedback.length} feedback item{metrics.recentFeedback.length === 1 ? '' : 's'}.
              </p>

              {filteredFeedback.length ? (
                filteredFeedback.map((row) => (
                  <div key={row.id} className="rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={row.kind === 'bug_report' ? 'destructive' : 'outline'}>
                            {feedbackKindLabel(row.kind)}
                          </Badge>
                          <Badge variant="outline">{feedbackStatusLabel(row.kind, row.status)}</Badge>
                          <span className="text-xs text-muted-foreground">{dateTimeFmt(row.createdAt)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {row.subject?.trim() || '(No subject)'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.email || '(no email)'}
                            {row.userName ? ` • ${row.userName}` : ''}
                            {row.pagePath ? ` • ${row.pagePath}` : ''}
                          </p>
                        </div>
                      </div>
                      {row.kind === 'feature_request' && row.status !== 'resolved' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleMarkFeedbackCompleted(row.id)}
                          disabled={updatingFeedbackId === row.id}
                        >
                          {updatingFeedbackId === row.id ? 'Saving...' : 'Mark Completed'}
                        </Button>
                      ) : null}
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{row.details}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  {metrics.recentFeedback.length ? 'No feedback items match the current filters.' : 'No feedback submissions yet.'}
                </p>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Module Usage (30d)" subtitle="Relative distribution of tracked events">
            {moduleRows.length ? (
              <div className="space-y-2">
                {moduleRows.map((row) => {
                  const share = metrics.summary.growthEvents30d > 0
                    ? Math.round((row.count / metrics.summary.growthEvents30d) * 100)
                    : 0;
                  return (
                    <div key={row.module} className="rounded-lg border border-border p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-sm font-medium capitalize">{row.module}</p>
                        <p className="text-sm text-muted-foreground">
                          {numberFmt(row.count)} ({share}%)
                        </p>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${share}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No module usage events in the last 30 days.</p>
            )}
          </SectionCard>

          <SectionCard title="Top Growth Events (30d)" subtitle="Most frequent instrumentation events">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event type</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topEventsWithShare.length ? (
                  topEventsWithShare.map((row) => (
                    <TableRow key={row.eventType}>
                      <TableCell>{row.eventType}</TableCell>
                      <TableCell className="text-right">{numberFmt(row.count)}</TableCell>
                      <TableCell className="text-right">{row.share}%</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-sm text-muted-foreground">
                      No growth events in the last 30 days.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </SectionCard>

          <SectionCard title="Billing Status Mix" subtitle="Subscription rows by status">
            {subscriptionRows.length ? (
              <div className="flex flex-wrap gap-2">
                {subscriptionRows.map((row) => (
                  <Badge key={row.status} variant="outline">
                    {row.status}: {numberFmt(row.count)}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No subscription rows yet.</p>
            )}
          </SectionCard>

          <SectionCard title="Recent Users" subtitle="Most recent account creations">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last sign in</TableHead>
                  <TableHead>Confirmed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.recentUsers.length ? (
                  metrics.recentUsers.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.email || '(no email)'}</TableCell>
                      <TableCell>{dateTimeFmt(row.createdAt)}</TableCell>
                      <TableCell>{dateTimeFmt(row.lastSignInAt)}</TableCell>
                      <TableCell>{row.emailConfirmedAt ? 'Yes' : 'No'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setPendingDeleteUser(row)}
                          disabled={row.id === user?.id || deletingUserId === row.id}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <p className="mt-3 text-xs text-muted-foreground">
              Deleting an account removes that user&apos;s auth access and user-owned data. If the account owns a household, that household may be removed too.
            </p>
          </SectionCard>
        </div>
      ) : null}

      <AlertDialog open={Boolean(pendingDeleteUser)} onOpenChange={(open) => !open && setPendingDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteUser?.email
                ? `This will permanently delete ${pendingDeleteUser.email}. This can remove their household-owned data too and cannot be undone.`
                : 'This will permanently delete the selected account and can remove household-owned data too. This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingUserId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteUser();
              }}
              disabled={Boolean(deletingUserId)}
            >
              {deletingUserId ? 'Deleting...' : 'Delete account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
