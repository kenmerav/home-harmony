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
it('excludes checked groceries and water, skips salt, saves choices and guards duplicate sends', async () => {
  render(<WalmartCartDialog items={items} userId="test" weekOf="2026-09-07" onClose={() => {}} />);
  const review = await screen.findByLabelText(/I checked the products/);
  expect(screen.queryByText('Milk')).not.toBeInTheDocument();
  expect(screen.queryByText('Water')).not.toBeInTheDocument();
  expect(screen.getByLabelText(/Salt/)).not.toBeChecked();
  expect(screen.getByLabelText('Packages to add')).toHaveValue(3);
  expect(screen.getByRole('button', { name: /Save choices/ })).toBeDisabled();
  fireEvent.click(review);
  fireEvent.click(screen.getByRole('button', { name: /Save choices/ }));
  const link = await screen.findByRole('link', { name: /Add selected items/ });
  expect(link).toHaveAttribute('href', 'https://www.walmart.com/sc/cart/addToCart?items=16322759490_3');
  expect(persist).toHaveBeenCalledWith('test', ['shared_preferences', 'walmart_cart'], expect.objectContaining({ skipSeasonings: true }));
  // Prevent navigation: validate only the local handoff behavior.
  link.addEventListener('click', event => event.preventDefault());
  fireEvent.click(link);
  expect(await screen.findByText(/already been opened/)).toBeInTheDocument();
});
it('requires a valid product for unknown ingredients and invalidates review on edits', async () => {
  render(<WalmartCartDialog items={[{ key: 'pasta', name: 'Spaghetti', quantity: '32 oz', isChecked: false }]} userId="test" weekOf="2026-09-07" onClose={() => {}} />);
  const review = await screen.findByLabelText(/I checked the products/);
  fireEvent.click(review);
  expect(screen.getByRole('button', { name: /Save choices/ })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Walmart product link or item ID'), { target: { value: 'https://www.walmart.com/ip/12345678' } });
  expect(review).not.toBeChecked();
  fireEvent.change(screen.getByLabelText(/Package size/), { target: { value: '16 oz' } });
  expect(screen.getByLabelText('Packages to add')).toHaveValue(2);
  fireEvent.click(review);
  await waitFor(() => expect(screen.getByRole('button', { name: /Save choices/ })).toBeEnabled());
});
