import { supabase } from '@/integrations/supabase/client';

export interface AdminMetricsSummary {
  totalUsers: number;
  verifiedUsers: number;
  newUsers7d: number;
  newUsers30d: number;
  activeUsers7d: number;
  activeUsers30d: number;
  growthEvents7d: number;
  growthEvents30d: number;
}

export interface AdminMetricsTotals {
  profiles: number;
  onboardingCompleted: number;
  households: number;
  recipes: number;
  plannedMeals: number;
  referralEvents: number;
  growthEventsAllTime: number;
}

export interface AdminMetricsResponse {
  summary: AdminMetricsSummary;
  totals: AdminMetricsTotals;
  subscriptionsByStatus: Record<string, number>;
  costSummary30d: {
    estimatedCost30d: number;
    smsEstimatedCost30d: number;
    aiEstimatedCost30d: number;
    emailEstimatedCost30d: number;
    smsMessagesSent30d: number;
    inboundTexts30d: number;
    aiCalls30d: number;
    emailSends30d: number;
    activeMeteredUsers30d: number;
  };
  moduleUsage30d: Record<string, number>;
  topGrowthEvents30d: Array<{ eventType: string; count: number }>;
  topCostUsers30d: Array<{
    id: string;
    email: string | null;
    totalEstimatedCost30d: number;
    smsEstimatedCost30d: number;
    aiEstimatedCost30d: number;
    emailEstimatedCost30d: number;
    smsMessagesSent30d: number;
    inboundTexts30d: number;
    aiCalls30d: number;
    emailSends30d: number;
    lastSeenAt: string | null;
  }>;
  recentFeedback: Array<{
    id: string;
    email: string | null;
    userName: string | null;
    kind: 'feature_request' | 'bug_report' | 'general_feedback';
    pagePath: string;
    pageTitle: string | null;
    pageUrl: string | null;
    subject: string | null;
    details: string;
    status: string;
    createdAt: string;
  }>;
  recentUsers: Array<{
    id: string;
    email: string | null;
    createdAt: string;
    lastSignInAt: string | null;
    emailConfirmedAt: string | null;
  }>;
  generatedAt: string;
}

async function parseInvokeError(error: unknown, fallback: string): Promise<string> {
  if (error instanceof Error) {
    const invokeError = error as Error & { context?: Response };
    if (invokeError.context) {
      const contentType = invokeError.context.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const payload = await invokeError.context.clone().json().catch(() => null) as
          | { error?: string; message?: string; code?: number | string }
          | null;
        if (payload?.error) return payload.error;
        if (payload?.message) {
          if (payload?.code !== undefined) return `${payload.message} (${payload.code})`;
          return payload.message;
        }
      } else {
        const text = await invokeError.context.clone().text().catch(() => '');
        if (text.trim()) return text.trim();
      }
      return `Admin request failed (${invokeError.context.status}).`;
    }
    if (invokeError.message?.trim()) return invokeError.message;
  }
  return fallback;
}

export async function fetchAdminMetrics(): Promise<AdminMetricsResponse> {
  const { data, error } = await supabase.functions.invoke('admin-metrics');
  if (error) {
    throw new Error(await parseInvokeError(error, 'Could not load admin metrics.'));
  }
  const parsed = data as Partial<AdminMetricsResponse> | null;
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid admin metrics response.');
  if (!parsed.summary || !parsed.totals) throw new Error('Admin metrics response missing required fields.');
  return parsed as AdminMetricsResponse;
}

export async function deleteAdminUser(userId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('admin-delete-user', {
    body: { userId },
  });
  if (error) {
    throw new Error(await parseInvokeError(error, 'Could not delete account.'));
  }
}

export async function updateAdminFeedbackStatus(
  feedbackId: string,
  status: 'reviewed' | 'resolved',
): Promise<void> {
  const { error } = await supabase.functions.invoke('admin-update-feedback-status', {
    body: { feedbackId, status },
  });
  if (error) {
    throw new Error(await parseInvokeError(error, 'Could not update feedback status.'));
  }
}

export async function normalizeBreakfastRecipeMealTypes(email: string): Promise<{
  updatedCount: number;
  updatedNames: string[];
}> {
  const { data, error } = await supabase.functions.invoke('admin-normalize-recipe-meal-types', {
    body: { email },
  });
  if (error) {
    throw new Error(await parseInvokeError(error, 'Could not normalize breakfast recipe tags.'));
  }
  const parsed = data as {
    success?: boolean;
    updatedCount?: number;
    updatedNames?: string[];
    error?: string;
  } | null;
  if (!parsed || parsed.success !== true) {
    throw new Error(parsed?.error || 'Could not normalize breakfast recipe tags.');
  }
  return {
    updatedCount: parsed.updatedCount || 0,
    updatedNames: Array.isArray(parsed.updatedNames) ? parsed.updatedNames : [],
  };
}
