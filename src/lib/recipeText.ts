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

export function hasRecipeInstructions(input?: string | null): boolean {
  return normalizeRecipeInstructions(input).trim().length > 0;
}

const quantityToken =
  '(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?)\\s*(?:g|gram|grams|kg|oz|ounce|ounces|lb|lbs|pound|pounds|cup|cups|tbsp|tsp|tablespoon|tablespoons|teaspoon|teaspoons|clove|cloves|can|cans|packet|packets|egg|eggs)?\\b';

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
  out = out.replace(/\b(\d{2,3})\s*\/\s*(\d{1,2})\b/g, '$1/$2');
  return out.replace(/\s+/g, ' ').trim();
}

const unitToken =
  '(?:g|gram|grams|kg|oz|ounce|ounces|lb|lbs|pound|pounds|cup|cups|tbsp|tsp|tablespoon|tablespoons|teaspoon|teaspoons|ml|l|clove|cloves|can|cans|packet|packets|item|items)';
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

function parseParentheticalQuantityLine(line: string): { qtyNumber: string; qtyUnit: string; rest: string } | null {
  const match = line
    .trim()
    .match(new RegExp(`^\\(\\s*(${numberToken})\\s*(${unitToken})\\s*\\)\\s*(.*)$`, 'i'));
  if (!match) return null;
  return {
    qtyNumber: match[1].trim(),
    qtyUnit: match[2].trim(),
    rest: match[3].trim(),
  };
}

function takeLeadingNumberAndRest(line: string): { number: string; rest: string } | null {
  const match = line.trim().match(/^(\d+(?:\.\d+)?)(?:\s+|$)(.*)$/);
  if (!match) return null;
  return {
    number: match[1],
    rest: (match[2] || '').trim(),
  };
}

function joinSplitFractionLines(lines: string[]): string[] {
  const merged: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const current = lines[i].trim();
    if (!current) continue;

    const wholeMatch = current.match(/^(\d+)$/);
    const fractionPrefixNext = lines[i + 1]?.trim().match(/^(\d+)\/$/);
    const thirdWithNumber = lines[i + 2] ? takeLeadingNumberAndRest(lines[i + 2]) : null;

    // Repair OCR splits like: "1" + "1/" + "2 cups milk" => "1 1/2 cups milk"
    if (wholeMatch && fractionPrefixNext && thirdWithNumber) {
      const qty = `${wholeMatch[1]} ${fractionPrefixNext[1]}/${thirdWithNumber.number}`;
      const rebuilt = `${qty}${thirdWithNumber.rest ? ` ${thirdWithNumber.rest}` : ''}`.trim();
      merged.push(rebuilt);
      i += 2;
      continue;
    }

    const fractionPrefixCurrent = current.match(/^(\d+)\/$/);
    const nextWithNumber = lines[i + 1] ? takeLeadingNumberAndRest(lines[i + 1]) : null;

    // Repair OCR splits like: "3/" + "4 cup yogurt" => "3/4 cup yogurt"
    if (fractionPrefixCurrent && nextWithNumber) {
      const qty = `${fractionPrefixCurrent[1]}/${nextWithNumber.number}`;
      const rebuilt = `${qty}${nextWithNumber.rest ? ` ${nextWithNumber.rest}` : ''}`.trim();
      merged.push(rebuilt);
      i += 1;
      continue;
    }

    const trailingFractionWithPrefix = current.match(/^(.+?)\s+(\d+)\/$/);
    if (trailingFractionWithPrefix && lines[i + 1]) {
      const prefix = trailingFractionWithPrefix[1].trim();
      const numerator = trailingFractionWithPrefix[2].trim();
      const parenthetical = parseParentheticalQuantityLine(lines[i + 1]);
      if (parenthetical) {
        let rest = parenthetical.rest;
        let consumedExtra = 1;
        if (!rest && lines[i + 2]) {
          rest = lines[i + 2].trim();
          consumedExtra = 2;
        }
        const rebuilt = `${prefix} (${numerator}/${parenthetical.qtyNumber} ${parenthetical.qtyUnit})${rest ? ` ${rest}` : ''}`
          .replace(/\s+/g, ' ')
          .trim();
        merged.push(rebuilt);
        i += consumedExtra;
        continue;
      }

      const nextWithNumberForRatio = takeLeadingNumberAndRest(lines[i + 1]);
      if (nextWithNumberForRatio) {
        const rebuilt = `${prefix} ${numerator}/${nextWithNumberForRatio.number}${nextWithNumberForRatio.rest ? ` ${nextWithNumberForRatio.rest}` : ''}`
          .replace(/\s+/g, ' ')
          .trim();
        merged.push(rebuilt);
        i += 1;
        continue;
      }
    }

    const nextFractionLine = lines[i + 1]?.trim().match(/^(\d+\/\d+)\s+(.+)$/);
    if (wholeMatch && nextFractionLine) {
      merged.push(`${wholeMatch[1]} ${nextFractionLine[1]} ${nextFractionLine[2]}`.trim());
      i += 1;
      continue;
    }

    merged.push(current);
  }

  return merged;
}

function startsWithPercentDescriptor(line: string): boolean {
  return /^\d+\s*%\s*[a-z]/i.test(line.trim());
}

function startsWithLeanRatioDescriptor(line: string): boolean {
  return /^\d{2,3}\s*\/\s*\d{1,2}\s+[a-z]/i.test(line.trim());
}

function endsWithLooseDescriptor(line: string): boolean {
  return /(plain|small|medium|large|boneless|skinless|ground|diced|chopped)\s*$/i.test(line.trim());
}

