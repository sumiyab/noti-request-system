'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { isTerminal } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import type { ListNotificationsResponse } from '@/schemas';

export const POLL_INTERVAL_MS = 2000;

type Pages = { pages: ListNotificationsResponse[] };

const hasInFlight = (data: Pages | undefined) =>
  data?.pages.some((page) => page.data.some((n) => !isTerminal(n.status))) ?? false;

/** Newest-first list with cursor pagination; polls every 2 s while any loaded request is still in flight. */
export const useNotifications = () =>
  useInfiniteQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: ({ pageParam }) => api.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: (query) => (hasInFlight(query.state.data) ? POLL_INTERVAL_MS : false),
  });
