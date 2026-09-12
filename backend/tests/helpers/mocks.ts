import type { Notification } from '@noti/shared';
import type { Deps } from '../../src/deps';
import type { Config } from '../../src/lib/config';
import { noopLogger } from '../../src/lib/logger';
import type { NotificationProvider } from '../../src/providers/notificationProvider';
import type { QueueProducer } from '../../src/queue/producer';
import type { NotificationRepository, TransitionResult } from '../../src/repositories/notificationRepository';
import { ID, NOW } from './fixtures';

/**
 * Every dependency is a `jest.fn()` with a harmless default, so a test only stubs the calls it cares about
 * and asserts on the calls it expects. `clearMocks` in the Jest config resets call history between tests.
 */
export type MockDeps = Deps & {
  repo: jest.Mocked<NotificationRepository>;
  queue: jest.Mocked<QueueProducer>;
  provider: jest.Mocked<NotificationProvider>;
};

export const mockRepo = (): jest.Mocked<NotificationRepository> => ({
  create: jest.fn<Promise<void>, [Notification]>().mockResolvedValue(undefined),
  get: jest.fn<Promise<Notification | null>, [string]>().mockResolvedValue(null),
  list: jest
    .fn<ReturnType<NotificationRepository['list']>, Parameters<NotificationRepository['list']>>()
    .mockResolvedValue({ data: [], nextCursor: null }),
  transition: jest
    .fn<Promise<TransitionResult>, Parameters<NotificationRepository['transition']>>()
    .mockResolvedValue({ ok: false, reason: 'not_found' }),
});

export const mockQueue = (): jest.Mocked<QueueProducer> => ({
  send: jest.fn<Promise<void>, Parameters<QueueProducer['send']>>().mockResolvedValue(undefined),
});

export const mockProvider = (): jest.Mocked<NotificationProvider> => ({
  send: jest
    .fn<Promise<{ providerMessageId: string }>, [Notification]>()
    .mockImplementation((n) => Promise.resolve({ providerMessageId: `sim-${n.id.slice(0, 8)}` })),
});

export const testConfig: Config = {
  tableName: 'notification-requests-test',
  queueUrl: 'http://localhost:9324/000000000000/notification-requests',
  maxAttempts: 3,
  simulatedFailureRate: 0,
  logLevel: 'error',
};

export const makeDeps = (
  overrides: Partial<Pick<Deps, 'config' | 'log' | 'now' | 'newId'>> = {},
): MockDeps => ({
  repo: mockRepo(),
  queue: mockQueue(),
  provider: mockProvider(),
  config: testConfig,
  log: noopLogger,
  now: () => NOW,
  newId: () => ID,
  ...overrides,
});

/** A successful transition result carrying the given item. */
export const transitioned = (notification: Notification): TransitionResult => ({ ok: true, notification });

/** A failed transition: `conflict` (state guard refused) or `not_found`. */
export const refused = (reason: 'conflict' | 'not_found'): TransitionResult => ({ ok: false, reason });
