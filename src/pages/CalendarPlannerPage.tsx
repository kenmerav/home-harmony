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
import { estimateCommuteEta } from '@/lib/api/commute';
import {
  defaultSmsPreferences,
  loadSmsPreferences,
  saveSmsPreferences,
  SmsPreferences,
  SmsReminderModule,
} from '@/lib/api/sms';
import {
  addManualCalendarEvent,
  CalendarEvent,
  CalendarEventModule,
  deleteManualCalendarEvent,
  getGoogleCalendarPrefs,
  GoogleCalendarPrefs,
  setGoogleCalendarPrefs,
} from '@/lib/calendarStore';
import {
  CalendarFilterPreset,
  createCalendarFilterPreset,
  filtersEqual,
  loadStoredCalendarFilterPresets,
  loadStoredCalendarFilters,
  normalizeCalendarFilterName,
  saveStoredCalendarFilterPresets,
  saveStoredCalendarFilters,
} from '@/lib/calendarFilters';
import { CALENDAR_MODULE_META, fetchCalendarEventsForMonth } from '@/lib/calendarFeed';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, ExternalLink, Plus, RefreshCw, Trash2 } from 'lucide-react';

type PlannerMode = 'month' | 'twoWeek';
type ModuleLabelOverrides = Partial<Record<CalendarEventModule, string>>;
type CalendarModuleFilterSettings = {
  labelOverrides: ModuleLabelOverrides;
};

const CALENDAR_MODULE_FILTER_SETTINGS_KEY = 'homehub.calendar.module-filter-settings.v1';

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

