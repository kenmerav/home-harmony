const DEMO_MODE_KEY = 'hh_demo_mode_v1';

export function isDemoModeEnabled(): boolean {
  // Demo access is intentionally disabled for public users.
  return false;
}

export function setDemoModeEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  if (enabled) {
    localStorage.removeItem(DEMO_MODE_KEY);
    return;
  }
  localStorage.removeItem(DEMO_MODE_KEY);
}
