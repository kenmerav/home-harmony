import { addDays, addMonths, addWeeks, addYears } from 'date-fns';

export type RecurrencePreset = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'custom';
export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year';

export interface CalendarRecurrenceDraft {
  preset: RecurrencePreset;
  customInterval: string;
  customUnit: RecurrenceUnit;
}

export const RECURRING_OCCURRENCE_COUNT = 12;

export function getRecurrencePattern(draft: CalendarRecurrenceDraft): {
  interval: number;
  unit: RecurrenceUnit;
  label: string;
} {
  switch (draft.preset) {
    case 'daily':
      return { interval: 1, unit: 'day', label: 'daily' };
    case 'weekly':
      return { interval: 1, unit: 'week', label: 'weekly' };
    case 'biweekly':
      return { interval: 2, unit: 'week', label: 'every 2 weeks' };
    case 'monthly':
      return { interval: 1, unit: 'month', label: 'monthly' };
    case 'yearly':
      return { interval: 1, unit: 'year', label: 'yearly' };
    case 'custom':
    default: {
      const parsedInterval = Number.parseInt(draft.customInterval || '1', 10);
      const interval = Number.isFinite(parsedInterval) ? Math.max(1, Math.min(365, parsedInterval)) : 1;
      const unit = draft.customUnit || 'week';
      const label = interval === 1 ? `every ${unit}` : `every ${interval} ${unit}s`;
      return { interval, unit, label };
    }
  }
}

export function buildRecurringStartDates(
  baseStart: Date,
  draft: CalendarRecurrenceDraft,
  occurrenceCount = RECURRING_OCCURRENCE_COUNT,
): Date[] {
  const { interval, unit } = getRecurrencePattern(draft);
  const count = Math.max(1, occurrenceCount);
  return Array.from({ length: count }, (_, index) => {
    if (index === 0) return baseStart;
    const offset = index * interval;
    if (unit === 'year') return addYears(baseStart, offset);
    if (unit === 'month') return addMonths(baseStart, offset);
    if (unit === 'week') return addWeeks(baseStart, offset);
    return addDays(baseStart, offset);
  });
}
