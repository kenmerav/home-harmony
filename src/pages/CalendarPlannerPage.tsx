import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDays,
  addHours,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  addManualCalendarEvent,
  CalendarEvent,
  CalendarEventModule,
  deleteManualCalendarEvent,
  getGoogleCalendarPrefs,
  GoogleCalendarPrefs,
  setGoogleCalendarPrefs,
} from '@/lib/calendarStore';
import { CALENDAR_MODULE_META, fetchCalendarEventsForMonth } from '@/lib/calendarFeed';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, ExternalLink, Plus, RefreshCw, Trash2 } from 'lucide-react';

type PlannerMode = 'month' | 'twoWeek';

function moduleDefaultFilters(): Record<CalendarEventModule, boolean> {
  return {
    manual: true,
    meals: true,
    tasks: true,
    chores: true,
    workouts: true,
    reminders: true,
  };
}

function toGoogleDateToken(input: Date): string {
  return input.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function buildGoogleEventUrl(event: CalendarEvent): string {
  const start = parseISO(event.startsAt);
  const end = event.endsAt ? parseISO(event.endsAt) : addHours(start, 1);
  const dates = event.allDay
    ? `${format(start, 'yyyyMMdd')}/${format(addDays(start, 1), 'yyyyMMdd')}`
    : `${toGoogleDateToken(start)}/${toGoogleDateToken(end)}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates,
    details: event.description || '',
    location: event.location || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function eventTimeLabel(event: CalendarEvent): string {
  const start = parseISO(event.startsAt);
  if (event.allDay) return 'All day';
  if (!event.endsAt) return format(start, 'h:mm a');
  return `${format(start, 'h:mm a')} - ${format(parseISO(event.endsAt), 'h:mm a')}`;
}

function isoDayKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export default function CalendarPlannerPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<PlannerMode>('month');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<Record<CalendarEventModule, boolean>>(moduleDefaultFilters);
  const [googlePrefs, setGooglePrefsState] = useState<GoogleCalendarPrefs>(() => getGoogleCalendarPrefs(user?.id));
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftLocation, setDraftLocation] = useState('');
  const [draftDate, setDraftDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [draftTime, setDraftTime] = useState('18:00');
  const [draftEndTime, setDraftEndTime] = useState('');
  const [draftAllDay, setDraftAllDay] = useState(false);

  useEffect(() => {
    setGooglePrefsState(getGoogleCalendarPrefs(user?.id));
  }, [user?.id]);

  const refreshEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await fetchCalendarEventsForMonth(currentMonth, user?.id);
      setEvents(rows);
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, user?.id]);

  useEffect(() => {
    void refreshEvents();
  }, [refreshEvents]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = () => {
      void refreshEvents();
    };
    window.addEventListener('homehub:calendar-events-updated', handler);
    return () => window.removeEventListener('homehub:calendar-events-updated', handler);
  }, [refreshEvents]);

  const filteredEvents = useMemo(() => events.filter((event) => filters[event.module]), [events, filters]);

  const monthGridDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    const days: Date[] = [];
    let cursor = start;
    while (cursor <= end) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return days;
  }, [currentMonth]);

  const twoWeekDays = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return Array.from({ length: 14 }, (_, idx) => addDays(start, idx));
  }, [selectedDate]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    filteredEvents.forEach((event) => {
      const key = isoDayKey(parseISO(event.startsAt));
      const list = map.get(key) || [];
      list.push(event);
      map.set(key, list);
    });
    map.forEach((list) => list.sort((a, b) => (a.startsAt > b.startsAt ? 1 : -1)));
    return map;
  }, [filteredEvents]);

  const selectedDayEvents = useMemo(() => {
    const key = isoDayKey(selectedDate);
    return eventsByDay.get(key) || [];
  }, [eventsByDay, selectedDate]);

  const upcomingEvents = useMemo(
    () =>
      filteredEvents
        .filter((event) => !isBefore(parseISO(event.startsAt), new Date()))
        .slice(0, 10),
    [filteredEvents],
  );

  const openAddDialog = () => {
    setDraftDate(format(selectedDate, 'yyyy-MM-dd'));
    setDraftTime('18:00');
    setDraftEndTime('');
    setDraftAllDay(false);
    setDraftTitle('');
    setDraftDescription('');
    setDraftLocation('');
    setAddDialogOpen(true);
  };

  const createManualEvent = () => {
    if (!draftTitle.trim()) {
      toast({ title: 'Add a title first', variant: 'destructive' });
      return;
    }
    const startsAt = draftAllDay ? `${draftDate}T00:00:00.000Z` : `${draftDate}T${draftTime || '18:00'}:00`;
    const endsAt = draftAllDay
      ? undefined
      : draftEndTime
      ? `${draftDate}T${draftEndTime}:00`
      : undefined;
    addManualCalendarEvent(
      {
        title: draftTitle,
        description: draftDescription,
        location: draftLocation.trim() || undefined,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
        allDay: draftAllDay,
      },
      user?.id,
    );
    setAddDialogOpen(false);
    toast({ title: 'Event added' });
    void refreshEvents();
  };

  const removeManualEvent = (eventId: string) => {
    deleteManualCalendarEvent(eventId, user?.id);
    toast({ title: 'Event removed' });
    void refreshEvents();
  };

  const setFilter = (module: CalendarEventModule, checked: boolean) => {
    setFilters((prev) => ({ ...prev, [module]: checked }));
  };

  const updateGooglePrefs = (updates: Partial<GoogleCalendarPrefs>) => {
    const next = { ...googlePrefs, ...updates };
    setGooglePrefsState(next);
    setGoogleCalendarPrefs(next, user?.id);
  };

  const renderDayCell = (day: Date, inCurrentMonth: boolean) => {
    const key = isoDayKey(day);
    const dayEvents = eventsByDay.get(key) || [];
    const isSelected = isSameDay(day, selectedDate);
    const preview = dayEvents.slice(0, 4);
    const hiddenCount = Math.max(0, dayEvents.length - preview.length);

    return (
      <button
        key={key}
        type="button"
        onClick={() => setSelectedDate(day)}
        className={cn(
          'min-h-[150px] border border-border/70 p-2 text-left transition-colors',
          isSelected && 'bg-primary/10 ring-1 ring-primary',
          !inCurrentMonth && 'bg-muted/30 text-muted-foreground',
          inCurrentMonth && 'hover:bg-muted/30',
        )}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className={cn('text-xs font-medium', isSelected && 'text-primary')}>{format(day, 'd')}</span>
          <span className="text-[10px] text-muted-foreground">{dayEvents.length || ''}</span>
        </div>
        <div className="space-y-1">
          {preview.map((event) => (
            <div key={event.id} className="rounded bg-background/70 px-1.5 py-1 text-[11px]">
              <div className="flex items-center gap-1">
                <span className={cn('h-1.5 w-1.5 rounded-full', CALENDAR_MODULE_META[event.module].dotClass)} />
                <span className="truncate">{eventTimeLabel(event)}</span>
              </div>
              <p className="truncate text-foreground">{event.title}</p>
            </div>
          ))}
          {hiddenCount > 0 && <p className="text-[11px] text-muted-foreground">+{hiddenCount} more</p>}
        </div>
      </button>
    );
  };

  return (
    <AppLayout contentWidthClassName="max-w-[1440px]">
      <PageHeader
        title="Calendar Planner"
        subtitle="Expanded planning view for weekly coordination"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/calendar/standard">Standard View</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void refreshEvents()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button size="sm" onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Event
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <SectionCard noPadding className="overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="font-display text-xl font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())}>
                  Today
                </Button>
              </div>
              <Tabs value={mode} onValueChange={(value) => setMode(value as PlannerMode)}>
                <TabsList>
                  <TabsTrigger value="month">Month</TabsTrigger>
                  <TabsTrigger value="twoWeek">2 Weeks</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div key={day} className="border-r border-border/60 py-2 last:border-r-0">
                {day}
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="p-8 text-sm text-muted-foreground">Loading planner events...</div>
          ) : (
            <div className="grid grid-cols-7">
              {(mode === 'month' ? monthGridDays : twoWeekDays).map((day) =>
                renderDayCell(day, mode === 'twoWeek' ? true : format(day, 'M') === format(currentMonth, 'M')),
              )}
            </div>
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title={format(selectedDate, 'EEEE, MMMM d')} subtitle={`${selectedDayEvents.length} events`}>
            {selectedDayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events for this day.</p>
            ) : (
              <div className="space-y-2">
                {selectedDayEvents.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    googleEnabled={googlePrefs.enabled}
                    onDelete={event.module === 'manual' ? removeManualEvent : undefined}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Filters" subtitle="Show/hide event types">
            <div className="space-y-2">
              {(Object.keys(CALENDAR_MODULE_META) as CalendarEventModule[]).map((module) => (
                <div key={module} className="flex items-center justify-between">
                  <Badge variant="outline" className={cn('border', CALENDAR_MODULE_META[module].badgeClass)}>
                    {CALENDAR_MODULE_META[module].label}
                  </Badge>
                  <Switch checked={filters[module]} onCheckedChange={(checked) => setFilter(module, checked)} />
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Google Calendar" subtitle="Connection scaffold">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Enable Google links</span>
                <Switch checked={googlePrefs.enabled} onCheckedChange={(checked) => updateGooglePrefs({ enabled: checked })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Calendar label</label>
                <Input
                  value={googlePrefs.selectedCalendarLabel}
                  onChange={(e) => updateGooglePrefs({ selectedCalendarLabel: e.target.value || 'Primary calendar' })}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Full OAuth sync is next. This planner currently supports one-click Google event creation.
              </p>
            </div>
          </SectionCard>

          <SectionCard title="Upcoming" subtitle="Next 10 scheduled items">
            <div className="space-y-2">
              {upcomingEvents.length === 0 && <p className="text-sm text-muted-foreground">No upcoming items.</p>}
              {upcomingEvents.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  googleEnabled={googlePrefs.enabled}
                  compact
                  onDelete={event.module === 'manual' ? removeManualEvent : undefined}
                />
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Add planner event</DialogTitle>
            <DialogDescription>Create a manual event for this calendar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Title</label>
              <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="Event title" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Date</label>
              <Input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm">All-day event</span>
              <Switch checked={draftAllDay} onCheckedChange={setDraftAllDay} />
            </div>
            {!draftAllDay && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Start</label>
                  <Input type="time" value={draftTime} onChange={(e) => setDraftTime(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">End (optional)</label>
                  <Input type="time" value={draftEndTime} onChange={(e) => setDraftEndTime(e.target.value)} />
                </div>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                placeholder="Optional details"
                className="min-h-[96px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Location (optional)</label>
              <Input
                value={draftLocation}
                onChange={(e) => setDraftLocation(e.target.value)}
                placeholder="Address or place"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createManualEvent}>
              <Plus className="mr-2 h-4 w-4" />
              Add event
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function EventRow({
  event,
  googleEnabled,
  compact,
  onDelete,
}: {
  event: CalendarEvent;
  googleEnabled: boolean;
  compact?: boolean;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className={cn('rounded-lg border border-border p-3', compact && 'py-2')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{event.title}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{eventTimeLabel(event)}</span>
            <Badge variant="outline" className={cn('border', CALENDAR_MODULE_META[event.module].badgeClass)}>
              {CALENDAR_MODULE_META[event.module].label}
            </Badge>
          </div>
          {event.description && !compact && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{event.description}</p>}
          {event.location && !compact && <p className="mt-1 text-xs text-muted-foreground">Location: {event.location}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {googleEnabled && (
            <Button asChild variant="ghost" size="icon" className="h-8 w-8">
              <a href={buildGoogleEventUrl(event)} target="_blank" rel="noreferrer" aria-label={`Open ${event.title} in Google Calendar`}>
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(event.id)} aria-label={`Delete ${event.title}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
