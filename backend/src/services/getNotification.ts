import type { Notification } from '@noti/shared';
import type { Deps } from '../deps';
import { NotFoundError } from '../lib/errors';

export const getNotification = async (deps: Pick<Deps, 'repo'>, id: string): Promise<Notification> => {
  const notification = await deps.repo.get(id);
  if (!notification) throw new NotFoundError(`Notification ${id} was not found`);
  return notification;
};
