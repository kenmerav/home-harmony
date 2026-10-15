import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthLoadingState } from '@/components/auth/AuthLoadingState';

describe('AuthLoadingState', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('offers a retry when loading takes too long', () => {
    vi.useFakeTimers();
    render(<AuthLoadingState message="Loading your household..." />);

    expect(screen.getByText('Loading your household...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(8_000);
    });

    expect(screen.getByText('Home Harmony is having trouble connecting.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
