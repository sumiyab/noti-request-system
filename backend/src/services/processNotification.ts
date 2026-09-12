import type { Deps } from '../deps';
import { ProviderError } from '../providers/notificationProvider';
import type { QueueMessage } from '../queue/message';

type ServiceDeps = Pick<Deps, 'repo' | 'provider' | 'config' | 'log' | 'now'>;

/** `done`: delete the message. `retry`: leave it for SQS to redeliver after the visibility timeout. */
export type ProcessOutcome = 'done' | 'retry';

/**
 * One SQS record. Claims the request (conditional update: only PENDING/QUEUED/PROCESSING, attempts < max),
 * calls the provider, records the outcome. Business failures are counted on the item; anything unexpected
 * propagates to the handler, which reports the record as failed without touching `attempts`.
 */
export const processNotification = async (
  deps: ServiceDeps,
  { notificationId }: QueueMessage,
): Promise<ProcessOutcome> => {
  const log = deps.log.child({ notificationId });
  const { maxAttempts } = deps.config;

  const claim = await deps.repo.transition(notificationId, 'claimed', { now: deps.now(), maxAttempts });
  if (!claim.ok) {
    // Duplicate delivery of a finished request, over the cap, or an unknown id: nothing to do.
    log.info('skipped', { reason: claim.reason });
    return 'done';
  }
  const notification = claim.notification;
  log.debug('claimed', { attempts: notification.attempts });

  try {
    const { providerMessageId } = await deps.provider.send(notification);
    await deps.repo.transition(notificationId, 'sent', { now: deps.now(), providerMessageId });
    log.info('sent', { providerMessageId, attempts: notification.attempts });
    return 'done';
  } catch (error) {
    if (!(error instanceof ProviderError)) throw error;

    if (error.retryable && notification.attempts < maxAttempts) {
      await deps.repo.transition(notificationId, 'retryScheduled', {
        now: deps.now(),
        lastError: error.message,
      });
      log.warn('retry scheduled', { attempts: notification.attempts, reason: error.message });
      return 'retry';
    }

    const lastError = error.retryable ? `${error.message} (attempts exhausted)` : error.message;
    await deps.repo.transition(notificationId, 'failed', { now: deps.now(), lastError });
    log.warn('failed', { attempts: notification.attempts, reason: lastError, retryable: error.retryable });
    return 'done';
  }
};
