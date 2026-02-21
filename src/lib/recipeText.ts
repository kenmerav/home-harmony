export function normalizeRecipeInstructions(input?: string | null): string {
  const raw = String(input || '').trim();
  if (!raw) return '';

  // Some imported recipes persisted instructions as a JSON array string.
  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const lines = parsed
          .map((step) => String(step || '').trim())
          .filter(Boolean);
        if (lines.length > 0) {
          return lines.map((line, idx) => `${idx + 1}. ${line}`).join('\n\n');
        }
      }
    } catch {
      // Fall through to raw content if parsing fails.
    }
  }

  return raw;
}

const quantityToken =
  '(?:\\d+(?:\\.\\d+)?|\\d+\\/\\d+|\\d+\\s+\\d+\\/\\d+)\\s*(?:g|kg|oz|lb|lbs|cup|cups|tbsp|tsp|tablespoon|tablespoons|teaspoon|teaspoons|clove|cloves|can|cans|packet|packets|egg|eggs)?\\b';

function splitMergedIngredientLine(line: string): string[] {
  const text = line
    .replace(/\u00a0/g, ' ')
    .replace(/[•]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return [];
  if (/^(ingredients?|garnish|sauce|pasta|vegetables?)\s*:$/i.test(text)) return [];
  if (/^back to table of contents/i.test(text)) return [];

  const splitPoints: number[] = [];
  const regex = new RegExp(quantityToken, 'gi');
  let match: RegExpExecArray | null = regex.exec(text);
  while (match) {
    splitPoints.push(match.index);
    match = regex.exec(text);
  }

  if (splitPoints.length <= 1) {
    return text.split(/\s*;\s*/).map((part) => part.trim()).filter(Boolean);
  }

  const out: string[] = [];
  for (let i = 0; i < splitPoints.length; i += 1) {
    const start = splitPoints[i];
    const end = i + 1 < splitPoints.length ? splitPoints[i + 1] : text.length;
    const part = text.slice(start, end).trim();
    if (part) out.push(part);
  }
  return out;
}

function capitalizeIngredient(line: string): string {
  const cleaned = line
    .replace(/\s+,/g, ',')
    .replace(/\s+\./g, '.')
    .replace(/\s+\)/g, ')')
    .replace(/\(\s+/g, '(')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function normalizeRecipeIngredients(input?: string[] | string | null): string[] {
  if (!input) return [];
  const source = Array.isArray(input) ? input : String(input).split(/\n+/);
  const expanded = source.flatMap((line) => splitMergedIngredientLine(String(line || '')));
  const normalized = expanded.map(capitalizeIngredient).filter(Boolean);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const item of normalized) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}
