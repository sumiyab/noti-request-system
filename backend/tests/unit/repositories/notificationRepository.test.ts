import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { decodeCursor } from '../../../src/repositories/cursor';
import {
  buildTransitionUpdate,
  createDynamoNotificationRepository,
} from '../../../src/repositories/notificationRepository';
import { ID, NOW, USER_ID, stored } from '../../helpers/fixtures';

const dynamo = mockClient(DynamoDBDocumentClient);
const repo = createDynamoNotificationRepository({
  client: dynamo as unknown as DynamoDBDocumentClient,
  tableName: 't',
});
const item = { ...stored(), entityType: 'NOTIFICATION' };

beforeEach(() => dynamo.reset());

describe('create / get', () => {
  test('create puts the item with the entity type and an existence guard', async () => {
    dynamo.on(PutCommand).resolves({});
    await repo.create(stored());
    expect(dynamo).toHaveReceivedCommandWith(PutCommand, {
      TableName: 't',
      Item: item,
      ConditionExpression: 'attribute_not_exists(id)',
    });
  });

  test('get reads consistently and strips the entity type', async () => {
    dynamo.on(GetCommand).resolves({ Item: item });
    await expect(repo.get(ID)).resolves.toEqual(stored());
    expect(dynamo).toHaveReceivedCommandWith(GetCommand, {
      TableName: 't',
      Key: { id: ID },
      ConsistentRead: true,
    });
  });

  test('get returns null when missing', async () => {
    dynamo.on(GetCommand).resolves({});
    await expect(repo.get(ID)).resolves.toBeNull();
  });
});

describe('list', () => {
  test('queries the index newest-first, asking for one extra item', async () => {
    dynamo.on(QueryCommand).resolves({ Items: [item] });
    const page = await repo.list({ limit: 20 });
    expect(page).toEqual({ data: [stored()], nextCursor: null });
    expect(dynamo).toHaveReceivedCommandWith(QueryCommand, {
      TableName: 't',
      IndexName: 'byCreatedAt',
      KeyConditionExpression: 'entityType = :entityType',
      ScanIndexForward: false,
      Limit: 21,
    });
  });

  test('queries the byUser index when a userId is given, with a byUser cursor', async () => {
    const older = { ...item, id: '1'.padEnd(36, '0'), createdAt: '2026-09-11T00:00:00.000Z' };
    dynamo.on(QueryCommand).resolves({ Items: [item, older] });
    const page = await repo.list({ limit: 1, userId: USER_ID });
    expect(dynamo).toHaveReceivedCommandWith(QueryCommand, {
      IndexName: 'byUser',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': USER_ID },
      Limit: 2,
    });
    const key = { id: ID, userId: USER_ID, createdAt: NOW.toISOString() };
    expect(decodeCursor(page.nextCursor!, { userId: USER_ID })).toEqual(key);
  });

  test('returns a cursor for the last item of the page only when more exist', async () => {
    const older = { ...item, id: '1'.padEnd(36, '0'), createdAt: '2026-09-11T00:00:00.000Z' };
    dynamo.on(QueryCommand).resolves({ Items: [item, older] });
    const page = await repo.list({ limit: 1 });
    expect(page.data).toHaveLength(1);
    const key = { id: ID, entityType: 'NOTIFICATION', createdAt: NOW.toISOString() };
    expect(decodeCursor(page.nextCursor!, {})).toEqual(key);
  });

  test('passes a decoded cursor as ExclusiveStartKey', async () => {
    dynamo.on(QueryCommand).resolves({ Items: [] });
    const cursor = Buffer.from(
      JSON.stringify({ id: ID, entityType: 'NOTIFICATION', createdAt: NOW.toISOString() }),
    ).toString('base64url');
    await repo.list({ limit: 5, cursor });
    expect(dynamo).toHaveReceivedCommandWith(QueryCommand, {
      ExclusiveStartKey: { id: ID, entityType: 'NOTIFICATION', createdAt: NOW.toISOString() },
    });
  });
});

describe('transition', () => {
  test('claimed: status guard, attempt cap, increment, ALL_NEW', () => {
    expect(buildTransitionUpdate('claimed', { now: NOW, maxAttempts: 3 })).toEqual({
      UpdateExpression: 'SET #status = :to, updatedAt = :now ADD attempts :one',
      ConditionExpression: '#status IN (:from0, :from1, :from2) AND attempts < :max',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':to': 'PROCESSING',
        ':now': NOW.toISOString(),
        ':from0': 'PENDING',
        ':from1': 'QUEUED',
        ':from2': 'PROCESSING',
        ':one': 1,
        ':max': 3,
      },
    });
  });

  test('terminal transitions set completedAt; optional fields only when given', () => {
    const sent = buildTransitionUpdate('sent', { now: NOW, providerMessageId: 'p1' });
    expect(sent.UpdateExpression).toBe(
      'SET #status = :to, updatedAt = :now, providerMessageId = :providerMessageId, completedAt = :now',
    );
    expect(sent.ConditionExpression).toBe('#status IN (:from0)');

    const retry = buildTransitionUpdate('retryScheduled', { now: NOW, lastError: 'timeout' });
    expect(retry.UpdateExpression).toBe('SET #status = :to, updatedAt = :now, lastError = :lastError');
    expect(retry.ExpressionAttributeValues[':lastError']).toBe('timeout');
  });

  test('claimed without maxAttempts is a programming error', () => {
    expect(() => buildTransitionUpdate('claimed', { now: NOW })).toThrow('maxAttempts');
  });

  test('returns the new item on success', async () => {
    dynamo.on(UpdateCommand).resolves({ Attributes: { ...item, status: 'SENT' } });
    await expect(repo.transition(ID, 'sent', { now: NOW })).resolves.toEqual({
      ok: true,
      notification: stored({ status: 'SENT' }),
    });
    expect(dynamo).toHaveReceivedCommandWith(UpdateCommand, {
      Key: { id: ID },
      ReturnValues: 'ALL_NEW',
      ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
    });
  });

  test('a failed condition is a conflict when the item exists, not_found otherwise', async () => {
    const failed = (Item?: Record<string, unknown>) =>
      new ConditionalCheckFailedException({
        message: 'cond',
        $metadata: {},
        ...(Item && { Item: Item as never }),
      });
    dynamo
      .on(UpdateCommand)
      .rejectsOnce(failed({ id: { S: ID } }))
      .rejectsOnce(failed());

    await expect(repo.transition(ID, 'sent', { now: NOW })).resolves.toEqual({
      ok: false,
      reason: 'conflict',
    });
    await expect(repo.transition(ID, 'sent', { now: NOW })).resolves.toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  test('other errors propagate', async () => {
    dynamo.on(UpdateCommand).rejects(new Error('throttled'));
    await expect(repo.transition(ID, 'sent', { now: NOW })).rejects.toThrow('throttled');
  });
});
