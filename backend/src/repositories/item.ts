import { notificationSchema, type Notification } from '@noti/shared';
import type { CursorKey } from './cursor';

export const ENTITY_TYPE = 'NOTIFICATION';
export const INDEX_BY_CREATED_AT = 'byCreatedAt';

/** The stored item: the API shape plus the constant index partition key. Optional fields are omitted, not null. */
export type NotificationItem = Notification & { entityType: typeof ENTITY_TYPE };

export const toItem = (notification: Notification): NotificationItem => ({
  ...notification,
  entityType: ENTITY_TYPE,
});

/** Validates on the way out so a hand-edited or legacy item surfaces as an error, not as bad data. */
export const fromItem = (item: Record<string, unknown>): Notification => {
  const { entityType: _entityType, ...rest } = item;
  return notificationSchema.parse(rest);
};

export const keyOf = (notification: Pick<Notification, 'id' | 'createdAt'>): CursorKey => ({
  id: notification.id,
  entityType: ENTITY_TYPE,
  createdAt: notification.createdAt,
});
