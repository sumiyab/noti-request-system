import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import {
  buildTransitionUpdate,
  createDynamoNotificationRepository,
} from '../../../src/repositories/notificationRepository';
import { ID, NOW, stored } from '../../helpers/fixtures';

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