function parsePhoneList(input: string): string[] {
  return [
    ...new Set(
      input
        .split(/[\n,;]+/g)
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  ];
}

function formatPhoneList(input: string[]): string {
  return input.join(', ');
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function scopedModuleFilterSettingsKey(userId?: string | null): string {
  return `${CALENDAR_MODULE_FILTER_SETTINGS_KEY}:${userId || 'anon'}`;
}

function loadModuleFilterSettings(userId?: string | null): CalendarModuleFilterSettings {
  if (!canUseStorage()) return { labelOverrides: {} };
  try {
    const raw = window.localStorage.getItem(scopedModuleFilterSettingsKey(userId));
    if (!raw) return { labelOverrides: {} };
    const parsed = JSON.parse(raw) as Partial<CalendarModuleFilterSettings>;
    const labelOverrides = (parsed.labelOverrides || {}) as ModuleLabelOverrides;
    return { labelOverrides };
  } catch {
    return { labelOverrides: {} };
  }
}

function saveModuleFilterSettings(settings: CalendarModuleFilterSettings, userId?: string | null) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(scopedModuleFilterSettingsKey(userId), JSON.stringify(settings));
}

function isSmsFilterModule(module: CalendarEventModule): module is SmsReminderModule {
  return module === 'manual' || module === 'meals';
}

function withTime(baseDate: Date, hhmm: string): Date {
  const [hourRaw, minuteRaw] = hhmm.split(':');
  const date = new Date(baseDate);
  date.setHours(Number.parseInt(hourRaw, 10) || 0, Number.parseInt(minuteRaw, 10) || 0, 0, 0);
  return date;
}

export default function CalendarPlannerPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<PlannerMode>('month');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dayDetailOpen, setDayDetailOpen] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<Record<CalendarEventModule, boolean>>(() =>
    loadStoredCalendarFilters(user?.id),
  );
  const [filterPresets, setFilterPresets] = useState<CalendarFilterPreset[]>(() =>
    loadStoredCalendarFilterPresets(user?.id),
  );
  const [newFilterPresetName, setNewFilterPresetName] = useState('');
  const [newFilterPresetRecipients, setNewFilterPresetRecipients] = useState('');
  const [currentFilterName, setCurrentFilterName] = useState('Current filter');
  const [currentFilterRecipients, setCurrentFilterRecipients] = useState('');
  const [activeFilterPresetId, setActiveFilterPresetId] = useState<string | null>(null);
  const [moduleFilterSettings, setModuleFilterSettings] = useState<CalendarModuleFilterSettings>(() =>
    loadModuleFilterSettings(user?.id),
  );
  const [moduleEditorOpen, setModuleEditorOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<CalendarEventModule | null>(null);
  const [editingModuleName, setEditingModuleName] = useState('');
  const [editingModuleRecipients, setEditingModuleRecipients] = useState('');
  const [googlePrefs, setGooglePrefsState] = useState<GoogleCalendarPrefs>(() => getGoogleCalendarPrefs(user?.id));
  const [smsPrefs, setSmsPrefs] = useState<SmsPreferences>(() =>
    defaultSmsPreferences(
      typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'America/New_York',
    ),
  );
  const [smsSaving, setSmsSaving] = useState(false);
  const canUseRemoteSms = Boolean(user?.id && user.id !== 'demo-user');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftLocation, setDraftLocation] = useState('');
  const [draftHomeAddress, setDraftHomeAddress] = useState('');
  const [draftTravelMinutes, setDraftTravelMinutes] = useState<number | null>(null);
  const [draftTrafficMinutes, setDraftTrafficMinutes] = useState<number | null>(null);
  const [draftLeaveByIso, setDraftLeaveByIso] = useState<string | null>(null);
  const [draftLeaveReminderEnabled, setDraftLeaveReminderEnabled] = useState(false);
  const [draftTravelLoading, setDraftTravelLoading] = useState(false);
  const [draftTravelError, setDraftTravelError] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [draftTime, setDraftTime] = useState('18:00');
  const [draftEndTime, setDraftEndTime] = useState('');
  const [draftAllDay, setDraftAllDay] = useState(false);

  useEffect(() => {
    setGooglePrefsState(getGoogleCalendarPrefs(user?.id));
  }, [user?.id]);

  useEffect(() => {
    setFilters(loadStoredCalendarFilters(user?.id));
    setFilterPresets(loadStoredCalendarFilterPresets(user?.id));
    setModuleFilterSettings(loadModuleFilterSettings(user?.id));
  }, [user?.id]);

  useEffect(() => {
    saveStoredCalendarFilters(filters, user?.id);
  }, [filters, user?.id]);

  useEffect(() => {
    saveStoredCalendarFilterPresets(filterPresets, user?.id);
  }, [filterPresets, user?.id]);

  useEffect(() => {
    saveModuleFilterSettings(moduleFilterSettings, user?.id);
  }, [moduleFilterSettings, user?.id]);

  useEffect(() => {
    const activeMatch = filterPresets.find((preset) => filtersEqual(preset.modules, filters));
    setActiveFilterPresetId(activeMatch?.id || null);
  }, [filterPresets, filters]);

  useEffect(() => {
    if (!activeFilterPresetId) return;
    const activePreset = filterPresets.find((preset) => preset.id === activeFilterPresetId);
    if (!activePreset) return;
    setCurrentFilterName(activePreset.name);
    setCurrentFilterRecipients(formatPhoneList(activePreset.reminderRecipients || []));
  }, [activeFilterPresetId, filterPresets]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!canUseRemoteSms) {
        setSmsPrefs(
          defaultSmsPreferences(
            typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'America/New_York',
          ),
        );
        return;
      }
      try {
        const prefs = await loadSmsPreferences();
        if (mounted) setSmsPrefs(prefs);
      } catch {
        // Keep defaults if SMS prefs fail.
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [canUseRemoteSms]);

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
    setDraftHomeAddress((smsPrefs.home_address || '').trim());
    setDraftTravelMinutes(null);
    setDraftTrafficMinutes(null);
    setDraftLeaveByIso(null);
    setDraftLeaveReminderEnabled(false);
    setDraftTravelError(null);
    setAddDialogOpen(true);
  };

  const openDayDetail = (day: Date) => {
    setSelectedDate(day);
    setDayDetailOpen(true);
  };

  const estimateTravelForDraft = async () => {
    if (draftAllDay) {
      setDraftTravelError('Travel estimate is available for timed events only.');
      return;
    }
    const origin = draftHomeAddress.trim() || smsPrefs.home_address.trim();
    const destination = draftLocation.trim();
    if (!origin || !destination) {
      setDraftTravelError('Add both home address and location to estimate travel time.');
      return;
    }
    const departureIso = withTime(parseISO(`${draftDate}T00:00:00`), draftTime || '18:00').toISOString();
    setDraftTravelLoading(true);
    setDraftTravelError(null);
    try {
      const estimate = await estimateCommuteEta({
        origin,
        destination,
        departureTimeIso: departureIso,
      });
      const leaveAt = addMinutes(parseISO(departureIso), -Math.max(1, estimate.trafficDurationMinutes));
      setDraftTravelMinutes(estimate.durationMinutes);
      setDraftTrafficMinutes(estimate.trafficDurationMinutes);
      setDraftLeaveByIso(leaveAt.toISOString());
      toast({
        title: 'Travel time updated',
        description: `Leave by ${format(leaveAt, 'h:mm a')} (${estimate.trafficDurationMinutes} min with traffic).`,
      });
    } catch (error) {
      setDraftTravelError(error instanceof Error ? error.message : 'Could not estimate travel time.');
    } finally {
      setDraftTravelLoading(false);
    }
  };

  const saveHomeAddressFromDraft = async () => {
    const nextAddress = draftHomeAddress.trim();
    if (!nextAddress) {
      toast({ title: 'Enter your home address first', variant: 'destructive' });
      return;
    }
    if (!canUseRemoteSms) {
      setSmsPrefs((prev) => ({ ...prev, home_address: nextAddress }));
      toast({ title: 'Home address saved for this session' });
      return;
    }
    setSmsSaving(true);
    try {
      const saved = await saveSmsPreferences({ ...smsPrefs, home_address: nextAddress });
      setSmsPrefs(saved);
      setDraftHomeAddress(saved.home_address || nextAddress);
      toast({ title: 'Home address saved' });
    } catch (error) {
      toast({
        title: 'Could not save home address',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSmsSaving(false);
    }
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
        travelFromAddress: (draftHomeAddress.trim() || smsPrefs.home_address.trim()) || undefined,
        travelMode: 'driving',
        travelDurationMinutes: draftTravelMinutes,
        trafficDurationMinutes: draftTrafficMinutes,
        recommendedLeaveAt: draftLeaveByIso,
        leaveReminderEnabled: draftLeaveReminderEnabled,
        leaveReminderLeadMinutes: 10,
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

  const getModuleLabel = (module: CalendarEventModule): string => {
    const override = moduleFilterSettings.labelOverrides[module];
    return override?.trim() || CALENDAR_MODULE_META[module].label;
  };

  const openModuleEditor = (module: CalendarEventModule) => {
    setEditingModule(module);
    setEditingModuleName(getModuleLabel(module));
    setEditingModuleRecipients(
      isSmsFilterModule(module) ? formatPhoneList(smsPrefs.module_recipients[module] || []) : '',
    );
    setModuleEditorOpen(true);
  };

  const saveModuleEditor = async () => {
    if (!editingModule) return;
    const trimmedName = editingModuleName.trim();
    const defaultName = CALENDAR_MODULE_META[editingModule].label;
    const finalName = trimmedName || defaultName;
    const nextOverrides: ModuleLabelOverrides = { ...moduleFilterSettings.labelOverrides };

    if (!trimmedName || trimmedName.toLowerCase() === defaultName.toLowerCase()) {
      delete nextOverrides[editingModule];
    } else {
      nextOverrides[editingModule] = trimmedName;
    }
    setModuleFilterSettings({ labelOverrides: nextOverrides });

    if (isSmsFilterModule(editingModule)) {
      const recipients = parsePhoneList(editingModuleRecipients);
      const nextPrefs: SmsPreferences = {
        ...smsPrefs,
        include_modules: [...new Set([...smsPrefs.include_modules, editingModule])],
        module_recipients: {
          ...smsPrefs.module_recipients,
          [editingModule]: recipients,
        },
      };
      setSmsPrefs(nextPrefs);
      if (canUseRemoteSms) {
        try {
          const saved = await saveSmsPreferences(nextPrefs);
          setSmsPrefs(saved);
        } catch (error) {
          toast({
            title: 'Could not save reminder recipients',
            description: error instanceof Error ? error.message : 'Please try again.',
            variant: 'destructive',
          });
          return;
        }
      }
    }

    toast({ title: `${finalName} filter updated` });
    setModuleEditorOpen(false);
  };

  const setFilter = (module: CalendarEventModule, checked: boolean) => {
    setFilters((prev) => ({ ...prev, [module]: checked }));
  };

  const smsModulesForPreset = (preset: CalendarFilterPreset): SmsReminderModule[] => {
    const modules: SmsReminderModule[] = [];
    if (preset.modules.meals) modules.push('meals');
    if (preset.modules.manual) modules.push('manual');
    return modules;
  };

  const applyPresetRecipientsToSms = async (preset: CalendarFilterPreset) => {
    const recipients = preset.reminderRecipients;
    if (!recipients.length) return;
    const smsModules = smsModulesForPreset(preset);
    if (smsModules.length === 0) {
      toast({
        title: 'No SMS-enabled modules in this filter',
        description: 'Only Meals and Manual events currently support reminder text routing.',
      });
      return;
    }

    const nextPrefs: SmsPreferences = {
      ...smsPrefs,
      include_modules: [...new Set([...smsPrefs.include_modules, ...smsModules])],
      module_recipients: {
        ...smsPrefs.module_recipients,
        meals: smsModules.includes('meals') ? recipients : smsPrefs.module_recipients.meals,
        manual: smsModules.includes('manual') ? recipients : smsPrefs.module_recipients.manual,
      },
    };
    setSmsPrefs(nextPrefs);

    if (!canUseRemoteSms) {
      toast({ title: 'Filter recipients saved locally for this session' });
      return;
    }

    try {
      const saved = await saveSmsPreferences(nextPrefs);
      setSmsPrefs(saved);
      toast({ title: 'Filter reminder recipients updated' });
    } catch (error) {
      toast({
        title: 'Could not save filter reminder recipients',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const createFilterPreset = () => {
    const nextPreset = createCalendarFilterPreset(
      newFilterPresetName,
      filters,
      filterPresets.length,
      parsePhoneList(newFilterPresetRecipients),
    );
    setFilterPresets((prev) => [...prev, nextPreset]);
    setNewFilterPresetName('');
    setNewFilterPresetRecipients('');
    setActiveFilterPresetId(nextPreset.id);
    toast({ title: `Filter "${nextPreset.name}" saved` });
    void applyPresetRecipientsToSms(nextPreset);
  };

  const renameFilterPreset = (presetId: string, name: string) => {
    setFilterPresets((prev) =>
      prev.map((preset) => (preset.id === presetId ? { ...preset, name } : preset)),
    );
  };

  const commitFilterPresetName = (presetId: string) => {
    setFilterPresets((prev) =>
      prev.map((preset) =>
        preset.id === presetId ? { ...preset, name: normalizeCalendarFilterName(preset.name) } : preset,
      ),
    );
  };

  const applyFilterPreset = (presetId: string) => {
    const preset = filterPresets.find((item) => item.id === presetId);
    if (!preset) return;
    setFilters(preset.modules);
    setActiveFilterPresetId(preset.id);
    void applyPresetRecipientsToSms(preset);
  };

  const updatePresetFromCurrent = (presetId: string) => {
    setFilterPresets((prev) =>
      prev.map((preset) => (preset.id === presetId ? { ...preset, modules: { ...filters } } : preset)),
    );
    toast({ title: 'Filter updated from current toggles' });
  };

  const deleteFilterPreset = (presetId: string) => {
    setFilterPresets((prev) => prev.filter((preset) => preset.id !== presetId));
    setActiveFilterPresetId((prev) => (prev === presetId ? null : prev));
    toast({ title: 'Filter removed' });
  };

  const updateFilterPresetRecipients = (presetId: string, input: string) => {
    const recipients = parsePhoneList(input);
    setFilterPresets((prev) =>
      prev.map((preset) =>
        preset.id === presetId ? { ...preset, reminderRecipients: recipients } : preset,
      ),
    );
  };

  const saveCurrentFilterConfig = async () => {
    const normalizedName = normalizeCalendarFilterName(currentFilterName || 'Current filter');
    const recipients = parsePhoneList(currentFilterRecipients);

    if (activeFilterPresetId) {
      let updatedPreset: CalendarFilterPreset | null = null;
      setFilterPresets((prev) =>
        prev.map((preset) => {
          if (preset.id !== activeFilterPresetId) return preset;
          updatedPreset = {
            ...preset,
            name: normalizedName,
            reminderRecipients: recipients,
            modules: { ...filters },
          };
          return updatedPreset;
        }),
      );
      if (updatedPreset) {
        toast({ title: 'Current filter updated' });
        await applyPresetRecipientsToSms(updatedPreset);
      }
      return;
    }

    const nextPreset = createCalendarFilterPreset(
      normalizedName,
      filters,
      filterPresets.length,
      recipients,
    );
    setFilterPresets((prev) => [...prev, nextPreset]);
    setActiveFilterPresetId(nextPreset.id);
    toast({ title: 'Current filter saved' });
    await applyPresetRecipientsToSms(nextPreset);
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
        onClick={() => openDayDetail(day)}
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
            <Button variant="outline" size="sm" onClick={() => setFilterDialogOpen(true)}>
              Filters
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
                  <button type="button" onClick={() => openModuleEditor(module)} aria-label={`Edit ${getModuleLabel(module)} filter`}>
                    <Badge variant="outline" className={cn('border cursor-pointer', CALENDAR_MODULE_META[module].badgeClass)}>
                      {getModuleLabel(module)}
                    </Badge>
                  </button>
                  <Switch checked={filters[module]} onCheckedChange={(checked) => setFilter(module, checked)} />
                </div>
              ))}

              <div className="pt-3 border-t border-border space-y-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Saved filters</p>
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <p className="text-sm font-medium">Current filters</p>
                  <Input
                    value={currentFilterName}
                    onChange={(event) => setCurrentFilterName(event.target.value)}
                    placeholder="Filter name"
                  />
                  <Input
                    value={currentFilterRecipients}
                    onChange={(event) => setCurrentFilterRecipients(event.target.value)}
                    placeholder="Who to notify (+16155551234, +16155550999)"
                  />
                  <Button type="button" variant="outline" onClick={() => void saveCurrentFilterConfig()}>
                    Save current filter
                  </Button>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={newFilterPresetName}
                    onChange={(event) => setNewFilterPresetName(event.target.value)}
                    placeholder="Name this filter (example: Meals + chores)"
                  />
                  <Input
                    value={newFilterPresetRecipients}
                    onChange={(event) => setNewFilterPresetRecipients(event.target.value)}
                    placeholder="+16155551234, +16155550999"
                  />
                  <Button type="button" variant="outline" onClick={createFilterPreset}>
                    Add filter
                  </Button>
                </div>
                {filterPresets.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No custom filters yet. Save your current toggles so you can switch quickly.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {filterPresets.map((preset) => {
                      const isActive = activeFilterPresetId === preset.id;
                      return (
                        <div
                          key={preset.id}
                          className={cn(
                            'rounded-lg border border-border p-2 space-y-2',
                            isActive && 'border-primary/50 bg-primary/5',
                          )}
                        >
                          <Input
                            value={preset.name}
                            onChange={(event) => renameFilterPreset(preset.id, event.target.value)}
                            onBlur={() => commitFilterPresetName(preset.id)}
                            aria-label={`Filter name for ${preset.name}`}
                          />
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">
                              Reminder recipients for this filter
                            </label>
                            <Input
                              value={formatPhoneList(preset.reminderRecipients || [])}
                              onChange={(event) =>
                                updateFilterPresetRecipients(preset.id, event.target.value)
                              }
                              placeholder="+16155551234, +16155550999"
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={isActive ? 'default' : 'outline'}
                              onClick={() => applyFilterPreset(preset.id)}
                            >
                              Apply
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => updatePresetFromCurrent(preset.id)}
                            >
                              Update
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteFilterPreset(preset.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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

      <Dialog open={dayDetailOpen} onOpenChange={setDayDetailOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">{format(selectedDate, 'EEEE, MMMM d')}</DialogTitle>
            <DialogDescription>
              {selectedDayEvents.length} item{selectedDayEvents.length === 1 ? '' : 's'} based on your current filters.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            {selectedDayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events scheduled for this day.</p>
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
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Calendar filters</DialogTitle>
            <DialogDescription>Choose which event types show in your planner and day popout.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {(Object.keys(CALENDAR_MODULE_META) as CalendarEventModule[]).map((module) => (
              <div key={module} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <button type="button" onClick={() => openModuleEditor(module)} aria-label={`Edit ${getModuleLabel(module)} filter`}>
                  <Badge variant="outline" className={cn('border cursor-pointer', CALENDAR_MODULE_META[module].badgeClass)}>
                    {getModuleLabel(module)}
                  </Badge>
                </button>
                <Switch checked={filters[module]} onCheckedChange={(checked) => setFilter(module, checked)} />
              </div>
            ))}
            <div className="pt-2 border-t border-border space-y-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Saved filters</p>
              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-sm font-medium">Current filters</p>
                <Input
                  value={currentFilterName}
                  onChange={(event) => setCurrentFilterName(event.target.value)}
                  placeholder="Filter name"
                />
                <Input
                  value={currentFilterRecipients}
                  onChange={(event) => setCurrentFilterRecipients(event.target.value)}
                  placeholder="Who to notify (+16155551234, +16155550999)"
                />
                <Button type="button" variant="outline" onClick={() => void saveCurrentFilterConfig()}>
                  Save current filter
                </Button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={newFilterPresetName}
                  onChange={(event) => setNewFilterPresetName(event.target.value)}
                  placeholder="Name this filter"
                />
                <Input
                  value={newFilterPresetRecipients}
                  onChange={(event) => setNewFilterPresetRecipients(event.target.value)}
                  placeholder="+16155551234, +16155550999"
                />
                <Button type="button" variant="outline" onClick={createFilterPreset}>
                  Add
                </Button>
              </div>
              {filterPresets.map((preset) => {
                const isActive = activeFilterPresetId === preset.id;
                return (
                  <div key={preset.id} className="rounded-lg border border-border p-2 space-y-2">
                    <Input
                      value={preset.name}
                      onChange={(event) => renameFilterPreset(preset.id, event.target.value)}
                      onBlur={() => commitFilterPresetName(preset.id)}
                    />
                    <Input
                      value={formatPhoneList(preset.reminderRecipients || [])}
                      onChange={(event) => updateFilterPresetRecipients(preset.id, event.target.value)}
                      placeholder="Reminder recipients"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={isActive ? 'default' : 'outline'}
                        onClick={() => applyFilterPreset(preset.id)}
                      >
                        Apply
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => updatePresetFromCurrent(preset.id)}
                      >
                        Update
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteFilterPreset(preset.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
              {filterPresets.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No custom filters yet.
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={moduleEditorOpen} onOpenChange={setModuleEditorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingModule ? `Edit ${getModuleLabel(editingModule)} filter` : 'Edit filter'}
            </DialogTitle>
            <DialogDescription>
              Rename this filter and choose who gets reminder texts from it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Filter name</label>
              <Input
                value={editingModuleName}
                onChange={(event) => setEditingModuleName(event.target.value)}
                placeholder="Filter name"
              />
            </div>
            {editingModule && isSmsFilterModule(editingModule) ? (
              <div className="space-y-1">
                <label className="text-sm font-medium">Reminder recipients</label>
                <Input
                  value={editingModuleRecipients}
                  onChange={(event) => setEditingModuleRecipients(event.target.value)}
                  placeholder="+16155551234, +16155550999"
                />
                <p className="text-xs text-muted-foreground">
                  Numbers in this field get reminder texts for {getModuleLabel(editingModule)}.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Reminder recipient routing is currently available for Meals and Manual filters.
              </p>
            )}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModuleEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveModuleEditor()}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

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
              <Input
                type="date"
                value={draftDate}
                onChange={(e) => {
                  setDraftDate(e.target.value);
                  setDraftTravelMinutes(null);
                  setDraftTrafficMinutes(null);
                  setDraftLeaveByIso(null);
                }}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm">All-day event</span>
              <Switch checked={draftAllDay} onCheckedChange={setDraftAllDay} />
            </div>
            {!draftAllDay && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Start</label>
                  <Input
                    type="time"
                    value={draftTime}
                    onChange={(e) => {
                      setDraftTime(e.target.value);
                      setDraftTravelMinutes(null);
                      setDraftTrafficMinutes(null);
                      setDraftLeaveByIso(null);
                    }}
                  />
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
                onChange={(e) => {
                  setDraftLocation(e.target.value);
                  setDraftTravelMinutes(null);
                  setDraftTrafficMinutes(null);
                  setDraftLeaveByIso(null);
                }}
                placeholder="Address or place"
              />
            </div>
            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Home address (for travel time)</label>
                <Input
                  placeholder="Set your home address"
                  value={draftHomeAddress}
                  onChange={(e) => {
                    setDraftHomeAddress(e.target.value);
                    setDraftTravelMinutes(null);
                    setDraftTrafficMinutes(null);
                    setDraftLeaveByIso(null);
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void saveHomeAddressFromDraft()} disabled={smsSaving}>
                  {smsSaving ? 'Saving...' : 'Save as home address'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void estimateTravelForDraft()}
                  disabled={draftTravelLoading || draftAllDay}
                >
                  {draftTravelLoading ? 'Estimating...' : 'Estimate travel (live traffic)'}
                </Button>
              </div>
              {draftAllDay && <p className="text-xs text-muted-foreground">Set a start time to estimate commute.</p>}
              {draftTravelError && <p className="text-xs text-destructive">{draftTravelError}</p>}
              {draftLeaveByIso && (
                <p className="text-xs text-muted-foreground">
                  Estimated drive: {draftTrafficMinutes || draftTravelMinutes} min
                  {draftTrafficMinutes && draftTravelMinutes && draftTrafficMinutes > draftTravelMinutes
                    ? ` (${draftTrafficMinutes - draftTravelMinutes} min traffic delay)`
                    : ''}
                  . Leave by {format(parseISO(draftLeaveByIso), 'h:mm a')}.
                </p>
              )}
              {draftLeaveByIso && (
                <label className="w-full rounded-md border border-border px-3 py-2 flex items-center justify-between">
                  <span className="text-sm">Text me 10 min before I need to leave</span>
                  <Switch checked={draftLeaveReminderEnabled} onCheckedChange={setDraftLeaveReminderEnabled} />
                </label>
              )}
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
          {!compact && event.recommendedLeaveAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              Leave by {format(parseISO(event.recommendedLeaveAt), 'h:mm a')}
              {event.trafficDurationMinutes
                ? ` (${event.trafficDurationMinutes} min with traffic)`
                : event.travelDurationMinutes
                ? ` (${event.travelDurationMinutes} min)`
                : ''}
            </p>
          )}
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
