import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { CalendarEvent } from '@/lib/calendarStore';
import { getOrderReminderSettings, setOrderReminderSettings } from '@/lib/groceryPrefs';
import { getDinnerReminderPrefs, getMenuRejuvenatePrefs, setDinnerReminderPrefs, setMenuRejuvenatePrefs } from '@/lib/mealPrefs';
import type { DayOfWeek } from '@/types';

type ReminderEditorKind = 'grocery' | 'menu' | 'dinnerPrep';

function getReminderEditorKind(event: CalendarEvent | null): ReminderEditorKind | null {
  if (!event || event.source !== 'reminder') return null;
  if (event.id.startsWith('reminder-grocery-')) return 'grocery';
  if (event.id.startsWith('reminder-menu-')) return 'menu';
  if (event.id.startsWith('prep-')) return 'dinnerPrep';
  return null;
}

export function canEditReminderEvent(event: CalendarEvent): boolean {
  return getReminderEditorKind(event) !== null;
}

const DAY_OPTIONS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

interface ReminderEventEditDialogProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function ReminderEventEditDialog({
  event,
  open,
  onOpenChange,
  onSaved,
}: ReminderEventEditDialogProps) {
  const kind = useMemo(() => getReminderEditorKind(event), [event]);
  const [enabled, setEnabled] = useState(false);
  const [day, setDay] = useState<DayOfWeek>('saturday');
  const [time, setTime] = useState('18:00');

  useEffect(() => {
    if (!open || !kind) return;
    if (kind === 'grocery') {
      const prefs = getOrderReminderSettings();
      setEnabled(prefs.enabled);
      setDay(prefs.day);
      setTime(prefs.time);
      return;
    }
    if (kind === 'menu') {
      const prefs = getMenuRejuvenatePrefs();
      setEnabled(prefs.enabled);
      setDay(prefs.day);
      setTime(prefs.time);
      return;
    }
    const prefs = getDinnerReminderPrefs();
    setEnabled(prefs.enabled);
    setTime(prefs.preferredDinnerTime);
  }, [kind, open]);

  const copy = useMemo(() => {
    switch (kind) {
      case 'grocery':
        return {
          title: 'Edit grocery reminder',
          description: 'Choose when Home Harmony should remind you to place your grocery order.',
          enableLabel: 'Enable grocery reminder',
          helper: 'This reminder appears on your calendar and can also support your grocery text schedule.',
          showDay: true,
        };
      case 'menu':
        return {
          title: 'Edit menu refresh reminder',
          description: 'Choose when Home Harmony should remind you to refresh next week’s menu.',
          enableLabel: 'Enable menu refresh reminder',
          helper: 'Use this to keep the next week’s meal plan from sneaking up on you.',
          showDay: true,
        };
      case 'dinnerPrep':
        return {
          title: 'Edit dinner prep reminder',
          description: 'Set your dinner target time and Home Harmony will calculate the prep reminder from it.',
          enableLabel: 'Enable dinner prep reminder',
          helper: 'The reminder time is based on your normal dinner time minus estimated cook time.',
          showDay: false,
        };
      default:
        return null;
    }
  }, [kind]);

  const handleSave = () => {
    if (!kind || !copy) return;

    if (kind === 'grocery') {
      setOrderReminderSettings({ enabled, day, time: time || '10:00' });
    } else if (kind === 'menu') {
      const current = getMenuRejuvenatePrefs();
      setMenuRejuvenatePrefs({ ...current, enabled, day, time: time || '15:00' });
    } else {
      setDinnerReminderPrefs({
        enabled,
        preferredDinnerTime: time || '18:00',
      });
    }

    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{copy?.title || 'Edit reminder'}</DialogTitle>
          <DialogDescription>{copy?.description || 'Update this reminder.'}</DialogDescription>
        </DialogHeader>

        {copy ? (
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <Checkbox checked={enabled} onCheckedChange={(checked) => setEnabled(Boolean(checked))} />
              <span className="text-sm">{copy.enableLabel}</span>
            </label>

            {copy.showDay && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Day</p>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={day}
                  onChange={(eventChange) => setDay(eventChange.target.value as DayOfWeek)}
                >
                  {DAY_OPTIONS.map((dayOption) => (
                    <option key={dayOption} value={dayOption}>
                      {dayOption.charAt(0).toUpperCase() + dayOption.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-sm font-medium">{copy.showDay ? 'Time' : 'Dinner time'}</p>
              <Input type="time" value={time} onChange={(eventChange) => setTime(eventChange.target.value || time)} />
            </div>

            <p className="text-xs text-muted-foreground">{copy.helper}</p>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">This reminder can’t be edited here yet.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
