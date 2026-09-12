import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { makeQueryClient } from '@/app/providers';
import { POLL_INTERVAL_MS, useNotifications } from '@/hooks/useNotifications';
import { mockList, notification } from '../helpers';

const setup = () => {
  const queryClient = makeQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useNotifications(), { wrapper });
};

describe('useNotifications', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('polls while a request is in flight and stops once all are terminal', async () => {
    mockList([notification({ status: 'QUEUED' })]);
    const { result } = setup();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledTimes(1);

    mockList([notification({ status: 'SENT' })]);
    await act(() => jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    await act(() => jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('exposes the next cursor and fetches the next page', async () => {
    mockList([notification({ id: 'a'.padEnd(36, '0'), status: 'SENT' })], 'cursor-2');
    const { result } = setup();
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    mockList([notification({ id: 'b'.padEnd(36, '0'), status: 'SENT' })], null);
    await act(() => result.current.fetchNextPage());

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(false);
    const secondCall = (global.fetch as jest.Mock).mock.calls[1] as [string];
    expect(secondCall[0]).toContain('cursor=cursor-2');
  });
});
