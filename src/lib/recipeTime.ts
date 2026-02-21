export function estimateCookMinutes(instructions?: string | null): number | null {
  const text = (instructions || '').toLowerCase();
  if (!text.trim()) return null;

  let totalMinutes = 0;
  const rangesSeen = new Set<string>();

  const addRange = (a: number, b: number, unit: 'min' | 'hour') => {
    const key = `${a}-${b}-${unit}`;
    if (rangesSeen.has(key)) return;
    rangesSeen.add(key);

    const avg = (a + b) / 2;
    totalMinutes += unit === 'hour' ? avg * 60 : avg;
  };

  const addSingle = (n: number, unit: 'min' | 'hour') => {
    const key = `${n}-${unit}`;
    if (rangesSeen.has(key)) return;
    rangesSeen.add(key);
    totalMinutes += unit === 'hour' ? n * 60 : n;
  };

  for (const match of text.matchAll(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|h)\b/g)) {
    addRange(Number(match[1]), Number(match[2]), 'hour');
  }
  for (const match of text.matchAll(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(minutes?|mins?|min|m)\b/g)) {
    addRange(Number(match[1]), Number(match[2]), 'min');
  }
  for (const match of text.matchAll(/\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|h)\b/g)) {
    addSingle(Number(match[1]), 'hour');
  }
  for (const match of text.matchAll(/\b(\d+(?:\.\d+)?)\s*(minutes?|mins?|min|m)\b/g)) {
    addSingle(Number(match[1]), 'min');
  }

  if (totalMinutes <= 0) return null;
  return Math.round(totalMinutes);
}

export function formatCookTime(minutes?: number | null): string | null {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
