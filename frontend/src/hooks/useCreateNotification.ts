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

/**
 * POST /notifications. On success the returned item is prepended to the cached first page
 * (instant feedback, and it hides the list index's eventual consistency), then the list is refetched.
 */
export const useCreateNotification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.create,
    onSuccess: async ({ data }) => {
      queryClient.setQueryData<ListData>(queryKeys.notifications.list(), (old) => prepend(old, data));
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
};
