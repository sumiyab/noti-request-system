import type { CreateNotificationInput, Notification } from '@noti/shared';
import type { Deps } from '../deps';
import { EnqueueFailedError } from '../lib/errors';

type ServiceDeps = Pick<Deps, 'repo' | 'queue' | 'log' | 'now' | 'newId'>;

/**
 * Store as PENDING → enqueue a pointer → mark QUEUED → return. If the queue send fails the request is marked
 * FAILED and the caller gets 503, so nothing is ever silently lost.
 */
export const createNotification = async (
  deps: ServiceDeps,
  input: CreateNotificationInput,
): Promise<Notification> => {
  const createdAt = deps.now().toISOString();
  const notification: Notification = {
    id: deps.newId(),
    ...input,
    status: 'PENDING',
    attempts: 0,
    createdAt,
    updatedAt: createdAt,
  };
  const log = deps.log.child({ notificationId: notification.id });

  await deps.repo.create(notification);
  log.debug('notification stored', { status: 'PENDING' });

  try {
    await deps.queue.send({ notificationId: notification.id });
  } catch (error) {
    log.error('enqueue failed', { error });
    await deps.repo.transition(notification.id, 'enqueueFailed', {
      now: deps.now(),
      lastError: 'Could not enqueue the request',
    });
    throw new EnqueueFailedError();
  }

  const result = await deps.repo.transition(notification.id, 'enqueued', { now: deps.now() });
  if (result.ok) {
    log.info('notification queued');
    return result.notification;
  }
  // The worker claimed it before this update ran — return whatever state it is in now.
  log.info('notification queued (worker was faster)', { reason: result.reason });
  return (await deps.repo.get(notification.id)) ?? notification;
};
