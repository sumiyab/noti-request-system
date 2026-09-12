import { DeleteTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { PurgeQueueCommand, ReceiveMessageCommand, SQSClient, type Message } from '@aws-sdk/client-sqs';
import type { Context, SQSEvent, SQSRecord } from 'aws-lambda';
import { ensureTable } from '../../local/table';
import { buildDeps, type Deps } from '../../src/deps';
import {
  createNotification,
  getNotification,
  listNotifications,
  processNotifications,
} from '../../src/handlers';
import { loadConfig } from '../../src/lib/config';
import { context, httpEvent, parseResponse } from '../helpers/events';

/**
 * Real handlers against DynamoDB Local + ElasticMQ. The table is recreated per file; the queue is purged.
 * `deps` can be overridden per test (e.g. a provider that always fails) — handlers read it lazily.
 */
export const harness = () => {
  const config = loadConfig();
  const dynamo = new DynamoDBClient({});
  const sqs = new SQSClient({});
  let deps: Deps = buildDeps(config);

  const setDeps = (patch: Partial<Deps>) => {
    deps = { ...buildDeps(config), ...patch };
  };

  const handlers = {
    create: createNotification.createHandler(() => deps),
    list: listNotifications.createHandler(() => deps),
    get: getNotification.createHandler(() => deps),
    worker: processNotifications.createHandler(() => deps),
  };

  const call = async (handler: (typeof handlers)['create'], event: ReturnType<typeof httpEvent>) =>
    parseResponse(await handler(event, context, () => {}));

  const receive = async (max = 10): Promise<Message[]> => {
    const { Messages = [] } = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: config.queueUrl,
        MaxNumberOfMessages: max,
        WaitTimeSeconds: 2,
        MessageSystemAttributeNames: ['ApproximateReceiveCount'],
      }),
    );
    return Messages;
  };

  const toSqsEvent = (messages: Message[]): SQSEvent => ({
    Records: messages.map(
      (m) =>
        ({
          messageId: m.MessageId,
          receiptHandle: m.ReceiptHandle,
          body: m.Body,
          attributes: { ApproximateReceiveCount: m.Attributes?.ApproximateReceiveCount ?? '1' },
        }) as unknown as SQSRecord,
    ),
  });

  /** Receive whatever is on the queue and run the worker over it, like the event source mapping would. */
  const runWorkerOnce = async () => {
    const messages = await receive();
    if (messages.length === 0) return { processed: 0, failures: [] as string[] };
    const result = await handlers.worker(toSqsEvent(messages), {} as Context, () => {});
    return {
      processed: messages.length,
      failures: (result?.batchItemFailures ?? []).map((f) => f.itemIdentifier),
    };
  };

  const reset = async () => {
    await dynamo.send(new DeleteTableCommand({ TableName: config.tableName })).catch(() => undefined);
    await ensureTable(config.tableName, dynamo);
    await sqs.send(new PurgeQueueCommand({ QueueUrl: config.queueUrl }));
    deps = buildDeps(config);
  };

  return { config, handlers, call, receive, runWorkerOnce, reset, setDeps, dynamo, sqs };
};

export type Harness = ReturnType<typeof harness>;
