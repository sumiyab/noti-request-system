import { notificationSchema, type Notification } from '@noti/shared';
import type { CursorKey } from './cursor';

export const ENTITY_TYPE = 'NOTIFICATION';

/** The two list indexes; `keyOf` builds a cursor in the shape of whichever one produced the page. */
export type ListIndex = 'byCreatedAt' | 'byUser';
export const INDEX_BY_CREATED_AT: ListIndex = 'byCreatedAt';
export const INDEX_BY_USER: ListIndex = 'byUser';

/** The stored item: the API shape plus the constant index partition key. Optional fields are omitted, not null. */
export type NotificationItem = Notification & { entityType: typeof ENTITY_TYPE };

export const toItem = (notification: Notification): NotificationItem => ({
  ...notification,
  entityType: ENTITY_TYPE,
});

/**
 * Validates on the way out so a hand-edited or legacy item surfaces as an error, not as bad data. `get`
 * lets that error through; `list` catches it per item so one bad row cannot hide the rest of the page.
 */
export const fromItem = (item: Record<string, unknown>): Notification => {
  const { entityType: _entityType, ...rest } = item;
  return notificationSchema.parse(rest);
};

/** The key a page continues from, in the shape of the index that produced it. */
export const keyOf = (
  notification: Pick<Notification, 'id' | 'userId' | 'createdAt'>,
  index: ListIndex,
): CursorKey =>
  index === INDEX_BY_USER
    ? { id: notification.id, userId: notification.userId, createdAt: notification.createdAt }
    : { id: notification.id, entityType: ENTITY_TYPE, createdAt: notification.createdAt };
