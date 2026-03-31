import { toggleMealSkip } from '@/lib/api/meals';
import { deleteManualCalendarEvent, type CalendarEvent } from '@/lib/calendarStore';
import { getOrderReminderSettings, setOrderReminderSettings } from '@/lib/groceryPrefs';
import {
  getDinnerReminderPrefs,
  getMenuRejuvenatePrefs,
  setDinnerReminderPrefs,
  setMenuRejuvenatePrefs,
} from '@/lib/mealPrefs';
import { deleteTaskFromCalendarRelatedId } from '@/lib/taskStore';

export interface CalendarEventDeleteResult {
  removed: boolean;
  title: string;
  description?: string;
}

const WORKOUTS_KEY = 'liftlog_workouts';
const CARDIO_KEY = 'liftlog_cardio_sessions';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function removeLocalStorageItemById(storageKey: string, itemId: string): boolean {
  if (!canUseStorage() || !itemId) return false;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return false;
    const next = parsed.filter((item) => String(item?.id || '') !== itemId);
    if (next.length === parsed.length) return false;
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function canDeleteCalendarEvent(event: CalendarEvent): boolean {
  if (event.source === 'manual' || event.source === 'task' || event.source === 'meal' || event.source === 'reminder') {
    return true;
  }

  if (event.source === 'workout') {
    return (event.relatedId || event.id).startsWith('workout-') || (event.relatedId || event.id).startsWith('cardio-');
  }

  return false;
}

export async function deleteCalendarEventFromSource(
  event: CalendarEvent,
  userId?: string | null,
): Promise<CalendarEventDeleteResult> {
  if (event.source === 'manual') {
    deleteManualCalendarEvent(event.id, userId);
    return { removed: true, title: 'Event removed' };
  }

  if (event.source === 'task') {
    const deleted = deleteTaskFromCalendarRelatedId(event.relatedId || event.id, userId);
    return deleted
      ? { removed: true, title: 'Task removed' }
      : { removed: false, title: 'Could not remove task' };
  }

  if (event.source === 'meal') {
    const mealId = event.relatedId || event.id.replace(/^meal-/, '');
    if (!mealId) return { removed: false, title: 'Could not remove meal' };
    await toggleMealSkip(mealId, true);
    return {
      removed: true,
      title: 'Meal removed',
      description: 'That planned meal was skipped and removed from the calendar.',
    };
  }

  if (event.source === 'reminder') {
    if (event.id.startsWith('reminder-grocery-')) {
      const current = getOrderReminderSettings();
      setOrderReminderSettings({ ...current, enabled: false });
      return {
        removed: true,
        title: 'Grocery reminder turned off',
        description: 'You can turn it back on from the grocery page anytime.',
      };
    }

    if (event.id.startsWith('reminder-menu-')) {
      const current = getMenuRejuvenatePrefs();
      setMenuRejuvenatePrefs({ ...current, enabled: false });
      return {
        removed: true,
        title: 'Menu refresh reminder turned off',
        description: 'You can turn it back on from the meals page anytime.',
      };
    }

    if (event.id.startsWith('prep-')) {
      const current = getDinnerReminderPrefs();
      setDinnerReminderPrefs({ ...current, enabled: false });
      return {
        removed: true,
        title: 'Dinner prep reminders turned off',
        description: 'You can turn them back on from the meals page anytime.',
      };
    }

    return {
      removed: false,
      title: 'This reminder cannot be removed here yet',
    };
  }

  if (event.source === 'workout') {
    const relatedId = event.relatedId || event.id;
    if (relatedId.startsWith('workout-')) {
      const deleted = removeLocalStorageItemById(WORKOUTS_KEY, relatedId.replace(/^workout-/, ''));
      return deleted
        ? { removed: true, title: 'Workout removed' }
        : { removed: false, title: 'Could not remove workout' };
    }
    if (relatedId.startsWith('cardio-')) {
      const deleted = removeLocalStorageItemById(CARDIO_KEY, relatedId.replace(/^cardio-/, ''));
      return deleted
        ? { removed: true, title: 'Cardio session removed' }
        : { removed: false, title: 'Could not remove cardio session' };
    }
  }

  return {
    removed: false,
    title: 'Delete this in its source module',
    description: 'For now, chores and workouts are deleted from their own pages.',
  };
}
