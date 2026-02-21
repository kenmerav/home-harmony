const DEMO_MODE_KEY = 'hh_demo_mode_v1';

export function isDemoModeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(DEMO_MODE_KEY) === '1';
}

export function setDemoModeEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  if (enabled) localStorage.setItem(DEMO_MODE_KEY, '1');
  else localStorage.removeItem(DEMO_MODE_KEY);
}
