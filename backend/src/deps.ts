import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SQSClient } from '@aws-sdk/client-sqs';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { loadConfig, type Config } from './lib/config';
import { createLogger, type Logger } from './lib/logger';
import type { NotificationProvider } from './providers/notificationProvider';
import { createSimulatedProvider } from './providers/simulatedProvider';
import type { QueueProducer } from './queue/producer';
import { createSqsProducer } from './queue/producer';
import type { NotificationRepository } from './repositories/notificationRepository';
import { createDynamoNotificationRepository } from './repositories/notificationRepository';

/** Everything a service needs, passed explicitly so tests can substitute fakes. */
export type Deps = {
  repo: NotificationRepository;
  queue: QueueProducer;
  provider: NotificationProvider;
  config: Config;
  log: Logger;
  now: () => Date;
  newId: () => string;
};

/**
 * Real implementations. The AWS clients honour AWS_ENDPOINT_URL_DYNAMODB / AWS_ENDPOINT_URL_SQS, which is how
 * the local runner points them at the emulators without any code change here.
 */
export const buildDeps = (config: Config = loadConfig()): Deps => {
  const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });
  return {
    repo: createDynamoNotificationRepository({ client: dynamo, tableName: config.tableName }),
    queue: createSqsProducer({ client: new SQSClient({}), queueUrl: config.queueUrl }),
    provider: createSimulatedProvider({ failureRate: config.simulatedFailureRate }),
    config,
    log: createLogger(config.logLevel),
    now: () => new Date(),
    newId: randomUUID,
  };
};

let cached: Deps | undefined;

/** Built on first use and reused for the container's lifetime, so warm invocations share SDK connections. */
export const getDeps = (): Deps => (cached ??= buildDeps());
