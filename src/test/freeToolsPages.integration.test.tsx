import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, isDemoUser: false }),
}));

import { freeToolPages } from '@/data/freeToolsContent';
import {
  DEFAULT_QUICK_FIELD_LABELS,
  getQuickToolUiConfig,
  type QuickToolField,
} from '@/lib/freeToolsQuickTool';
import { FreeToolsDetailPage, FreeToolsHubPage } from '@/pages/seo/FreeToolsPages';

const ALL_FIELDS: QuickToolField[] = ['householdSize', 'maxMinutes', 'weeklyBudget', 'dinnerTime', 'focus', 'listInput'];

function renderToolPage(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/free-tools/${slug}`]}>
      <Routes>
        <Route path="/free-tools/:slug" element={<FreeToolsDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderHubPage() {
  return render(
    <MemoryRouter initialEntries={['/free-tools']}>
      <Routes>
        <Route path="/free-tools" element={<FreeToolsHubPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
});

describe('free tools hub page', () => {
  it('renders all tools and supports search + category filters', () => {
    renderHubPage();

    expect(screen.getByRole('heading', { name: /fast planning tools for real home workflows/i })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /try this tool/i }).length).toBe(freeToolPages.length);

    fireEvent.change(screen.getByPlaceholderText(/search tools/i), { target: { value: 'macro' } });
    expect(screen.getAllByRole('button', { name: /try this tool/i }).length).toBe(1);

    fireEvent.change(screen.getByPlaceholderText(/search tools/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Grocery' }));
    expect(screen.getAllByRole('button', { name: /try this tool/i }).length).toBe(2);
  });
});

describe('free tool detail pages', () => {
  it.each(freeToolPages.map((tool) => [tool.slug, tool.title] as const))(
    'renders %s with relevant fields and working generate output',
    (slug, title) => {
      const ui = getQuickToolUiConfig(slug);
      renderToolPage(slug);

      expect(screen.getByRole('heading', { name: title })).toBeTruthy();
      expect(screen.getByText(ui.intro)).toBeTruthy();

      for (const field of ALL_FIELDS) {
        const label =
          field === 'listInput'
            ? ui.listLabel || ui.fieldLabels?.[field] || DEFAULT_QUICK_FIELD_LABELS[field]
            : ui.fieldLabels?.[field] || DEFAULT_QUICK_FIELD_LABELS[field];
        if (ui.fields.includes(field)) {
          expect(screen.getByLabelText(label, { exact: false })).toBeTruthy();
        } else {
          expect(screen.queryByLabelText(label, { exact: false })).toBeNull();
        }
      }

      const generateLabel = ui.generateLabel || 'Generate output';
      fireEvent.click(screen.getByRole('button', { name: generateLabel }));

      const outputTitle = ui.outputTitle || 'Primary output';
      expect(screen.getByText(outputTitle)).toBeTruthy();
      expect(screen.getByText('Next actions')).toBeTruthy();

      const sampleLabel = ui.sampleLabel || 'Use sample input';
      if (ui.fields.includes('listInput')) {
        expect(screen.getByRole('button', { name: sampleLabel })).toBeTruthy();
      } else {
        expect(screen.queryByRole('button', { name: sampleLabel })).toBeNull();
      }
    },
  );
});
