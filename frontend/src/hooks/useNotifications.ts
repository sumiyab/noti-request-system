'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { isTerminal } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import type { ListNotificationsResponse } from '@/schemas';

export const POLL_INTERVAL_MS = 2000;
/** Smaller than the API default (20) so the list pages visibly with modest data. */
export const PAGE_SIZE = 10;

type Pages = { pages: ListNotificationsResponse[] };

const hasInFlight = (data: Pages | undefined) =>
  data?.pages.some((page) => page.data.some((n) => !isTerminal(n.status))) ?? false;

/**
 * Newest-first list with cursor pagination; polls every 2 s while any loaded request is still in flight.
 * Pass a `userId` to show one user's requests only.
 */
export const useNotifications = (filter: { userId?: string } = {}) =>
  useInfiniteQuery({
    queryKey: queryKeys.notifications.list(filter),
    queryFn: ({ pageParam }) => api.list({ cursor: pageParam, limit: PAGE_SIZE, ...filter }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: (query) => (hasInFlight(query.state.data) ? POLL_INTERVAL_MS : false),
  });
