import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDays,
  addHours,
  addMinutes,
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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
  SMS_REMINDER_MODULES,
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
  updateManualCalendarEvent,
} from '@/lib/calendarStore';
import {
  CalendarFilterPreset,
  CalendarFilterPresetColor,
  CalendarModuleFilterSettings,
  createCalendarFilterPreset,
  DEFAULT_CALENDAR_FILTER_PRESET_COLOR,
  formatCalendarLayerLabel,
  normalizeCalendarFilterName,
} from '@/lib/calendarFilters';
import {
  loadCommonDepartureAddresses,
  loadDepartureAddressProfile,
  normalizeAddressForCompare,
} from '@/lib/departureAddresses';
import { CALENDAR_MODULE_META, fetchCalendarEventsForMonth } from '@/lib/calendarFeed';
import {
  buildRecurringStartDates,
  CalendarRecurrenceDraft,
  getRecurrencePattern,
  RECURRING_OCCURRENCE_COUNT,
  RecurrencePreset,
  RecurrenceUnit,
} from '@/lib/calendarRecurrence';
import { useAccountCalendarPreferences } from '@/hooks/useAccountCalendarPreferences';
import { updateTaskFromCalendarRelatedId } from '@/lib/taskStore';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';

type PlannerMode = 'month' | 'twoWeek';
type DepartureSource = 'home' | 'work' | 'other' | `saved:${string}`;

const BUILT_IN_FILTER_MODULES: CalendarEventModule[] = ['manual', 'meals', 'tasks', 'chores', 'workouts', 'reminders'];
const VISIBLE_FILTER_MODULES: CalendarEventModule[] = ['manual', 'meals', 'tasks', 'chores', 'workouts', 'reminders'];
const FILTER_COLOR_SWATCHES = [
  '#5A8F72',
  '#8A78E8',
  '#4D86E5',
  '#54B888',
  '#C98A2E',
  '#D35F82',
  '#E76F51',
  '#2A9D8F',
  '#7D8FA8',
  '#7C5A45',
];

function normalizeHexColor(input: string, fallback = DEFAULT_CALENDAR_FILTER_PRESET_COLOR): string {
  const compact = input.trim();
  if (!compact) return fallback;
  const withHash = compact.startsWith('#') ? compact : `#${compact}`;
  if (/^#[0-9a-fA-F]{3}$/.test(withHash)) {
    const [r, g, b] = withHash.slice(1).split('');
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(withHash)) return withHash.toUpperCase();
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = normalizeHexColor(hex, '');
  if (!/^#[0-9A-F]{6}$/.test(normalized)) return null;
  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ];
}

