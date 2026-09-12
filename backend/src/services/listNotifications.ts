import type { ListNotificationsQuery, ListNotificationsResponse } from '@noti/shared';
import type { Deps } from '../deps';

export const listNotifications = (
  deps: Pick<Deps, 'repo'>,
  query: ListNotificationsQuery,
): Promise<ListNotificationsResponse> => deps.repo.list(query);