function looksLikeStandaloneDescriptor(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (!lower) return true;
  if (/^[\d\s/.()%"-]+$/.test(lower)) return true;
  if (['red', 'green', 'yellow', 'orange', 'ground', 'plain', 'small', 'medium', 'large'].includes(lower)) {
    return true;
  }
  if (/^%+$/.test(lower)) return true;
  if (/(^|\s)cont(?:inued)?\.?$/.test(lower)) return true;
  return false;
}

function hasUnclosedParenthesis(text: string): boolean {
  const opens = (text.match(/\(/g) || []).length;
  const closes = (text.match(/\)/g) || []).length;
  return opens > closes;
}

function isInsideParenthesis(text: string, index: number): boolean {
  let depth = 0;
  for (let i = 0; i < index; i += 1) {
    const ch = text[i];
    if (ch === '(') depth += 1;
    else if (ch === ')' && depth > 0) depth -= 1;
  }
  return depth > 0;
}

function repairIngredientFragments(parts: string[]): string[] {
  const rawLines = parts
    .map((line) => normalizeFractions(String(line || '')).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const lines = joinSplitFractionLines(rawLines);
  const out: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    let current = lines[i];
    if (!current) continue;

    if (out.length > 0 && hasUnclosedParenthesis(out[out.length - 1])) {
      out[out.length - 1] = `${out[out.length - 1]} ${current}`.replace(/\s+/g, ' ').trim();
      continue;
    }

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

      if (
        out.length > 0 &&
        (
          startsWithPercentDescriptor(current) ||
          startsWithLeanRatioDescriptor(current) ||
          endsWithLooseDescriptor(out[out.length - 1])
        )
      ) {
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
    const token = match[0] || '';
    const prevChar = match.index > 0 ? text[match.index - 1] : '';
    const nextChar = text[match.index + token.length] || '';
    const tokenHasUnit = new RegExp(`\\b${unitToken}\\b`, 'i').test(token);
    const tokenIsBareNumber = /^\d+(?:\.\d+)?$/.test(token.trim());
    const tokenIsLeanRatio = /^\d{2,3}\/\d{1,2}$/.test(token.trim());
    const textAfterToken = text.slice(match.index + token.length).trimStart().toLowerCase();
    const appearsToBeMeatRatio =
      tokenIsLeanRatio &&
      /^(ground|lean|extra lean|turkey|beef|chicken|pork|steak|meat)\b/.test(textAfterToken);

    // Keep mixed fractions intact and ignore quantity matches inside "(360 g)" style conversions.
    if (!isInsideParenthesis(text, match.index)) {
      if (
        !appearsToBeMeatRatio &&
        !(tokenIsBareNumber && (prevChar === '/' || nextChar === '/')) &&
        (tokenHasUnit || !tokenIsBareNumber)
      ) {
        splitPoints.push(match.index);
      }
    }

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

function restoreLikelyQuarterFractions(line: string): string {
  const trimmed = line.trim();
  if (/^\/4\s*(cup|cups|tsp|tbsp|teaspoon|teaspoons|tablespoon|tablespoons)\b/i.test(trimmed)) {
    return trimmed.replace(/^\/4/i, '1/4');
  }
  const match = trimmed.match(/^4\s*(cup|cups|tsp|tbsp|teaspoon|teaspoons|tablespoon|tablespoons)\b\s*(.*)$/i);
  if (!match) return line;

  const unit = match[1].toLowerCase();
  const rest = (match[2] || '').trim();
  const restLower = rest.toLowerCase();
  const hasStrongQuarterSignal =
    /^4\s*cup\b/i.test(trimmed) ||
    /(powder|pepper|paprika|cumin|oregano|thyme|garlic|onion|salt|seasoning|sauce|vinegar|juice|oil|sesame|chili|cinnamon|nutmeg|ginger|dill)\b/.test(restLower);

  if (!hasStrongQuarterSignal) return line;
  return `1/4 ${unit}${rest ? ` ${rest}` : ''}`.replace(/\s+/g, ' ').trim();
}

function looksLikeInstructionFragment(line: string): boolean {
  const lower = line.toLowerCase().trim();
  if (!lower) return true;
  if (
    /^(cut|slice|dice|chop|mince|mix|stir|whisk|cook|bake|roast|air fry|air-fry|grill|broil|sear|saute|sauté|steam|boil|microwave|let|allow|remove|place|add|combine|top|serve)\b/.test(lower)
  ) {
    return true;
  }
  if (
    /\b(cut into|bite-size|bite sized|until cooked|until softened|until browned|let rest|work in batches|to serve|before serving)\b/.test(lower)
  ) {
    return true;
  }
  if (/^\d+(?:\.\d+)?\s*\([^)]*\)\s*$/i.test(lower)) {
    return true;
  }
  if (/^juice of$/i.test(lower)) {
    return true;
  }
  return false;
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

  cleaned = restoreLikelyQuarterFractions(cleaned);

  if (/^\d*%?\s*plain greek$/i.test(cleaned) || /^\d*%?\s*greek$/i.test(cleaned)) {
    cleaned = 'Greek yogurt';
  } else if (/^\d*%?\s*milk$/i.test(cleaned)) {
    const percent = cleaned.match(/^\s*(\d+)\s*%/)?.[1];
    cleaned = percent ? `${percent}% milk` : 'Milk';
  }

  if (!cleaned) return '';
  if (looksLikeInstructionFragment(cleaned)) return '';
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
