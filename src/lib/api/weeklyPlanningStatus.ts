import { addWeeks, format, startOfWeek } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

export interface WeeklyPlanningStatus {
  week_of: string;
  groceries_ordered: boolean;
  groceries_ordered_at: string | null;
  meals_generated_at: string | null;
}

function getWeekOfOffset(weekOffset = 0): string {
  const weekStart = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset);
  return format(weekStart, 'yyyy-MM-dd');
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error('You need to sign in.');
  return data.user.id;
}

export function getCurrentWeekOf(): string {
  return getWeekOfOffset(0);
}

export function getNextWeekOf(): string {
  return getWeekOfOffset(1);
}

export async function loadWeeklyPlanningStatus(weekOf: string): Promise<WeeklyPlanningStatus> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('weekly_planning_status')
    .select('week_of,groceries_ordered,groceries_ordered_at,meals_generated_at')
    .eq('user_id', userId)
    .eq('week_of', weekOf)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return {
      week_of: weekOf,
      groceries_ordered: false,
      groceries_ordered_at: null,
      meals_generated_at: null,
    };
  }

  return data as WeeklyPlanningStatus;
}

export async function setWeeklyGroceriesOrdered(
  weekOf: string,
  ordered: boolean,
): Promise<WeeklyPlanningStatus> {
  const userId = await requireUserId();
  const nowIso = new Date().toISOString();
  const payload = {
    user_id: userId,
    week_of: weekOf,
    groceries_ordered: ordered,
    groceries_ordered_at: ordered ? nowIso : null,
  };

  const { data, error } = await supabase
    .from('weekly_planning_status')
    .upsert(payload, { onConflict: 'user_id,week_of' })
    .select('week_of,groceries_ordered,groceries_ordered_at,meals_generated_at')
    .single();

  if (error) throw error;
  return data as WeeklyPlanningStatus;
}
