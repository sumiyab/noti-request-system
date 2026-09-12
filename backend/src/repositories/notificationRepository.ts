import type { ListNotificationsQuery, Notification } from '@noti/shared';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { TRANSITIONS, isTerminal, type Transition } from '../domain/lifecycle';
import { decodeCursor, encodeCursor } from './cursor';
import { ENTITY_TYPE, INDEX_BY_CREATED_AT, INDEX_BY_USER, fromItem, keyOf, toItem } from './item';

export type Page = { data: Notification[]; nextCursor: string | null };

export type TransitionOptions = {
  now: Date;
  lastError?: string;
  providerMessageId?: string;
  /** Required for `claimed`: the claim also increments `attempts` and refuses once the cap is reached. */
  maxAttempts?: number;
};

export type TransitionResult =
  { ok: true; notification: Notification } | { ok: false; reason: 'conflict' | 'not_found' };

export interface NotificationRepository {
  create(notification: Notification): Promise<void>;
  get(id: string): Promise<Notification | null>;
  /** Newest first; every request, or one user's when `userId` is given. */
  list(query: ListNotificationsQuery): Promise<Page>;
  transition(id: string, transition: Transition, options: TransitionOptions): Promise<TransitionResult>;
}

type Deps = { client: DynamoDBDocumentClient; tableName: string };

/** Builds the UpdateItem pieces for a transition. Exported for the unit tests that assert the exact expressions. */
export const buildTransitionUpdate = (transition: Transition, options: TransitionOptions) => {
  const { from, to } = TRANSITIONS[transition];
  const now = options.now.toISOString();
  const names: Record<string, string> = { '#status': 'status' };
  const values: Record<string, unknown> = { ':to': to, ':now': now };
  const sets = ['#status = :to', 'updatedAt = :now'];
  const conditions: string[] = [];

  const fromKeys = from.map((status, i) => {
    values[`:from${i}`] = status;
    return `:from${i}`;
  });
  conditions.push(`#status IN (${fromKeys.join(', ')})`);

  if (options.lastError !== undefined) {
    values[':lastError'] = options.lastError;
    sets.push('lastError = :lastError');
  }
  if (options.providerMessageId !== undefined) {
    values[':providerMessageId'] = options.providerMessageId;
    sets.push('providerMessageId = :providerMessageId');
  }
  if (isTerminal(to)) sets.push('completedAt = :now');

  let add: string | undefined;
  if (transition === 'claimed') {
    if (options.maxAttempts === undefined) throw new Error('claimed requires maxAttempts');
    values[':one'] = 1;
    values[':max'] = options.maxAttempts;
    conditions.push('attempts < :max');
    add = 'ADD attempts :one';
  }

  return {
    UpdateExpression: [`SET ${sets.join(', ')}`, add].filter(Boolean).join(' '),
    ConditionExpression: conditions.join(' AND '),
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  };
};

export const createDynamoNotificationRepository = ({ client, tableName }: Deps): NotificationRepository => ({
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
    const index = userId === undefined ? INDEX_BY_CREATED_AT : INDEX_BY_USER;
    // Ask for one extra item: its presence is the only reliable "there is a next page" signal.
    const { Items = [] } = await client.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: index,
        ...(userId === undefined
          ? {
              KeyConditionExpression: 'entityType = :entityType',
              ExpressionAttributeValues: { ':entityType': ENTITY_TYPE },
            }
          : {
              KeyConditionExpression: 'userId = :userId',
              ExpressionAttributeValues: { ':userId': userId },
            }),
        ScanIndexForward: false,
        Limit: limit + 1,
        ...(cursor && { ExclusiveStartKey: decodeCursor(cursor, { userId }) }),
      }),
    );
    const page = Items.slice(0, limit).map(fromItem);
    const last = page[page.length - 1];
    const nextCursor = Items.length > limit && last ? encodeCursor(keyOf(last, index)) : null;
    return { data: page, nextCursor };
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
