import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WalmartCartDialog } from './WalmartCartDialog';
const persist = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock('@/lib/profileSettingsStore', () => ({ loadProfileSettingsDocument: async () => ({}), getProfileSettingsValue: () => undefined, updateProfileSettingsValue: persist }));
vi.mock('@/lib/householdScope', () => ({ resolveSharedScopeUserId: (id: string) => id }));
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); persist.mockClear(); });
afterEach(cleanup);
const items = [
  { key: 'beef', name: 'Ground beef', quantity: '3 lb', isChecked: false },
  { key: 'salt', name: 'Salt', quantity: '1 tsp', isChecked: false },
  { key: 'water', name: 'Water', quantity: '2 cups', isChecked: false },
  { key: 'milk', name: 'Milk', quantity: '1 cup', isChecked: true },
];
it('automatically prepares unchecked matches without requiring product links', async () => {
  render(<WalmartCartDialog items={items} userId="test" weekOf="2026-09-07" onClose={() => {}} />);
  const link = await screen.findByRole('link', { name: /Add 1 matched items/ });
  expect(screen.queryByText('Milk')).not.toBeInTheDocument();
  expect(screen.queryByText('Water')).not.toBeInTheDocument();
  expect(screen.getByLabelText(/Salt/)).toBeChecked();
  expect(screen.getByText(/1 items could not be matched/)).toBeInTheDocument();
  expect(link).toHaveAttribute('href', 'https://www.walmart.com/sc/cart/addToCart?items=16322759490_3');
  link.addEventListener('click', event => event.preventDefault());
  fireEvent.click(link);
  expect(await screen.findByText(/already been opened/)).toBeInTheDocument();
  await waitFor(() => expect(persist).toHaveBeenCalled());
});
it('includes all ten weekly staples automatically with grocery counts', async () => {
  const names = ['Bananas', 'Apples', 'Blueberries', 'Rasberries', 'Whole Milk', 'Chocolate Milk', 'Great Value Light Nonfat Greek Yogurt 5.3 oz Cups 4 Pack', 'Great Value Vanilla Light Nonfat Greek Yogurt 32oz Tub', 'Great Value Pre-Sliced Cinnamon Raisin Bagels', 'Jimmy Dean Protein Waffles'];
  const quantities = ['6', '4', '1', '1', 'Half Gallon', 'Half Gallon', '1', '2', '1', '3'];
  render(<WalmartCartDialog items={names.map((name, i) => ({ key: name, name, quantity: quantities[i], isChecked: false }))} userId="test" weekOf="2026-09-07" onClose={() => {}} />);
  const link = await screen.findByRole('link', { name: /Add 10 matched items/ });
  expect(link.getAttribute('href')).toContain('44390948_6,44390953_4');
  expect(link.getAttribute('href')).toContain('41972648_2');
  expect(link.getAttribute('href')).toContain('18375414744_3');
  expect(screen.queryByText(/could not be matched/)).not.toBeInTheDocument();
});
