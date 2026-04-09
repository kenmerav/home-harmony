import {
  buildIcsCalendar,
  isValidFeedToken,
  normalizeFeedLayer,
  parseFeedPath,
} from '../../supabase/functions/_shared/appleCalendarFeed';

describe('apple calendar feed utilities', () => {
  it('builds valid ICS output with stable UID and escaped text', () => {
    const ics = buildIcsCalendar(
      [
        {
          id: 'event-123',
          title: 'Family, Dinner; Plan',
          description: 'Line 1\\Line 2\nBring snacks',
          location: 'Home, Kitchen',
          startDatetime: '2026-03-10T23:00:00.000Z',
          endDatetime: '2026-03-11T00:00:00.000Z',
          allDay: false,
          timezone: 'America/Chicago',
          layer: 'family',
          updatedAt: '2026-03-08T18:00:00.000Z',
        },
      ],
      'Home Harmony - All Events',
    );

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('UID:event-123@homeharmonyhq');
    expect(ics).toContain('SUMMARY:Family\\, Dinner\\; Plan');
    expect(ics).toContain('DESCRIPTION:Line 1\\\\Line 2\\nBring snacks');
    expect(ics).toContain('LOCATION:Home\\, Kitchen');
    expect(ics).toContain('DTSTART;TZID=America/Chicago:');
    expect(ics).toContain('DTEND;TZID=America/Chicago:');
  });

  it('formats all-day events as VALUE=DATE', () => {
    const ics = buildIcsCalendar(
      [
        {
          id: 'all-day-1',
          title: 'All Day Event',
          startDatetime: '2026-03-12T00:00:00.000Z',
          endDatetime: '2026-03-13T00:00:00.000Z',
          allDay: true,
          timezone: 'UTC',
          layer: 'meals',
        },
      ],
      'Home Harmony - Meals',
    );

    expect(ics).toContain('DTSTART;VALUE=DATE:20260312');
    expect(ics).toContain('DTEND;VALUE=DATE:20260313');
  });

  it('emits cancelled events so subscribed calendars can clear deleted items', () => {
    const ics = buildIcsCalendar(
      [
        {
          id: 'deleted-1',
          title: 'Old Dummy Event',
          startDatetime: '2026-03-12T18:00:00.000Z',
          endDatetime: '2026-03-12T19:00:00.000Z',
          allDay: false,
          layer: 'family',
          updatedAt: '2026-03-10T16:00:00.000Z',
          deletedAt: '2026-03-11T14:15:00.000Z',
          cancelled: true,
        },
      ],
      'Home Harmony - All Events',
      new Date('2026-03-12T12:00:00.000Z'),
    );

    expect(ics).toContain('UID:deleted-1@homeharmonyhq');
    expect(ics).toContain('STATUS:CANCELLED');
    expect(ics).toContain('DTSTAMP:20260311T141500Z');
  });

  it('drops old cancelled events after the retention window so they do not linger forever', () => {
    const ics = buildIcsCalendar(
      [
        {
          id: 'deleted-old-1',
          title: 'Canceled Recurring Item',
          startDatetime: '2026-03-12T18:00:00.000Z',
          endDatetime: '2026-03-12T19:00:00.000Z',
          allDay: false,
          layer: 'family',
          updatedAt: '2026-03-10T16:00:00.000Z',
          deletedAt: '2026-03-11T14:15:00.000Z',
          cancelled: true,
        },
      ],
      'Home Harmony - All Events',
      new Date('2026-04-10T12:00:00.000Z'),
    );

    expect(ics).not.toContain('UID:deleted-old-1@homeharmonyhq');
    expect(ics).not.toContain('STATUS:CANCELLED');
  });

  it('parses tokenized feed path and validates layers', () => {
    const token = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-';
    const parsed = parseFeedPath(`/functions/v1/apple-calendar-feed/calendar/${token}/meals.ics`);

    expect(parsed).toEqual({ token, layer: 'meals' });
    expect(normalizeFeedLayer('unknown-layer')).toBe('all');
    expect(isValidFeedToken(token)).toBe(true);
    expect(isValidFeedToken('short-token')).toBe(false);
  });
});
