import type { ListNotificationsQuery, Notification } from '@noti/shared';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
  type QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';
import type { Transition } from '../domain/lifecycle';
import { noopLogger, type Logger } from '../lib/logger';
import { decodeCursor, encodeCursor } from './cursor';
import {
  ENTITY_TYPE,
  INDEX_BY_CREATED_AT,
  INDEX_BY_USER,
  fromItem,
  keyOf,
  toItem,
  type ListIndex,
  type NotificationItem,
} from './item';
import { buildTransitionUpdate, type TransitionOptions } from './transitionUpdate';

export type { TransitionOptions } from './transitionUpdate';

export type Page = { data: Notification[]; nextCursor: string | null };

export type TransitionResult =
  { ok: true; notification: Notification } | { ok: false; reason: 'conflict' | 'not_found' };

export interface NotificationRepository {
  create(notification: Notification): Promise<void>;
  get(id: string): Promise<Notification | null>;
  /** Newest first; every request, or one user's when `userId` is given. */
  list(query: ListNotificationsQuery): Promise<Page>;
  transition(id: string, transition: Transition, options: TransitionOptions): Promise<TransitionResult>;
}

type Deps = { client: DynamoDBDocumentClient; tableName: string; log?: Logger };

/** The part of a Query that picks the index and its partition; the rest of the input is the same for both. */
type ListQuery = Pick<Required<QueryCommandInput>, 'KeyConditionExpression' | 'ExpressionAttributeValues'> & {
  IndexName: ListIndex;
};

/** Which index answers a list query, and how to address its partition. */
const listIndex = (userId: string | undefined): ListQuery =>
  userId === undefined
    ? {
        IndexName: INDEX_BY_CREATED_AT,
        KeyConditionExpression: 'entityType = :pk',
        ExpressionAttributeValues: { ':pk': ENTITY_TYPE },
      }
    : {
        IndexName: INDEX_BY_USER,
        KeyConditionExpression: 'userId = :pk',
        ExpressionAttributeValues: { ':pk': userId },
      };

export const createDynamoNotificationRepository = ({
  client,
  tableName,
  log = noopLogger,
}: Deps): NotificationRepository => ({
  create: async (notification) => {
    await client.send(
      new PutCommand({
        TableName: tableName,
        Item: toItem(notification),
        ConditionExpression: 'attribute_not_exists(id)',
      }),
    );
  },

  get: async (id) => {
    const { Item } = await client.send(
      new GetCommand({ TableName: tableName, Key: { id }, ConsistentRead: true }),
    );
    return Item ? fromItem(Item) : null;
  },

  list: async ({ limit, cursor, userId }) => {
    const index = listIndex(userId);
    const exclusiveStartKey = cursor ? decodeCursor(cursor, { userId }) : undefined; // 400 before any I/O

    // Ask for one extra item: its presence is the only reliable "there is a next page" signal
    // (LastEvaluatedKey can be set even when nothing follows).
    const { Items = [] } = await client.send(
      new QueryCommand({
        TableName: tableName,
        ...index,
        ScanIndexForward: false,
        Limit: limit + 1,
        ...(exclusiveStartKey && { ExclusiveStartKey: exclusiveStartKey }),
      }),
    );
    const hasMore = Items.length > limit;
    const raw = Items.slice(0, limit);

    // One item that no longer matches the schema must not take the whole page down: drop it, say so, and
    // keep going. `get` stays strict — there a bad item is the only answer.
    const data: Notification[] = [];
    for (const item of raw) {
      try {
        data.push(fromItem(item));
      } catch (error) {
        log.warn('skipping stored item that does not match the current schema', { id: item.id, error });
      }
    }

    // Continue from the last item *read*, not the last one kept, or a skipped item on the boundary would be
    // re-read on every page. Index key attributes are guaranteed present on anything the index returned.
    const last = raw[raw.length - 1] as NotificationItem | undefined;
    const nextCursor = hasMore && last ? encodeCursor(keyOf(last, index.IndexName)) : null;
    return { data, nextCursor };
  },

  transition: async (id, transition, options) => {
    try {
      const { Attributes } = await client.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { id },
          ...buildTransitionUpdate(transition, options),
          ReturnValues: 'ALL_NEW',
          ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
        }),
      );
      return { ok: true, notification: fromItem(Attributes ?? {}) };
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        return { ok: false, reason: error.Item ? 'conflict' : 'not_found' };
      }
      throw error;
    }
  },
});
