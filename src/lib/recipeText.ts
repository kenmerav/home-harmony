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

const fractionMap: Record<string, string> = {
  '¼': '1/4',
  '½': '1/2',
  '¾': '3/4',
  '⅓': '1/3',
  '⅔': '2/3',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
};

function normalizeFractions(input: string): string {
  let out = input;
  for (const [glyph, frac] of Object.entries(fractionMap)) {
    out = out.replaceAll(glyph, ` ${frac} `);
  }
  return out.replace(/\s+/g, ' ').trim();
}

const unitToken =
  '(?:g|kg|oz|lb|lbs|cup|cups|tbsp|tsp|tablespoon|tablespoons|teaspoon|teaspoons|ml|l|clove|cloves|can|cans|packet|packets|item|items)';
const numberToken = '(?:\\d+(?:\\.\\d+)?|\\d+\\/\\d+|\\d+\\s+\\d+\\/\\d+)';

function isQuantityOnlyLine(line: string): boolean {
  return new RegExp(`^\\(?${numberToken}\\)?\\s*${unitToken}\\)?$`, 'i').test(line.trim());
}

function parseAltQuantityPrefixLine(line: string): { qty: string; rest: string } | null {
  const match = line
    .trim()
    .match(new RegExp(`^\\(?(${numberToken})\\)?\\s*(${unitToken})\\)\\s*(.+)$`, 'i'));
  if (!match) return null;
  return {
    qty: `${match[1]} ${match[2]}`.replace(/\s+/g, ' ').trim(),
    rest: match[3].trim(),
  };
}

function startsWithPercentDescriptor(line: string): boolean {
  return /^\d+\s*%\s*[a-z]/i.test(line.trim());
}

function endsWithLooseDescriptor(line: string): boolean {
  return /(plain|small|medium|large|boneless|skinless|ground|diced|chopped)\s*$/i.test(line.trim());
}

function looksLikeStandaloneDescriptor(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (!lower) return true;
  if (['red', 'green', 'yellow', 'orange', 'ground', 'plain', 'small', 'medium', 'large'].includes(lower)) {
    return true;
  }
  if (/^%+$/.test(lower)) return true;
  if (/(^|\s)cont(?:inued)?\.?$/.test(lower)) return true;
  return false;
}

function repairIngredientFragments(parts: string[]): string[] {
  const lines = parts
    .map((line) => normalizeFractions(String(line || '')).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const out: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    let current = lines[i];
    if (!current) continue;

    if (isQuantityOnlyLine(current) && i + 1 < lines.length) {
      const next = lines[i + 1];
      const alt = parseAltQuantityPrefixLine(next);
      if (alt) {
        current = `${current} (${alt.qty}) ${alt.rest}`.replace(/\s+/g, ' ').trim();
        i += 1;

        if (i + 1 < lines.length) {
          const maybeTail = lines[i + 1];
          if (startsWithPercentDescriptor(maybeTail) || endsWithLooseDescriptor(current)) {
            current = `${current} ${maybeTail}`.replace(/\s+/g, ' ').trim();
            i += 1;
          }
        }
      } else if (!isQuantityOnlyLine(next)) {
        current = `${current} ${next}`.replace(/\s+/g, ' ').trim();
        i += 1;

        if (i + 1 < lines.length) {
          const maybeTail = lines[i + 1];
          if (startsWithPercentDescriptor(maybeTail) || endsWithLooseDescriptor(current)) {
            current = `${current} ${maybeTail}`.replace(/\s+/g, ' ').trim();
            i += 1;
          }
        }
      }
    } else {
      const alt = parseAltQuantityPrefixLine(current);
      if (alt && i > 0 && isQuantityOnlyLine(lines[i - 1])) {
        continue;
      }
      if (alt) {
        current = `(${alt.qty}) ${alt.rest}`.replace(/\s+/g, ' ').trim();
      }

      if (out.length > 0 && (startsWithPercentDescriptor(current) || endsWithLooseDescriptor(out[out.length - 1]))) {
        out[out.length - 1] = `${out[out.length - 1]} ${current}`.replace(/\s+/g, ' ').trim();
        continue;
      }
    }

    out.push(current);
  }

  return out;
}

function splitMergedIngredientLine(line: string): string[] {
  const text = normalizeFractions(line)
    .replace(/\u00a0/g, ' ')
    .replace(/[•]/g, ' ')
    .replace(/^\d+\.\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return [];
  if (/^(ingredients?|garnish|sauce|pasta|vegetables?)\s*:$/i.test(text)) return [];
  if (/^back to table of contents/i.test(text)) return [];
  if (/^for\s+[a-z][a-z\s&/-]{1,40}:$/i.test(text)) return [];

  const splitPoints: number[] = [];
  const regex = new RegExp(quantityToken, 'gi');
  let match: RegExpExecArray | null = regex.exec(text);
  while (match) {
    splitPoints.push(match.index);
    match = regex.exec(text);
  }

  if (splitPoints.length === 1 && splitPoints[0] > 2) {
    const left = text.slice(0, splitPoints[0]).trim().replace(/[,:-]+$/, '').trim();
    const right = text.slice(splitPoints[0]).trim();
    if (left && right && !/\d/.test(left)) {
      return [left, right];
    }
  }

  if (splitPoints.length <= 1) {
    const semicolonParts = text.split(/\s*;\s*/).map((part) => part.trim()).filter(Boolean);
    if (semicolonParts.length > 1) return semicolonParts;

    const commaParts = text.split(',').map((part) => part.trim()).filter(Boolean);
    const simpleCommaList =
      commaParts.length > 1 &&
      commaParts.length <= 3 &&
      commaParts.every((part) => part.split(/\s+/).length <= 4) &&
      commaParts.every((part) => !/\d/.test(part));
    if (simpleCommaList) return commaParts;

    return [text];
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
  let cleaned = line
    .replace(/\s+,/g, ',')
    .replace(/\s+\./g, '.')
    .replace(/\s+\)/g, ')')
    .replace(/\(\s+/g, '(')
    .replace(/^[-*•\s]+/, '')
    .replace(/^%+\s*/, '')
    .replace(/\bback to table of contents?\b.*$/i, '')
    .replace(/\bcont(?:inued)?\.?$/i, '')
    .replace(/\(e\.g\.[^)]*\)?/gi, '')
    .replace(/\b(as needed|if needed|to taste|optional|for garnish)\b.*$/i, '')
    .replace(/[,:-]\s*$/, '')
    .replace(/\s+\(\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (/^\d*%?\s*plain greek$/i.test(cleaned) || /^\d*%?\s*greek$/i.test(cleaned)) {
    cleaned = 'Greek yogurt';
  } else if (/^\d*%?\s*milk$/i.test(cleaned)) {
    const percent = cleaned.match(/^\s*(\d+)\s*%/)?.[1];
    cleaned = percent ? `${percent}% milk` : 'Milk';
  }

  if (!cleaned) return '';
  if (looksLikeStandaloneDescriptor(cleaned)) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function normalizeRecipeName(input?: string | null): string {
  const raw = String(input || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return 'Untitled Recipe';

  const cleaned = raw
    .replace(/\bback to table of contents?\b.*$/i, '')
    .replace(/[|•]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return 'Untitled Recipe';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function normalizeRecipeIngredients(input?: string[] | string | null): string[] {
  if (!input) return [];
  const source = Array.isArray(input) ? input : String(input).split(/\n+/);
  const expanded = source.flatMap((line) => splitMergedIngredientLine(String(line || '')));
  const repaired = repairIngredientFragments(expanded);
  const normalized = repaired.map(capitalizeIngredient).filter(Boolean);
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