function filterBadgeStyle(color: string): CSSProperties {
  const [r, g, b] = hexToRgb(color) || [90, 143, 114];
  return {
    borderColor: `rgba(${r}, ${g}, ${b}, 0.48)`,
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.16)`,
    color: `rgb(${Math.round(r * 0.72)}, ${Math.round(g * 0.72)}, ${Math.round(b * 0.72)})`,
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
  const startLabel = format(start, 'h:mm a');
  if (event.recommendedLeaveAt) return `Arrive by ${startLabel}`;
  if (!event.endsAt) return startLabel;
  return `${startLabel} - ${format(parseISO(event.endsAt), 'h:mm a')}`;
}

function allDayDraftDateFromStartsAt(startsAt: string): string {
  const utcMidnight = /^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.000)?Z$/i.exec((startsAt || '').trim());
  if (utcMidnight?.[1]) return utcMidnight[1];
  return format(parseISO(startsAt), 'yyyy-MM-dd');
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

function normalizeCalendarLayerName(value: string | null | undefined): string {
  const compact = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!compact || compact === 'manual') return 'family';
  return compact;
}

function normalizeAddressKey(value?: string | null): string {
  return normalizeAddressForCompare(value);
}

function isSameOrContainedAddress(candidateKey: string, referenceKey: string): boolean {
  if (!candidateKey || !referenceKey) return false;
  return candidateKey === referenceKey
    || candidateKey.includes(referenceKey)
    || referenceKey.includes(candidateKey);
}

function isSmsFilterModule(module: CalendarEventModule): module is SmsReminderModule {
  return SMS_REMINDER_MODULES.includes(module as SmsReminderModule);
}

function withTime(baseDate: Date, hhmm: string): Date {
  const [hourRaw, minuteRaw] = hhmm.split(':');
  const date = new Date(baseDate);
  date.setHours(Number.parseInt(hourRaw, 10) || 0, Number.parseInt(minuteRaw, 10) || 0, 0, 0);
  return date;
}

function defaultLayerForModule(module: CalendarEventModule): string {
  return module === 'manual' ? 'family' : module;
}

function isCalendarModule(value: string): value is CalendarEventModule {
  return (BUILT_IN_FILTER_MODULES as string[]).includes(value);
}

export default function CalendarPlannerPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    filters,
    setFilters,
    filterPresets,
    setFilterPresets,
    moduleFilterSettings,
    setModuleFilterSettings,
  } = useAccountCalendarPreferences(user?.id);
  const [mode, setMode] = useState<PlannerMode>('month');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dayDetailOpen, setDayDetailOpen] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterPresetDialogOpen, setFilterPresetDialogOpen] = useState(false);
  const [editingFilterPresetId, setEditingFilterPresetId] = useState<string | null>(null);
  const [filterPresetDraftName, setFilterPresetDraftName] = useState('');
  const [filterPresetDraftRecipients, setFilterPresetDraftRecipients] = useState('');
  const [filterPresetDraftColor, setFilterPresetDraftColor] = useState<CalendarFilterPresetColor>(
    DEFAULT_CALENDAR_FILTER_PRESET_COLOR,
  );
  const [calendarIntegrationsExpanded, setCalendarIntegrationsExpanded] = useState(false);
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
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEventSource, setEditingEventSource] = useState<CalendarEvent | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftLocation, setDraftLocation] = useState('');
  const [draftDepartureSource, setDraftDepartureSource] = useState<DepartureSource>('home');
  const [draftHomeAddress, setDraftHomeAddress] = useState('');
  const [draftTravelMinutes, setDraftTravelMinutes] = useState<number | null>(null);
  const [draftTrafficMinutes, setDraftTrafficMinutes] = useState<number | null>(null);
  const [draftLeaveByIso, setDraftLeaveByIso] = useState<string | null>(null);
  const [draftEventReminderEnabled, setDraftEventReminderEnabled] = useState(false);
  const [draftEventReminderLeadMinutes, setDraftEventReminderLeadMinutes] = useState('0');
  const [draftLeaveReminderEnabled, setDraftLeaveReminderEnabled] = useState(false);
  const [draftLeaveReminderLeadMinutes, setDraftLeaveReminderLeadMinutes] = useState('10');
  const [draftTravelLoading, setDraftTravelLoading] = useState(false);
  const [draftTravelError, setDraftTravelError] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [draftTime, setDraftTime] = useState('18:00');
  const [draftEndTime, setDraftEndTime] = useState('');
  const [draftAllDay, setDraftAllDay] = useState(false);
  const [draftModule, setDraftModule] = useState<CalendarEventModule>('manual');
  const [draftCalendarLayer, setDraftCalendarLayer] = useState('family');
  const [draftRecurringEnabled, setDraftRecurringEnabled] = useState(false);
  const [draftRecurringPreset, setDraftRecurringPreset] = useState<RecurrencePreset>('weekly');
  const [draftCustomRecurringInterval, setDraftCustomRecurringInterval] = useState('2');
  const [draftCustomRecurringUnit, setDraftCustomRecurringUnit] = useState<RecurrenceUnit>('week');
  const [departureAddressProfile, setDepartureAddressProfile] = useState(() =>
    loadDepartureAddressProfile(user?.id),
  );
  const [commonDepartureAddresses, setCommonDepartureAddresses] = useState<string[]>(() =>
    loadCommonDepartureAddresses(user?.id),
  );

  useEffect(() => {
    setGooglePrefsState(getGoogleCalendarPrefs(user?.id));
  }, [user?.id]);

  useEffect(() => {
    setDepartureAddressProfile(loadDepartureAddressProfile(user?.id));
    setCommonDepartureAddresses(loadCommonDepartureAddresses(user?.id));
  }, [user?.id]);

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

  const resetDraftTravelEstimate = useCallback(() => {
    setDraftTravelMinutes(null);
    setDraftTrafficMinutes(null);
    setDraftLeaveByIso(null);
    setDraftTravelError(null);
  }, []);

  const savedDepartureAddresses = useMemo(() => {
    const unique = new Map<string, string>();
    const addAddress = (value?: string | null) => {
      const next = (value || '').trim();
      const key = normalizeAddressKey(next);
      if (key && !unique.has(key)) unique.set(key, next.replace(/\s+/g, ' '));
    };
    addAddress(smsPrefs.home_address || departureAddressProfile.homeAddress);
    addAddress(smsPrefs.work_address || departureAddressProfile.workAddress);
    commonDepartureAddresses.forEach((address) => addAddress(address));
    return Array.from(unique.values());
  }, [
    commonDepartureAddresses,
    departureAddressProfile.homeAddress,
    departureAddressProfile.workAddress,
    smsPrefs.home_address,
    smsPrefs.work_address,
  ]);

  const addressAutocompleteOptions = useMemo(() => {
    const unique = new Map<string, string>();
    const addAddress = (value?: string | null) => {
      const next = (value || '').trim();
      const key = normalizeAddressKey(next);
      if (key && !unique.has(key)) unique.set(key, next.replace(/\s+/g, ' '));
    };
    savedDepartureAddresses.forEach((address) => addAddress(address));
    events.forEach((event) => addAddress(event.location));
    return Array.from(unique.values());
  }, [events, savedDepartureAddresses]);

  const addressForSource = useCallback(
    (source: DepartureSource): string => {
      if (source === 'work') return (smsPrefs.work_address || departureAddressProfile.workAddress || '').trim();
      if (source === 'home') return (smsPrefs.home_address || departureAddressProfile.homeAddress || '').trim();
      if (source.startsWith('saved:')) return decodeURIComponent(source.slice('saved:'.length)).trim();
      return '';
    },
    [
      departureAddressProfile.homeAddress,
      departureAddressProfile.workAddress,
      smsPrefs.home_address,
      smsPrefs.work_address,
    ],
  );

  const departureOptions = useMemo(() => {
    const homeAddress = (smsPrefs.home_address || departureAddressProfile.homeAddress || '').trim();
    const workAddress = (smsPrefs.work_address || departureAddressProfile.workAddress || '').trim();
    const homeKey = normalizeAddressKey(homeAddress);
    const workKey = normalizeAddressKey(workAddress);
    const options: Array<{ value: DepartureSource; label: string }> = [
      { value: 'home', label: 'Home' },
      { value: 'work', label: 'Work' },
    ];

    savedDepartureAddresses.forEach((address) => {
      const addressKey = normalizeAddressKey(address);
      if (
        !addressKey
        || isSameOrContainedAddress(addressKey, homeKey)
        || isSameOrContainedAddress(addressKey, workKey)
      ) {
        return;
      }
      options.push({
        value: `saved:${encodeURIComponent(address)}` as DepartureSource,
        label: address,
      });
    });

    options.push({ value: 'other', label: 'Other' });
    return options;
  }, [
    departureAddressProfile.homeAddress,
    departureAddressProfile.workAddress,
    savedDepartureAddresses,
    smsPrefs.home_address,
    smsPrefs.work_address,
  ]);

  const applyDepartureSource = useCallback(
    (source: DepartureSource, preserveOther = true) => {
      setDraftDepartureSource(source);
      setDraftHomeAddress((prev) => {
        if (source === 'other') return preserveOther ? prev : '';
        return addressForSource(source);
      });
      resetDraftTravelEstimate();
    },
    [addressForSource, resetDraftTravelEstimate],
  );

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      setDepartureAddressProfile(loadDepartureAddressProfile(user?.id));
      setCommonDepartureAddresses(loadCommonDepartureAddresses(user?.id));
    };
    window.addEventListener('homehub:departure-addresses-updated', handler);
    return () => window.removeEventListener('homehub:departure-addresses-updated', handler);
  }, [user?.id]);

  const customManualLayerSet = useMemo(
    () => new Set(filterPresets.map((preset) => normalizeCalendarLayerName(preset.name))),
    [filterPresets],
  );

  const enabledManualLayerSet = useMemo(
    () => new Set(filterPresets.filter((preset) => preset.enabled).map((preset) => normalizeCalendarLayerName(preset.name))),
    [filterPresets],
  );

  const assignFilterOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [{ value: 'custom:family', label: 'Family' }];
    const seen = new Set<string>();

    seen.add('custom:family');
    VISIBLE_FILTER_MODULES.forEach((module) => {
      const label = moduleFilterSettings.labelOverrides[module]?.trim() || CALENDAR_MODULE_META[module].label;
      const value = `module:${module}`;
      if (seen.has(value)) return;
      seen.add(value);
      options.push({ value, label });
    });

    filterPresets.forEach((preset) => {
      const label = normalizeCalendarFilterName(preset.name);
      const layer = normalizeCalendarLayerName(label);
      if (layer === 'family') return;
      const value = `custom:${layer}`;
      if (seen.has(value)) return;
      seen.add(value);
      options.push({ value, label });
    });

    return options;
  }, [filterPresets, moduleFilterSettings.labelOverrides]);

  const manualLayerLabelMap = useMemo(() => {
    const next = new Map<string, string>([['family', 'Family']]);
    filterPresets.forEach((preset) => {
      const label = normalizeCalendarFilterName(preset.name);
      next.set(normalizeCalendarLayerName(label), label);
    });
    return next;
  }, [filterPresets]);

  const draftAssignFilterValue = useMemo(() => {
    if (draftModule !== 'manual') return `module:${draftModule}`;
    const layer = normalizeCalendarLayerName(draftCalendarLayer || 'family');
    if (layer === 'family') return 'custom:family';
    const customValue = `custom:${layer}`;
    return assignFilterOptions.some((option) => option.value === customValue) ? customValue : 'custom:family';
  }, [assignFilterOptions, draftCalendarLayer, draftModule]);

  const applyAssignFilterValue = (value: string) => {
    if (value.startsWith('module:')) {
      const moduleValue = value.slice('module:'.length).trim().toLowerCase();
      if (isCalendarModule(moduleValue)) {
        setDraftModule(moduleValue);
        setDraftCalendarLayer(defaultLayerForModule(moduleValue));
      }
      return;
    }

    if (value.startsWith('custom:')) {
      const layer = normalizeCalendarLayerName(value.slice('custom:'.length));
      setDraftModule('manual');
      setDraftCalendarLayer(layer || 'family');
    }
  };

  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        if (!filters[event.module]) return false;
        if (event.module !== 'manual') return true;

        const layer = normalizeCalendarLayerName(event.calendarLayer);
        if (!customManualLayerSet.has(layer)) return true;
        return enabledManualLayerSet.has(layer);
      }),
    [events, filters, customManualLayerSet, enabledManualLayerSet],
  );

  const monthGridDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    const days: Date[] = [];
    let cursor = start;
    while (cursor <= end) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return days;
  }, [currentMonth]);

  const twoWeekDays = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 0 });
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
    setEditingEventId(null);
    setEditingEventSource(null);
    setDraftDate(format(selectedDate, 'yyyy-MM-dd'));
    setDraftTime('18:00');
    setDraftEndTime('');
    setDraftAllDay(false);
    const firstEnabledPreset = filterPresets.find((preset) => preset.enabled);
    const fallbackPreset = filterPresets[0];
    setDraftModule('manual');
    setDraftCalendarLayer(
      normalizeCalendarLayerName(firstEnabledPreset?.name || fallbackPreset?.name || 'family'),
    );
    setDraftRecurringEnabled(false);
    setDraftRecurringPreset('weekly');
    setDraftCustomRecurringInterval('2');
    setDraftCustomRecurringUnit('week');
    setDraftTitle('');
    setDraftDescription('');
    setDraftLocation('');
    const defaultDepartureSource: DepartureSource =
      smsPrefs.default_departure_source === 'work'
        ? 'work'
        : smsPrefs.default_departure_source === 'custom'
        ? 'other'
        : 'home';
    applyDepartureSource(defaultDepartureSource, false);
    setDraftHomeAddress(defaultDepartureSource === 'other' ? '' : addressForSource(defaultDepartureSource));
    setDraftEventReminderEnabled(true);
    setDraftEventReminderLeadMinutes('0');
    setDraftLeaveReminderEnabled(false);
    setDraftLeaveReminderLeadMinutes('10');
    setAddDialogOpen(true);
  };

  const openEditDialog = (event: CalendarEvent) => {
    setEditingEventSource(event);
    setEditingEventId(event.source === 'manual' ? event.id : null);
    const start = parseISO(event.startsAt);
    const end = event.endsAt ? parseISO(event.endsAt) : null;
    setDraftTitle(event.title);
    setDraftDescription(event.description || '');
    setDraftLocation(event.location || '');
    setDraftDate(event.allDay ? allDayDraftDateFromStartsAt(event.startsAt) : format(start, 'yyyy-MM-dd'));
    setDraftAllDay(!!event.allDay);
    setDraftTime(event.allDay ? '18:00' : format(start, 'HH:mm'));
    setDraftEndTime(event.allDay || !end ? '' : format(end, 'HH:mm'));
    setDraftModule(event.source === 'manual' ? event.module : 'manual');
    setDraftCalendarLayer(
      normalizeCalendarLayerName(event.source === 'manual' ? event.calendarLayer || defaultLayerForModule(event.module) : 'family'),
    );
    setDraftRecurringEnabled(false);
    setDraftRecurringPreset('weekly');
    setDraftCustomRecurringInterval('2');
    setDraftCustomRecurringUnit('week');

    const homeAddress = (smsPrefs.home_address || '').trim();
    const workAddress = (smsPrefs.work_address || '').trim();
    const currentFrom = (event.travelFromAddress || '').trim();
    const source: DepartureSource =
      currentFrom && homeAddress && currentFrom === homeAddress
        ? 'home'
        : currentFrom && workAddress && currentFrom === workAddress
        ? 'work'
        : currentFrom
        ? (`saved:${encodeURIComponent(currentFrom)}` as DepartureSource)
        : 'other';
    setDraftDepartureSource(source);
    setDraftHomeAddress(currentFrom || addressForSource(source));
    setDraftTravelMinutes(event.travelDurationMinutes ?? null);
    setDraftTrafficMinutes(event.trafficDurationMinutes ?? null);
    setDraftLeaveByIso(event.recommendedLeaveAt || null);
    setDraftEventReminderEnabled(!!event.eventReminderEnabled);
    setDraftEventReminderLeadMinutes(String(event.eventReminderLeadMinutes ?? 0));
    setDraftLeaveReminderEnabled(!!event.leaveReminderEnabled);
    setDraftLeaveReminderLeadMinutes(String(event.leaveReminderLeadMinutes || 10));
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
    const selectedOrigin =
      draftDepartureSource === 'other'
        ? draftHomeAddress.trim()
        : addressForSource(draftDepartureSource);
    const origin = selectedOrigin || draftHomeAddress.trim();
    const destination = draftLocation.trim();
    if (!origin || !destination) {
      setDraftTravelError('Add both leaving-from address and location to estimate travel time.');
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

  const createManualEvent = () => {
    if (!draftTitle.trim()) {
      toast({ title: 'Add a title first', variant: 'destructive' });
      return;
    }
    if (draftModule === 'manual' && !draftCalendarLayer.trim()) {
      toast({ title: 'Choose a filter first', variant: 'destructive' });
      return;
    }
    const day = parseISO(`${draftDate}T00:00:00`);
    const selectedTravelFromAddress = (
      draftDepartureSource === 'other'
        ? draftHomeAddress.trim()
        : addressForSource(draftDepartureSource)
    ) || undefined;
    const selectedLayer = normalizeCalendarLayerName(
      draftModule === 'manual'
        ? draftCalendarLayer
        : defaultLayerForModule(draftModule),
    );
    const eventReminderLeadMinutes = Math.max(
      0,
      Math.min(240, Number.parseInt(draftEventReminderLeadMinutes || '0', 10) || 0),
    );
    const leaveReminderLeadMinutes = Math.max(
      5,
      Math.min(120, Number.parseInt(draftLeaveReminderLeadMinutes || '10', 10) || 10),
    );

    const baseStartDate = draftAllDay ? withTime(day, '12:00') : withTime(day, draftTime || '18:00');
    const baseEndDate = !draftAllDay && draftEndTime ? withTime(day, draftEndTime) : null;
    if (!draftAllDay && baseEndDate && baseEndDate.getTime() <= baseStartDate.getTime()) {
      toast({ title: 'End time must be after start time', variant: 'destructive' });
      return;
    }
    const endOffsetMs =
      baseEndDate && Number.isFinite(baseEndDate.getTime()) && baseEndDate.getTime() > baseStartDate.getTime()
        ? baseEndDate.getTime() - baseStartDate.getTime()
        : null;
    const leaveLeadMs =
      draftLeaveByIso && Number.isFinite(parseISO(draftLeaveByIso).getTime())
        ? Math.max(0, baseStartDate.getTime() - parseISO(draftLeaveByIso).getTime())
        : null;

    const buildPayloadForStart = (startDate: Date) => ({
      title: draftTitle,
      description: draftDescription,
      module: draftModule,
      calendarLayer: selectedLayer,
      location: draftLocation.trim() || undefined,
      eventReminderEnabled: draftEventReminderEnabled,
      eventReminderLeadMinutes,
      travelFromAddress: selectedTravelFromAddress,
      travelMode: 'driving' as const,
      travelDurationMinutes: draftTravelMinutes,
      trafficDurationMinutes: draftTrafficMinutes,
      recommendedLeaveAt:
        leaveLeadMs !== null ? new Date(startDate.getTime() - leaveLeadMs).toISOString() : null,
      leaveReminderEnabled: draftLeaveReminderEnabled,
      leaveReminderLeadMinutes,
      startsAt: startDate.toISOString(),
      endsAt: endOffsetMs !== null ? new Date(startDate.getTime() + endOffsetMs).toISOString() : undefined,
      allDay: draftAllDay,
    });
    const recurrenceDraft: CalendarRecurrenceDraft = {
      preset: draftRecurringPreset,
      customInterval: draftCustomRecurringInterval,
      customUnit: draftCustomRecurringUnit,
    };
    const recurrenceLabel = getRecurrencePattern(recurrenceDraft).label;
    const recurringStartDates = draftRecurringEnabled
      ? buildRecurringStartDates(baseStartDate, recurrenceDraft, RECURRING_OCCURRENCE_COUNT)
      : [baseStartDate];
    const editingSource = editingEventSource;
    if (editingSource?.source === 'task') {
      const relatedId = editingSource.relatedId || editingSource.id;
      const updatedTask = updateTaskFromCalendarRelatedId(
        relatedId,
        {
          title: draftTitle,
          notes: draftDescription,
          date: draftDate,
          time: draftAllDay ? undefined : draftTime || '09:00',
        },
        user?.id,
      );
      if (!updatedTask) {
        toast({ title: 'Could not update task event', variant: 'destructive' });
        return;
      }
      setAddDialogOpen(false);
      setEditingEventId(null);
      setEditingEventSource(null);
      toast({ title: 'Task event updated' });
      void refreshEvents();
      return;
    }

    if (editingSource && editingSource.source !== 'manual') {
      toast({
        title: 'Edit this in its source module',
        description: 'For now, chores, workouts, meals, and reminders are edited from their own pages.',
      });
      return;
    }

    if (editingEventId) {
      const updated = updateManualCalendarEvent(editingEventId, buildPayloadForStart(baseStartDate), user?.id);
      if (!updated) {
        toast({ title: 'Could not update event', variant: 'destructive' });
        return;
      }
      if (draftRecurringEnabled) {
        recurringStartDates.slice(1).forEach((occurrenceStart) => {
          addManualCalendarEvent(buildPayloadForStart(occurrenceStart), user?.id);
        });
      }
    } else {
      if (draftRecurringEnabled) {
        recurringStartDates.forEach((occurrenceStart) => {
          addManualCalendarEvent(buildPayloadForStart(occurrenceStart), user?.id);
        });
        toast({
          title: `${recurringStartDates.length} recurring events added`,
          description: `Repeats ${recurrenceLabel} for the next ${recurringStartDates.length - 1} occurrences.`,
        });
      } else {
        addManualCalendarEvent(buildPayloadForStart(baseStartDate), user?.id);
      }
    }
    setAddDialogOpen(false);
    setEditingEventId(null);
    setEditingEventSource(null);
    if (editingEventId) {
      toast({
        title: draftRecurringEnabled ? 'Event updated and repeats added' : 'Event updated',
        description: draftRecurringEnabled
          ? `This event now repeats ${recurrenceLabel}.`
          : undefined,
      });
    }
    if (!editingEventId && !draftRecurringEnabled) toast({ title: 'Event added' });
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

  const getEventBadgeLabel = useCallback(
    (event: CalendarEvent): string => {
      if (event.module !== 'manual') return getModuleLabel(event.module);
      const layer = normalizeCalendarLayerName(event.calendarLayer || 'family');
      return manualLayerLabelMap.get(layer) || formatCalendarLayerLabel(layer);
    },
    [getModuleLabel, manualLayerLabelMap],
  );

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
    const nextOverrides: CalendarModuleFilterSettings['labelOverrides'] = { ...moduleFilterSettings.labelOverrides };

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
    return (Object.entries(preset.modules) as Array<[CalendarEventModule, boolean]>)
      .filter(([, enabled]) => enabled)
      .map(([moduleName]) => moduleName)
      .filter((moduleName): moduleName is SmsReminderModule =>
        SMS_REMINDER_MODULES.includes(moduleName as SmsReminderModule),
      );
  };

  const applyPresetRecipientsToSms = async (preset: CalendarFilterPreset) => {
    const recipients = preset.reminderRecipients;
    if (!recipients.length) return;
    const smsModules = smsModulesForPreset(preset);
    if (smsModules.length === 0) {
      toast({
        title: 'No SMS-enabled modules in this filter',
        description: 'Enable at least one visible module in this filter to route reminder texts.',
      });
      return;
    }

    const nextModuleRecipients = { ...smsPrefs.module_recipients };
    SMS_REMINDER_MODULES.forEach((moduleName) => {
      if (smsModules.includes(moduleName)) {
        nextModuleRecipients[moduleName] = recipients;
      }
    });

    const nextPrefs: SmsPreferences = {
      ...smsPrefs,
      include_modules: [...new Set([...smsPrefs.include_modules, ...smsModules])],
      module_recipients: nextModuleRecipients,
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

  const nextFilterNameSuggestion = () => {
    const existing = new Set(filterPresets.map((preset) => normalizeCalendarFilterName(preset.name).toLowerCase()));
    let nextIndex = filterPresets.length + 1;
    let suggestedName = `Filter ${nextIndex}`;
    while (existing.has(suggestedName.toLowerCase())) {
      nextIndex += 1;
      suggestedName = `Filter ${nextIndex}`;
    }
    return suggestedName;
  };

  const openAddFilterPresetDialog = () => {
    setEditingFilterPresetId(null);
    setFilterPresetDraftName(nextFilterNameSuggestion());
    setFilterPresetDraftRecipients('');
    setFilterPresetDraftColor(DEFAULT_CALENDAR_FILTER_PRESET_COLOR);
    setFilterPresetDialogOpen(true);
  };

  const openEditFilterPresetDialog = (presetId: string) => {
    const preset = filterPresets.find((item) => item.id === presetId);
    if (!preset) return;
    setEditingFilterPresetId(presetId);
    setFilterPresetDraftName(preset.name);
    setFilterPresetDraftRecipients(formatPhoneList(preset.reminderRecipients || []));
    setFilterPresetDraftColor(normalizeHexColor(preset.color || DEFAULT_CALENDAR_FILTER_PRESET_COLOR));
    setFilterPresetDialogOpen(true);
  };

  const saveFilterPresetDialog = () => {
    const normalizedName = normalizeCalendarFilterName(filterPresetDraftName || nextFilterNameSuggestion());
    const normalizedLayer = normalizeCalendarLayerName(normalizedName);
    const recipients = parsePhoneList(filterPresetDraftRecipients);
    const color = normalizeHexColor(filterPresetDraftColor);

    if (normalizedLayer === 'family') {
      toast({
        title: 'Family is already built in',
        description: 'Choose another name for a custom filter.',
        variant: 'destructive',
      });
      return;
    }

    const duplicatePreset = filterPresets.find(
      (preset) => preset.id !== editingFilterPresetId && normalizeCalendarLayerName(preset.name) === normalizedLayer,
    );
    if (duplicatePreset) {
      toast({
        title: 'Filter name already used',
        description: 'Choose a different name so each custom filter stays unique.',
        variant: 'destructive',
      });
      return;
    }

    if (editingFilterPresetId) {
      setFilterPresets((prev) =>
        prev.map((preset) =>
          preset.id === editingFilterPresetId
            ? { ...preset, name: normalizedName, reminderRecipients: recipients, color }
            : preset,
        ),
      );
      const editedPreset = filterPresets.find((preset) => preset.id === editingFilterPresetId);
      if (editedPreset?.enabled) {
        void applyPresetRecipientsToSms({
          ...editedPreset,
          name: normalizedName,
          reminderRecipients: recipients,
          color,
        });
      }
      toast({ title: 'Filter updated' });
      setFilterPresetDialogOpen(false);
      return;
    }

    const nextPreset = createCalendarFilterPreset(
      normalizedName,
      filters,
      filterPresets.length,
      recipients,
      color,
    );
    nextPreset.enabled = true;
    setFilterPresets((prev) => [...prev, nextPreset]);
    toast({ title: `Filter "${nextPreset.name}" saved` });
    setFilterPresetDialogOpen(false);
    void applyPresetRecipientsToSms(nextPreset);
  };

  const enableFilterPreset = (presetId: string) => {
    const preset = filterPresets.find((item) => item.id === presetId);
    if (!preset) return;
    setFilterPresets((prev) =>
      prev.map((item) => (item.id === presetId ? { ...item, enabled: true } : item)),
    );
    void applyPresetRecipientsToSms(preset);
  };

  const deleteFilterPreset = (presetId: string) => {
    setFilterPresets((prev) => prev.filter((preset) => preset.id !== presetId));
    toast({ title: 'Filter removed' });
  };

  const toggleFilterPreset = (presetId: string, enabled: boolean) => {
    if (enabled) {
      enableFilterPreset(presetId);
      return;
    }
    setFilterPresets((prev) =>
      prev.map((item) => (item.id === presetId ? { ...item, enabled: false } : item)),
    );
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
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
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
                    badgeLabel={getEventBadgeLabel(event)}
                    event={event}
                    googleEnabled={googlePrefs.enabled}
                    onEdit={event.source === 'reminder' ? undefined : openEditDialog}
                    onDelete={event.source === 'manual' ? removeManualEvent : undefined}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Filters" subtitle="Show/hide event types">
            <div className="space-y-2">
              {VISIBLE_FILTER_MODULES.map((module) => (
                <div key={module} className="flex items-center justify-between">
                  <button type="button" onClick={() => openModuleEditor(module)} aria-label={`Edit ${getModuleLabel(module)} filter`}>
                    <Badge variant="outline" className={cn('border cursor-pointer', CALENDAR_MODULE_META[module].badgeClass)}>
                      {getModuleLabel(module)}
                    </Badge>
                  </button>
                  <Switch checked={filters[module]} onCheckedChange={(checked) => setFilter(module, checked)} />
                </div>
              ))}
              {filterPresets.map((preset) => {
                const isActive = !!preset.enabled;
                return (
                  <div key={preset.id} className="flex items-center justify-between">
                    <button type="button" onClick={() => openEditFilterPresetDialog(preset.id)} aria-label={`Edit ${preset.name} filter`}>
                      <Badge
                        variant="outline"
                        className="border cursor-pointer"
                        style={filterBadgeStyle(preset.color || DEFAULT_CALENDAR_FILTER_PRESET_COLOR)}
                      >
                        {preset.name}
                      </Badge>
                    </button>
                    <Switch
                      checked={isActive}
                      onCheckedChange={(checked) => toggleFilterPreset(preset.id, checked)}
                      aria-label={`Toggle ${preset.name} filter`}
                    />
                  </div>
                );
              })}
              <div className="flex justify-end pt-1">
                <Button type="button" variant="outline" size="sm" onClick={openAddFilterPresetDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Filter
                </Button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Upcoming" subtitle="Next 10 scheduled items">
            <div className="space-y-2">
              {upcomingEvents.length === 0 && <p className="text-sm text-muted-foreground">No upcoming items.</p>}
              {upcomingEvents.map((event) => (
                <EventRow
                  key={event.id}
                  badgeLabel={getEventBadgeLabel(event)}
                  event={event}
                  googleEnabled={googlePrefs.enabled}
                  compact
                  onEdit={event.source === 'reminder' ? undefined : openEditDialog}
                  onDelete={event.source === 'manual' ? removeManualEvent : undefined}
                />
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="mt-6">
        <SectionCard
          title="Calendar integrations"
          subtitle="Plan in Home Harmony, then display in your calendar app"
          action={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCalendarIntegrationsExpanded((prev) => !prev)}
              aria-expanded={calendarIntegrationsExpanded}
              aria-controls="calendar-planner-integrations-panel"
              aria-label={calendarIntegrationsExpanded ? 'Collapse calendar integrations' : 'Expand calendar integrations'}
            >
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', calendarIntegrationsExpanded && 'rotate-180')}
              />
            </Button>
          }
        >
          {calendarIntegrationsExpanded ? (
            <div id="calendar-planner-integrations-panel" className="space-y-3">
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Google Calendar</p>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/calendar/connect-apple?platform=google">Connect Google</Link>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Subscribe once with your private URL. Home Harmony updates the feed; Google Calendar reflects it.
                </p>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Apple Calendar</p>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/calendar/connect-apple?platform=apple">Connect Apple</Link>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  One-way subscribed feeds: edit in Home Harmony, and Apple Calendar updates automatically.
                </p>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Google quick-add links (optional)</span>
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
                  Optional helper link from each event. Subscription setup above is the main sync path.
                </p>
              </div>
            </div>
          ) : (
            <p id="calendar-planner-integrations-panel" className="text-sm text-muted-foreground">
              Expand to manage Apple Calendar, Google Calendar, and quick-add sync options.
            </p>
          )}
        </SectionCard>
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
                    badgeLabel={getEventBadgeLabel(event)}
                    event={event}
                    googleEnabled={googlePrefs.enabled}
                    onEdit={event.source === 'reminder' ? undefined : openEditDialog}
                    onDelete={event.source === 'manual' ? removeManualEvent : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Calendar filters</DialogTitle>
            <DialogDescription>Choose which event types show in your planner and day popout.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {VISIBLE_FILTER_MODULES.map((module) => (
              <div key={module} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <button type="button" onClick={() => openModuleEditor(module)} aria-label={`Edit ${getModuleLabel(module)} filter`}>
                  <Badge variant="outline" className={cn('border cursor-pointer', CALENDAR_MODULE_META[module].badgeClass)}>
                    {getModuleLabel(module)}
                  </Badge>
                </button>
                <Switch checked={filters[module]} onCheckedChange={(checked) => setFilter(module, checked)} />
              </div>
            ))}
            {filterPresets.map((preset) => {
              const isActive = !!preset.enabled;
              return (
                <div key={preset.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <button type="button" onClick={() => openEditFilterPresetDialog(preset.id)} aria-label={`Edit ${preset.name} filter`}>
                    <Badge
                      variant="outline"
                      className="border cursor-pointer"
                      style={filterBadgeStyle(preset.color || DEFAULT_CALENDAR_FILTER_PRESET_COLOR)}
                    >
                      {preset.name}
                    </Badge>
                  </button>
                  <Switch
                    checked={isActive}
                    onCheckedChange={(checked) => toggleFilterPreset(preset.id, checked)}
                    aria-label={`Toggle ${preset.name} filter`}
                  />
                </div>
              );
            })}
            <div className="flex justify-end pt-1">
              <Button type="button" variant="outline" size="sm" onClick={openAddFilterPresetDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Filter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={filterPresetDialogOpen} onOpenChange={setFilterPresetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{editingFilterPresetId ? 'Edit filter' : 'Add filter'}</DialogTitle>
            <DialogDescription>
              {editingFilterPresetId
                ? 'Update filter name and who should get reminder texts when this filter is applied.'
                : 'Create a filter from your current toggle selections.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Filter name</label>
              <Input
                value={filterPresetDraftName}
                onChange={(event) => setFilterPresetDraftName(event.target.value)}
                placeholder="Family plan"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Reminder recipients (optional)</label>
              <Textarea
                value={filterPresetDraftRecipients}
                onChange={(event) => setFilterPresetDraftRecipients(event.target.value)}
                placeholder={'+16155551234\n+16155550999'}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">Put each phone number on its own line.</p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Color</label>
              <div className="flex items-center gap-3">
                <Input
                  type="color"
                  value={normalizeHexColor(filterPresetDraftColor)}
                  onChange={(event) => setFilterPresetDraftColor(normalizeHexColor(event.target.value))}
                  className="h-10 w-14 p-1"
                  aria-label="Choose filter color"
                />
                <Input
                  value={filterPresetDraftColor}
                  onChange={(event) => setFilterPresetDraftColor(event.target.value)}
                  onBlur={() => setFilterPresetDraftColor(normalizeHexColor(filterPresetDraftColor))}
                  placeholder="#5A8F72"
                  className="w-32"
                />
                <Badge variant="outline" className="border" style={filterBadgeStyle(filterPresetDraftColor)}>
                  Preview
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {FILTER_COLOR_SWATCHES.map((color) => {
                  const isSelected = normalizeHexColor(filterPresetDraftColor) === normalizeHexColor(color);
                  return (
                    <button
                      key={color}
                      type="button"
                      className={cn(
                        'h-6 w-6 rounded-full border-2 transition',
                        isSelected ? 'ring-2 ring-primary/50' : 'border-border',
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setFilterPresetDraftColor(color)}
                      aria-label={`Use color ${color}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            {editingFilterPresetId ? (
              <Button
                variant="ghost"
                onClick={() => {
                  deleteFilterPreset(editingFilterPresetId);
                  setFilterPresetDialogOpen(false);
                }}
              >
                Delete
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setFilterPresetDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveFilterPresetDialog()}>
              {editingFilterPresetId ? 'Save changes' : 'Add filter'}
            </Button>
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
                <Textarea
                  value={editingModuleRecipients}
                  onChange={(event) => setEditingModuleRecipients(event.target.value)}
                  placeholder={'+16155551234\n+16155550999'}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Put each phone number on its own line for {getModuleLabel(editingModule)} reminders.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Reminder recipient routing is available for all calendar filter modules.
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

      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) {
            setEditingEventId(null);
            setEditingEventSource(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-4xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingEventSource ? 'Edit planner event' : 'Add planner event'}
            </DialogTitle>
            <DialogDescription>
              {editingEventSource ? 'Update this calendar item.' : 'Create a calendar event for this planner.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">Title</label>
              <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="Event title" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Assign filter</label>
              <Select value={draftAssignFilterValue} onValueChange={applyAssignFilterValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose filter" />
                </SelectTrigger>
                <SelectContent>
                  {assignFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={draftDate}
                onChange={(e) => {
                  setDraftDate(e.target.value);
                  resetDraftTravelEstimate();
                }}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3 md:col-span-2">
              <span className="text-sm">All-day event</span>
              <Switch checked={draftAllDay} onCheckedChange={setDraftAllDay} />
            </div>
            {!draftAllDay && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    {draftLocation ? 'Arrive by / start time' : 'Start time'}
                  </label>
                  <Input
                    type="time"
                    value={draftTime}
                    onChange={(e) => {
                      setDraftTime(e.target.value);
                      resetDraftTravelEstimate();
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">End (optional)</label>
                  <Input type="time" value={draftEndTime} onChange={(e) => setDraftEndTime(e.target.value)} />
                </div>
              </div>
            )}
            <div className="space-y-2 rounded-lg border border-border p-3 md:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Scheduled reminder</span>
                <Switch checked={draftEventReminderEnabled} onCheckedChange={setDraftEventReminderEnabled} />
              </div>
              {draftEventReminderEnabled ? (
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Reminder timing</label>
                  <Select value={draftEventReminderLeadMinutes} onValueChange={setDraftEventReminderLeadMinutes}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Choose minutes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">At event time</SelectItem>
                      <SelectItem value="10">10 minutes before</SelectItem>
                      <SelectItem value="15">15 minutes before</SelectItem>
                      <SelectItem value="30">30 minutes before</SelectItem>
                      <SelectItem value="45">45 minutes before</SelectItem>
                      <SelectItem value="60">1 hour before</SelectItem>
                      <SelectItem value="90">1.5 hours before</SelectItem>
                      <SelectItem value="120">2 hours before</SelectItem>
                      <SelectItem value="180">3 hours before</SelectItem>
                      <SelectItem value="240">4 hours before</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Sends at event start time by default, or earlier if you choose.
              </p>
            </div>
            <div className="space-y-2 rounded-lg border border-border p-3 md:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Recurring event</span>
                <Switch
                  checked={draftRecurringEnabled}
                  onCheckedChange={setDraftRecurringEnabled}
                  disabled={Boolean(editingEventSource && editingEventSource.source !== 'manual')}
                />
              </div>
              {editingEventSource && editingEventSource.source !== 'manual' ? (
                <p className="text-xs text-muted-foreground">
                  Recurrence for this item is managed in its source module.
                </p>
              ) : draftRecurringEnabled ? (
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Repeat</label>
                  <Select
                    value={draftRecurringPreset}
                    onValueChange={(value) => setDraftRecurringPreset(value as RecurrencePreset)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Choose cadence" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  {draftRecurringPreset === 'custom' ? (
                    <div className="grid grid-cols-[110px_1fr] gap-2">
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={draftCustomRecurringInterval}
                        onChange={(event) => setDraftCustomRecurringInterval(event.target.value)}
                        placeholder="2"
                      />
                      <Select
                        value={draftCustomRecurringUnit}
                        onValueChange={(value) => setDraftCustomRecurringUnit(value as RecurrenceUnit)}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Choose unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="day">Days</SelectItem>
                          <SelectItem value="week">Weeks</SelectItem>
                          <SelectItem value="month">Months</SelectItem>
                          <SelectItem value="year">Years</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {editingEventId
                      ? `Updates this event and adds the next ${RECURRING_OCCURRENCE_COUNT - 1} repeats.`
                      : `Adds this event plus the next ${RECURRING_OCCURRENCE_COUNT - 1} occurrences.`}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">This event will be created once.</p>
              )}
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">Notes (optional)</label>
              <Input
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                placeholder="Add a short note"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">Location (optional)</label>
              <Input
                list="planner-address-suggestions"
                value={draftLocation}
                onChange={(e) => {
                  setDraftLocation(e.target.value);
                  resetDraftTravelEstimate();
                }}
                placeholder="Address or place"
              />
              <datalist id="planner-address-suggestions">
                {addressAutocompleteOptions.map((address) => (
                  <option key={`planner-location-${address}`} value={address} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Leaving from</label>
                <Select
                  value={draftDepartureSource}
                  onValueChange={(value) => applyDepartureSource(value as DepartureSource, true)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose location" />
                  </SelectTrigger>
                  <SelectContent>
                    {departureOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {draftDepartureSource === 'other' ? (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Other address</label>
                  <Input
                    list="planner-address-suggestions"
                    placeholder="Enter departure address"
                    value={draftHomeAddress}
                    onChange={(e) => {
                      setDraftHomeAddress(e.target.value);
                      resetDraftTravelEstimate();
                    }}
                  />
                </div>
              ) : null}
              {draftDepartureSource !== 'other' && !addressForSource(draftDepartureSource) ? (
                <p className="text-xs text-muted-foreground">
                  Set this address in Settings to enable commute estimates.
                </p>
              ) : null}
              {draftDepartureSource !== 'other' && addressForSource(draftDepartureSource) ? (
                <p className="text-xs text-muted-foreground">
                  Using: {addressForSource(draftDepartureSource)}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void estimateTravelForDraft()}
                  disabled={draftTravelLoading || draftAllDay}
                >
                  {draftTravelLoading ? 'Estimating...' : 'Estimate leave time'}
                </Button>
              </div>
              {draftAllDay && <p className="text-xs text-muted-foreground">Set an arrival time to estimate commute.</p>}
              {draftTravelError && <p className="text-xs text-destructive">{draftTravelError}</p>}
              {!draftAllDay && draftLocation && (
                <p className="text-xs text-muted-foreground">
                  Set the time you want to arrive, then Home Harmony will calculate when to leave.
                </p>
              )}
              {draftLeaveByIso && (
                <p className="text-xs text-muted-foreground">
                  Arrive by {format(withTime(parseISO(`${draftDate}T00:00:00`), draftTime || '18:00'), 'h:mm a')}.{' '}
                  Estimated drive: {draftTrafficMinutes || draftTravelMinutes} min
                  {draftTrafficMinutes && draftTravelMinutes && draftTrafficMinutes > draftTravelMinutes
                    ? ` (${draftTrafficMinutes - draftTravelMinutes} min traffic delay)`
                    : ''}
                  . Leave by {format(parseISO(draftLeaveByIso), 'h:mm a')}.
                </p>
              )}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Leave-by reminder</span>
                  <Switch checked={draftLeaveReminderEnabled} onCheckedChange={setDraftLeaveReminderEnabled} />
                </div>
                {draftLeaveReminderEnabled ? (
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Reminder timing</label>
                    <Select value={draftLeaveReminderLeadMinutes} onValueChange={setDraftLeaveReminderLeadMinutes}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Choose minutes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 minutes before leave time</SelectItem>
                        <SelectItem value="10">10 minutes before leave time</SelectItem>
                        <SelectItem value="15">15 minutes before leave time</SelectItem>
                        <SelectItem value="30">30 minutes before leave time</SelectItem>
                        <SelectItem value="45">45 minutes before leave time</SelectItem>
                        <SelectItem value="60">1 hour before leave time</SelectItem>
                      </SelectContent>
                    </Select>
                    {!draftLeaveByIso ? (
                      <p className="text-xs text-muted-foreground">
                        Estimate leave time first so Home Harmony can calculate leave-by.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createManualEvent}>
              <Plus className="mr-2 h-4 w-4" />
              {editingEventSource ? 'Save event' : 'Add event'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function EventRow({
  badgeLabel,
  event,
  googleEnabled,
  compact,
  onEdit,
  onDelete,
}: {
  badgeLabel: string;
  event: CalendarEvent;
  googleEnabled: boolean;
  compact?: boolean;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (id: string) => void;
}) {
  const canEdit = Boolean(onEdit);
  const handleRowEdit = () => {
    if (!onEdit) return;
    onEdit(event);
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-border p-3',
        compact && 'py-2',
        canEdit && 'cursor-pointer transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
      role={canEdit ? 'button' : undefined}
      tabIndex={canEdit ? 0 : undefined}
      onClick={canEdit ? handleRowEdit : undefined}
      onKeyDown={
        canEdit
          ? (eventKey) => {
              if (eventKey.key === 'Enter' || eventKey.key === ' ') {
                eventKey.preventDefault();
                handleRowEdit();
              }
            }
          : undefined
      }
      aria-label={canEdit ? `Edit ${event.title}` : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{event.title}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{eventTimeLabel(event)}</span>
            <Badge variant="outline" className={cn('border', CALENDAR_MODULE_META[event.module].badgeClass)}>
              {badgeLabel}
            </Badge>
          </div>
          {event.description && !compact && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{event.description}</p>}
          {event.location && !compact && <p className="mt-1 text-xs text-muted-foreground">Location: {event.location}</p>}
          {!compact && event.recommendedLeaveAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              Arrive by {format(parseISO(event.startsAt), event.allDay ? 'MMM d' : 'h:mm a')}
              {' · '}
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
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                onEdit(event);
              }}
              aria-label={`Edit ${event.title}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {googleEnabled && (
            <Button asChild variant="ghost" size="icon" className="h-8 w-8">
              <a
                href={buildGoogleEventUrl(event)}
                target="_blank"
                rel="noreferrer"
                onClick={(clickEvent) => clickEvent.stopPropagation()}
                aria-label={`Open ${event.title} in Google Calendar`}
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                onDelete(event.id);
              }}
              aria-label={`Delete ${event.title}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
