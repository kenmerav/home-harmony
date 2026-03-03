import { describe, expect, it } from 'vitest';
import { freeToolPages } from '@/data/freeToolsContent';
import {
  DEFAULT_QUICK_INPUTS,
  generateQuickOutput,
  getMissingQuickToolCoverage,
  getMissingQuickToolUiCoverage,
  getQuickToolUiConfig,
  QUICK_INPUT_SAMPLES,
} from '@/lib/freeToolsQuickTool';

describe('free tools quick outputs', () => {
  it('covers every configured free-tool slug with a dedicated generator', () => {
    const missing = getMissingQuickToolCoverage();
    expect(missing).toEqual([]);
  });

  it('covers every configured free-tool slug with a dedicated ui config', () => {
    const missing = getMissingQuickToolUiCoverage();
    expect(missing).toEqual([]);
  });

  it('returns structured output for every free tool page', () => {
    for (const tool of freeToolPages) {
      const input = {
        ...DEFAULT_QUICK_INPUTS,
        listInput: QUICK_INPUT_SAMPLES[tool.slug] || DEFAULT_QUICK_INPUTS.listInput,
      };
      const result = generateQuickOutput(tool.slug, input);
      expect(result.summary.length).toBeGreaterThan(12);
      expect(result.primary.length).toBeGreaterThan(0);
      expect(result.checklist.length).toBeGreaterThan(0);
    }
  });

  it('combines grocery quantities correctly', () => {
    const result = generateQuickOutput('grocery-list-combiner', {
      ...DEFAULT_QUICK_INPUTS,
      listInput: '1 cup milk\n2 cups milk\n1 lb ground beef\n2 lbs ground beef',
    });

    expect(result.primary.some((line) => line.includes('3 cup milk'))).toBe(true);
    expect(result.primary.some((line) => line.includes('3 lb ground beef'))).toBe(true);
  });

  it('shows only relevant input fields for grocery combiner', () => {
    const ui = getQuickToolUiConfig('grocery-list-combiner');
    expect(ui.fields).toEqual(['listInput']);
    expect(ui.generateLabel?.toLowerCase()).toContain('combine');
  });

  it('uses dinner timing logic', () => {
    const result = generateQuickOutput('dinner-start-time-calculator', {
      ...DEFAULT_QUICK_INPUTS,
      dinnerTime: '18:00',
      maxMinutes: '30',
    });

    expect(result.summary).toContain('start cooking');
    expect(result.primary.some((line) => line.includes('17:30'))).toBe(true);
  });

  it('provides pantry-specific meal options', () => {
    const result = generateQuickOutput('pantry-meal-finder', {
      ...DEFAULT_QUICK_INPUTS,
      listInput: 'eggs, tortillas, rice, black beans',
    });

    expect(result.summary.toLowerCase()).toContain('pantry-first');
    expect(result.primary.length).toBeGreaterThanOrEqual(3);
  });

  it('provides routine-specific output', () => {
    const result = generateQuickOutput('family-routine-builder', {
      ...DEFAULT_QUICK_INPUTS,
      listInput: 'morning launch\nafter school reset\nevening closeout',
    });

    expect(result.summary.toLowerCase()).toContain('routine');
    expect(result.primary[0]).toContain('Block 1');
  });
});
