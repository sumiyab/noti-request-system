import type { Notification } from '@noti/shared';

/** The seam where SES / SNS / FCM would plug in. */
export interface NotificationProvider {
  /** Resolves when the provider accepted the notification; throws ProviderError otherwise. */
  send(notification: Notification): Promise<{ providerMessageId: string }>;
}

/** `retryable` is the single bit that decides between a retry and FAILED. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
