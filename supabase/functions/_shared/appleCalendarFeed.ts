export const FEED_LAYERS = [
  'all',
  'family',
  'meals',
  'kids',
  'deliveries',
  'manual',
  'tasks',
  'workouts',
  'reminders',
] as const;

export type FeedLayer = (typeof FEED_LAYERS)[number];

export interface IcsFeedEvent {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startDatetime: string;
  endDatetime?: string | null;
  allDay: boolean;
  timezone?: string | null;
  layer?: string | null;
  module?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
  cancelled?: boolean;
}

// Keep cancelled items in the feed briefly so subscribed calendars can see the
// delete signal, but do not leave them around long enough to feel permanent.
const CANCELLED_EVENT_RETENTION_MS = 2 * 60 * 60 * 1000;

export function isChoreFeedEvent(event: Pick<IcsFeedEvent, 'layer' | 'module'>): boolean {
  return String(event.layer || '').trim().toLowerCase() === 'chores'
    || String(event.module || '').trim().toLowerCase() === 'chores';
}

const FEED_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

export function isValidFeedToken(token: string): boolean {
  return FEED_TOKEN_PATTERN.test(token);
}

export function normalizeFeedLayer(input: string | null | undefined): FeedLayer {
  const value = String(input || '').trim().toLowerCase();
  if ((FEED_LAYERS as readonly string[]).includes(value)) {
    return value as FeedLayer;
  }
  return 'all';
}

export function parseFeedPath(pathname: string): { token: string; layer: FeedLayer } | null {
  const path = pathname.replace(/\/+$/, '');
  const match = path.match(/\/calendar\/([A-Za-z0-9_-]{32,128})\/([a-z-]+)\.ics$/i);
  if (!match) return null;
  const [, token, layerRaw] = match;
  if (!isValidFeedToken(token)) return null;
  return {
    token,
    layer: normalizeFeedLayer(layerRaw),
  };
}

export function escapeIcsText(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function foldIcsLine(line: string): string {
  if (line.length <= 73) return line;
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < line.length) {
    chunks.push(line.slice(cursor, cursor + 73));
    cursor += 73;
  }
  return chunks.map((chunk, idx) => (idx === 0 ? chunk : ` ${chunk}`)).join('\r\n');
}

