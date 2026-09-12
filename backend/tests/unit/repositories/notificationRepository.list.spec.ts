import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { noopLogger } from '../../../src/lib/logger';
import { decodeCursor } from '../../../src/repositories/cursor';
import { createDynamoNotificationRepository } from '../../../src/repositories/notificationRepository';
import { ID, NOW, USER_ID, stored } from '../../helpers/fixtures';

const dynamo = mockClient(DynamoDBDocumentClient);
const repo = createDynamoNotificationRepository({
  client: dynamo as unknown as DynamoDBDocumentClient,
  tableName: 't',
});
const item = { ...stored(), entityType: 'NOTIFICATION' };

beforeEach(() => dynamo.reset());

describe('list', () => {
  test('queries the index newest-first, asking for one extra item', async () => {
    dynamo.on(QueryCommand).resolves({ Items: [item] });
    const page = await repo.list({ limit: 20 });
    expect(page).toEqual({ data: [stored()], nextCursor: null });
    expect(dynamo).toHaveReceivedCommandWith(QueryCommand, {
      TableName: 't',
      IndexName: 'byCreatedAt',
      KeyConditionExpression: 'entityType = :pk',
      ExpressionAttributeValues: { ':pk': 'NOTIFICATION' },
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
      KeyConditionExpression: 'userId = :pk',
      ExpressionAttributeValues: { ':pk': USER_ID },
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

  test('skips an item that no longer matches the schema, warns, and still advances past it', async () => {
    const warn = jest.fn();
    const lenient = createDynamoNotificationRepository({
      client: dynamo as unknown as DynamoDBDocumentClient,
      tableName: 't',
      log: { ...noopLogger, warn },
    });
    const legacy = {
      ...item,
      id: '8b3d2c1e-5f6a-4b7c-9d0e-1f2a3b4c5d6e',
      createdAt: '2026-09-11T00:00:00.000Z',
      userId: undefined,
    };
    const older = { ...item, id: '2'.padEnd(36, '0'), createdAt: '2026-09-10T00:00:00.000Z' };
    dynamo.on(QueryCommand).resolves({ Items: [item, legacy, older] });

    const page = await lenient.list({ limit: 2 });
    expect(page.data).toEqual([stored()]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('skipping'),
      expect.objectContaining({ id: legacy.id }),
    );
    // The cursor is the skipped item's key, so the next page starts after it rather than re-reading it.
    expect(decodeCursor(page.nextCursor!, {})).toMatchObject({ id: legacy.id, createdAt: legacy.createdAt });
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
