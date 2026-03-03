export type CtaVariantId = 'a' | 'b';

export interface CtaVariant {
  id: CtaVariantId;
  label: string;
  subcopy: string;
}

export interface FreeToolsCtaEvent {
  type: 'impression' | 'primary_click' | 'lead_capture';
  slug: string;
  variant: CtaVariantId;
  at: string;
}

export interface FreeToolsLeadCapture {
  email: string;
  slug: string;
  variant: CtaVariantId;
  capturedAt: string;
}

export const CTA_VARIANTS: CtaVariant[] = [
  {
    id: 'a',
    label: 'Start Free Trial',
    subcopy: 'Unlock saved plans, reminders, and family collaboration.',
  },
  {
    id: 'b',
    label: 'Build My Home Plan',
    subcopy: 'Turn this free output into a working weekly system.',
  },
];

export const CTA_ASSIGNMENT_PREFIX = 'hh:free-tools:cta-variant:';
export const CTA_EVENT_KEY = 'hh:free-tools:cta-events';
export const LEAD_CAPTURE_KEY = 'hh:free-tools:lead-captures';

function getStorageItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
}

function setStorageItem(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
}

function parseJsonArray<T>(raw: string | null, fallback: T[] = []): T[] {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function isVariantId(value: unknown): value is CtaVariantId {
  return value === 'a' || value === 'b';
}

export function getAssignedVariant(slug: string): CtaVariantId | null {
  const raw = getStorageItem(`${CTA_ASSIGNMENT_PREFIX}${slug}`);
  return isVariantId(raw) ? raw : null;
}

export function assignVariant(slug: string): CtaVariantId {
  const existing = getAssignedVariant(slug);
  if (existing) return existing;
  const assigned: CtaVariantId = Math.random() < 0.5 ? 'a' : 'b';
  setStorageItem(`${CTA_ASSIGNMENT_PREFIX}${slug}`, assigned);
  return assigned;
}

export function loadCtaEvents(): FreeToolsCtaEvent[] {
  return parseJsonArray<FreeToolsCtaEvent>(getStorageItem(CTA_EVENT_KEY));
}

export function loadLeadCaptures(): FreeToolsLeadCapture[] {
  return parseJsonArray<FreeToolsLeadCapture>(getStorageItem(LEAD_CAPTURE_KEY));
}

export function recordCtaEvent(event: FreeToolsCtaEvent): void {
  const events = loadCtaEvents();
  events.push(event);
  setStorageItem(CTA_EVENT_KEY, JSON.stringify(events.slice(-250)));
}

export function recordLeadCapture(entry: FreeToolsLeadCapture): void {
  const captures = loadLeadCaptures();
  captures.push(entry);
  setStorageItem(LEAD_CAPTURE_KEY, JSON.stringify(captures.slice(-250)));
}

export function clearFreeToolsTracking(slugs: string[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(CTA_EVENT_KEY);
  window.localStorage.removeItem(LEAD_CAPTURE_KEY);
  for (const slug of slugs) {
    window.localStorage.removeItem(`${CTA_ASSIGNMENT_PREFIX}${slug}`);
  }
}

export function formatVariantLabel(variant: CtaVariantId | null): string {
  if (!variant) return '-';
  return variant.toUpperCase();
}

export function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  if (name.length <= 2) return `${name[0] || '*'}*@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
}