function toUtcToken(date: Date): string {
  const year = date.getUTCFullYear().toString().padStart(4, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  const hour = date.getUTCHours().toString().padStart(2, '0');
  const minute = date.getUTCMinutes().toString().padStart(2, '0');
  const second = date.getUTCSeconds().toString().padStart(2, '0');
  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}

function toSequence(date: Date): number {
  const time = date.getTime();
  if (!Number.isFinite(time) || time <= 0) return 0;
  return Math.max(0, Math.floor(time / 1000));
}

function isValidTimeZone(value: string | null | undefined): value is string {
  if (!value || typeof value !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function formatPartsInZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const byType = new Map<string, string>();
  for (const part of parts) {
    if (part.type !== 'literal') byType.set(part.type, part.value);
  }
  return {
    year: byType.get('year') || '1970',
    month: byType.get('month') || '01',
    day: byType.get('day') || '01',
    hour: byType.get('hour') || '00',
    minute: byType.get('minute') || '00',
    second: byType.get('second') || '00',
  };
}

function toDateTokenInZone(date: Date, timeZone: string): string {
  const parts = formatPartsInZone(date, timeZone);
  return `${parts.year}${parts.month}${parts.day}`;
}

function toDateTimeTokenInZone(date: Date, timeZone: string): string {
  const parts = formatPartsInZone(date, timeZone);
  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
}

function plusOneDayDateToken(dateToken: string): string {
  const year = Number.parseInt(dateToken.slice(0, 4), 10);
  const month = Number.parseInt(dateToken.slice(4, 6), 10);
  const day = Number.parseInt(dateToken.slice(6, 8), 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return dateToken;
  }
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + 1);
  const nextYear = utc.getUTCFullYear().toString().padStart(4, '0');
  const nextMonth = (utc.getUTCMonth() + 1).toString().padStart(2, '0');
  const nextDay = utc.getUTCDate().toString().padStart(2, '0');
  return `${nextYear}${nextMonth}${nextDay}`;
}

function sanitizeLayer(layer: string | null | undefined): string {
  const value = String(layer || 'family').trim().toUpperCase();
  return value || 'FAMILY';
}

function shouldKeepCancelledEvent(event: IcsFeedEvent, referenceTimeMs: number): boolean {
  if (!(event.cancelled || event.deletedAt)) return true;

  const deletedAtMs = event.deletedAt ? new Date(event.deletedAt).getTime() : Number.NaN;
  if (Number.isFinite(deletedAtMs)) {
    return referenceTimeMs - deletedAtMs <= CANCELLED_EVENT_RETENTION_MS;
  }

  const updatedAtMs = event.updatedAt ? new Date(event.updatedAt).getTime() : Number.NaN;
  if (Number.isFinite(updatedAtMs)) {
    return referenceTimeMs - updatedAtMs <= CANCELLED_EVENT_RETENTION_MS;
  }

  const endMs = event.endDatetime ? new Date(event.endDatetime).getTime() : new Date(event.startDatetime).getTime();
  if (Number.isFinite(endMs)) {
    return referenceTimeMs - endMs <= CANCELLED_EVENT_RETENTION_MS;
  }

  return false;
}

export function buildIcsCalendar(events: IcsFeedEvent[], calendarName: string, now = new Date()): string {
  const referenceTimeMs = now.getTime();
  const sorted = [...events]
    .filter((event) => shouldKeepCancelledEvent(event, referenceTimeMs))
    .sort((a, b) => {
    if (a.startDatetime === b.startDatetime) return a.id.localeCompare(b.id);
    return a.startDatetime.localeCompare(b.startDatetime);
  });

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Home Harmony//Apple Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'REFRESH-INTERVAL;VALUE=DURATION:PT5M',
    'X-PUBLISHED-TTL:PT5M',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
  ];

  for (const event of sorted) {
    const start = new Date(event.startDatetime);
    if (!Number.isFinite(start.getTime())) continue;

    const timezone = isValidTimeZone(event.timezone) ? event.timezone : null;
    const updatedAt = event.deletedAt ? new Date(event.deletedAt) : event.updatedAt ? new Date(event.updatedAt) : new Date();
    const dtstamp = Number.isFinite(updatedAt.getTime()) ? toUtcToken(updatedAt) : toUtcToken(new Date());
    const lastModified = Number.isFinite(updatedAt.getTime()) ? toUtcToken(updatedAt) : dtstamp;
    const sequence = Number.isFinite(updatedAt.getTime()) ? toSequence(updatedAt) : 0;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${escapeIcsText(`${event.id}@homeharmonyhq`)}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`LAST-MODIFIED:${lastModified}`);
    lines.push(`SEQUENCE:${sequence}`);

    if (event.allDay) {
      const startDate = timezone ? toDateTokenInZone(start, timezone) : toUtcToken(start).slice(0, 8);
      const rawEnd = event.endDatetime ? new Date(event.endDatetime) : new Date(start.getTime() + 24 * 60 * 60 * 1000);
      const endDateBase = Number.isFinite(rawEnd.getTime())
        ? (timezone ? toDateTokenInZone(rawEnd, timezone) : toUtcToken(rawEnd).slice(0, 8))
        : plusOneDayDateToken(startDate);
      const endDate = endDateBase > startDate ? endDateBase : plusOneDayDateToken(startDate);

      lines.push(`DTSTART;VALUE=DATE:${startDate}`);
      lines.push(`DTEND;VALUE=DATE:${endDate}`);
    } else {
      const rawEnd = event.endDatetime ? new Date(event.endDatetime) : new Date(start.getTime() + 60 * 60 * 1000);
      const end = Number.isFinite(rawEnd.getTime()) && rawEnd.getTime() > start.getTime()
        ? rawEnd
        : new Date(start.getTime() + 60 * 60 * 1000);

      if (timezone) {
        lines.push(`DTSTART;TZID=${timezone}:${toDateTimeTokenInZone(start, timezone)}`);
        lines.push(`DTEND;TZID=${timezone}:${toDateTimeTokenInZone(end, timezone)}`);
      } else {
        lines.push(`DTSTART:${toUtcToken(start)}`);
        lines.push(`DTEND:${toUtcToken(end)}`);
      }
    }

    lines.push(`SUMMARY:${escapeIcsText(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    if (event.cancelled || event.deletedAt) {
      lines.push('STATUS:CANCELLED');
      lines.push('TRANSP:TRANSPARENT');
    }
    lines.push(`CATEGORIES:${escapeIcsText(sanitizeLayer(event.layer))}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  const folded = lines.map((line) => foldIcsLine(line));
  return `${folded.join('\r\n')}\r\n`;
}
