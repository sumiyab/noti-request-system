'use client';

import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { ListNotificationsResponse, Notification } from '@/schemas';

type ListData = InfiniteData<ListNotificationsResponse, string | undefined>;

const prepend = (data: ListData | undefined, notification: Notification): ListData | undefined => {
  const [first, ...rest] = data?.pages ?? [];
  if (!first) return data;
  return { ...data!, pages: [{ ...first, data: [notification, ...first.data] }, ...rest] };
};

type ListKey = ReturnType<typeof queryKeys.notifications.list>;

/** The unfiltered list and the list filtered to this user both gain the new item; other users' lists do not. */
const showsUser = (key: readonly unknown[], userId: string) => {
  const filter = (key as ListKey)[2];
  return filter.userId === undefined || filter.userId === userId;
};

/**
 * POST /notifications. On success the returned item is prepended to the cached first page of every list
 * that would contain it (instant feedback, and it hides the list index's eventual consistency), then the
 * lists are refetched.
 */
export const useCreateNotification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.create,
    onSuccess: async ({ data }) => {
      queryClient.setQueriesData<ListData>(
        { queryKey: queryKeys.notifications.lists(), predicate: (q) => showsUser(q.queryKey, data.userId) },
        (old) => prepend(old, data),
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
};
