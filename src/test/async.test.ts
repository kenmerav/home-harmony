import { describe, expect, it, vi } from 'vitest';
import { TimeoutError, withTimeout } from '@/lib/async';

describe('withTimeout', () => {
  it('returns a request result before the deadline', async () => {
    await expect(withTimeout(Promise.resolve('ready'), 100)).resolves.toBe('ready');
  });

  it('rejects a stalled request at the deadline', async () => {
    vi.useFakeTimers();
    const stalled = new Promise<string>(() => undefined);
    const result = expect(withTimeout(stalled, 1_000, 'Request stalled.')).rejects.toEqual(
      new TimeoutError('Request stalled.'),
    );

    await vi.advanceTimersByTimeAsync(1_000);
    await result;
    vi.useRealTimers();
  });
});
