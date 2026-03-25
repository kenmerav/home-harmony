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
  moduleUsage30d: Record<string, number>;
  topGrowthEvents30d: Array<{ eventType: string; count: number }>;
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
