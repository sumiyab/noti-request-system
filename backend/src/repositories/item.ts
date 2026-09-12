import { notificationSchema, type Notification } from '@noti/shared';
import type { CursorKey } from './cursor';

export const ENTITY_TYPE = 'NOTIFICATION';
export const INDEX_BY_CREATED_AT = 'byCreatedAt';
export const INDEX_BY_USER = 'byUser';

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

/** The key a page continues from, in the shape of the index that produced it. */
export const keyOf = (
  notification: Pick<Notification, 'id' | 'userId' | 'createdAt'>,
  index: typeof INDEX_BY_CREATED_AT | typeof INDEX_BY_USER,
): CursorKey =>
  index === INDEX_BY_USER
    ? { id: notification.id, userId: notification.userId, createdAt: notification.createdAt }
    : { id: notification.id, entityType: ENTITY_TYPE, createdAt: notification.createdAt };
