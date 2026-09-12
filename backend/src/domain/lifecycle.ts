import { TERMINAL_STATUSES, type NotificationStatus } from '@noti/shared';

/**
 * The state machine, in one place. Every DynamoDB status update is a conditional write whose
 * ConditionExpression allows exactly the `from` states listed here, so out-of-order or duplicate
 * events can never move a request backwards.
 */
export const TRANSITIONS = {
  /** API: SQS accepted the message. */
  enqueued: { from: ['PENDING'], to: 'QUEUED' },
  /** API: the SQS send failed; the client gets 503 and may resubmit. */
  enqueueFailed: { from: ['PENDING'], to: 'FAILED' },
  /** Worker: before calling the provider. PROCESSING is allowed so a crashed attempt can be retried. */
  claimed: { from: ['PENDING', 'QUEUED', 'PROCESSING'], to: 'PROCESSING' },
  /** Worker: the provider accepted. */
  sent: { from: ['PROCESSING'], to: 'SENT' },
  /** Worker: transient error with attempts left; SQS redelivers. */
  retryScheduled: { from: ['PROCESSING'], to: 'QUEUED' },
  /** Worker: permanent error, or attempts exhausted. */
  failed: { from: ['PROCESSING'], to: 'FAILED' },
} as const satisfies Record<string, { from: readonly NotificationStatus[]; to: NotificationStatus }>;

export type Transition = keyof typeof TRANSITIONS;

export const canTransition = (transition: Transition, from: NotificationStatus) =>
  (TRANSITIONS[transition].from as readonly NotificationStatus[]).includes(from);

export const isTerminal = (status: NotificationStatus) =>
  (TERMINAL_STATUSES as readonly NotificationStatus[]).includes(status);
