import { supabase } from '@/integrations/supabase/client';

export interface CommuteEtaResult {
  durationMinutes: number;
  trafficDurationMinutes: number;
}

export async function estimateCommuteEta(input: {
  origin: string;
  destination: string;
  departureTimeIso?: string;
}): Promise<CommuteEtaResult> {
  const { data, error } = await supabase.functions.invoke('commute-eta', {
    body: input,
  });

  if (error) {
    const invokeError = error as Error & { context?: Response };
    if (invokeError.context) {
      const response = invokeError.context;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const payload = (await response.clone().json().catch(() => null)) as { error?: string } | null;
        if (payload?.error) throw new Error(payload.error);
      } else {
        const text = await response.clone().text().catch(() => '');
        if (text.trim()) throw new Error(text.trim());
      }
      throw new Error(`Could not estimate travel time (${response.status}).`);
    }
    throw new Error(invokeError.message || 'Could not estimate travel time.');
  }

  const result = (data || {}) as Partial<CommuteEtaResult>;
  const durationMinutes = Number(result.durationMinutes || 0);
  const trafficDurationMinutes = Number(result.trafficDurationMinutes || 0);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error('Could not estimate travel time.');
  }
  return {
    durationMinutes: Math.max(1, Math.round(durationMinutes)),
    trafficDurationMinutes: Math.max(1, Math.round(trafficDurationMinutes || durationMinutes)),
  };
}
