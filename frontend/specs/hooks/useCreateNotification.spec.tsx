import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, type InfiniteData } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { makeQueryClient } from '@/app/providers';
import { useCreateNotification } from '@/hooks/useCreateNotification';
import { queryKeys } from '@/lib/queryKeys';
import type { ListNotificationsResponse } from '@/schemas';
import { mockResponse, notification } from '../helpers';

type ListData = InfiniteData<ListNotificationsResponse, string | undefined>;
const page = (items: ReturnType<typeof notification>[]): ListData => ({
  pages: [{ data: items, nextCursor: null }],
  pageParams: [undefined],
});
const ids = (data: ListData | undefined) => data?.pages[0]?.data.map((n) => n.id);

describe('useCreateNotification', () => {
  test("prepends the new item to the unfiltered list and the sender's list, not another user's", async () => {
    const queryClient = makeQueryClient();
    const existing = notification({ id: 'e'.padEnd(36, '0') });
    queryClient.setQueryData<ListData>(queryKeys.notifications.list(), page([existing]));
    queryClient.setQueryData<ListData>(queryKeys.notifications.list({ userId: 'user-42' }), page([existing]));
    queryClient.setQueryData<ListData>(queryKeys.notifications.list({ userId: 'other' }), page([]));

    const created = notification({ id: 'c'.padEnd(36, '0'), userId: 'user-42' });
    mockResponse(202, { data: created });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useCreateNotification(), { wrapper });

    act(() => {
      result.current.mutate({
        userId: 'user-42',
        channel: 'EMAIL',
        recipient: 'jane@example.com',
        subject: 'Hi',
        message: 'x',
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(ids(queryClient.getQueryData(queryKeys.notifications.list()))).toEqual([created.id, existing.id]);
    expect(ids(queryClient.getQueryData(queryKeys.notifications.list({ userId: 'user-42' })))).toEqual([
      created.id,
      existing.id,
    ]);
    expect(ids(queryClient.getQueryData(queryKeys.notifications.list({ userId: 'other' })))).toEqual([]);
  });
});
