import type { z } from 'zod';
import type { CHANNELS, STATUSES } from './constants';
import type {
  apiErrorSchema,
  createNotificationSchema,
  fieldErrorSchema,
  listNotificationsQuerySchema,
  listNotificationsResponseSchema,
  notificationSchema,
} from './schemas';

export type Channel = (typeof CHANNELS)[number];
export type NotificationStatus = (typeof STATUSES)[number];

/** Body of POST /notifications, after validation (trimmed, unknown keys rejected, narrowed by channel). */
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;

/** Query string of GET /notifications, after validation (limit defaulted). */
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

/** A stored notification request as every endpoint returns it. */
export type Notification = z.infer<typeof notificationSchema>;

export type ListNotificationsResponse = z.infer<typeof listNotificationsResponseSchema>;

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
export type ApiErrorCode = ApiErrorBody['error']['code'];
export type FieldError = z.infer<typeof fieldErrorSchema>;
