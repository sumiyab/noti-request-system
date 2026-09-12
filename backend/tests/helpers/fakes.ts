import type { Notification } from '@noti/shared';
import type { Deps } from '../../src/deps';
import { TRANSITIONS, canTransition, isTerminal } from '../../src/domain/lifecycle';
import type { Config } from '../../src/lib/config';
import { noopLogger } from '../../src/lib/logger';
import type { NotificationProvider } from '../../src/providers/notificationProvider';
import type { QueueMessage } from '../../src/queue/message';
import type { NotificationRepository } from '../../src/repositories/notificationRepository';
import { ID, NOW } from './fixtures';

/** In-memory repository that enforces the same transition rules as the DynamoDB one. */
export class FakeRepository implements NotificationRepository {
  readonly items = new Map<string, Notification>();

  seed = (notification: Notification) => {
    this.items.set(notification.id, { ...notification });
    return this;
  };

  create: NotificationRepository['create'] = async (notification) => {
    if (this.items.has(notification.id)) throw new Error('duplicate id');
    this.items.set(notification.id, { ...notification });
  };

  get: NotificationRepository['get'] = async (id) => this.items.get(id) ?? null;

  list: NotificationRepository['list'] = async ({ limit, cursor, userId }) => {
    const all = [...this.items.values()]
      .filter((n) => userId === undefined || n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const start = cursor ? Number(cursor) : 0;
    const data = all.slice(start, start + limit);
    return { data, nextCursor: start + limit < all.length ? String(start + limit) : null };
  };

  transition: NotificationRepository['transition'] = async (id, transition, options) => {
    const current = this.items.get(id);
    if (!current) return { ok: false, reason: 'not_found' };
    if (!canTransition(transition, current.status)) return { ok: false, reason: 'conflict' };
    if (transition === 'claimed' && current.attempts >= (options.maxAttempts ?? Infinity)) {
      return { ok: false, reason: 'conflict' };
    }
    const to = TRANSITIONS[transition].to;
    const now = options.now.toISOString();
    const next: Notification = {
      ...current,
      status: to,
      updatedAt: now,
      ...(transition === 'claimed' && { attempts: current.attempts + 1 }),
      ...(options.lastError !== undefined && { lastError: options.lastError }),
      ...(options.providerMessageId !== undefined && { providerMessageId: options.providerMessageId }),
      ...(isTerminal(to) && { completedAt: now }),
    };
    this.items.set(id, next);
    return { ok: true, notification: next };
  };
}

export class FakeQueue {
  readonly sent: QueueMessage[] = [];
  failWith: Error | undefined;

  send = async (message: QueueMessage) => {
    if (this.failWith) throw this.failWith;
    this.sent.push(message);
  };
}

export const providerThat = (
  behaviour: (n: Notification) => { providerMessageId: string } | Error,
): NotificationProvider & { calls: Notification[] } => {
  const calls: Notification[] = [];
  return {
    calls,
    send: async (n) => {
      calls.push(n);
      const result = behaviour(n);
      if (result instanceof Error) throw result;
      return result;
    },
  };
};

export const testConfig: Config = {
  tableName: 'notification-requests-test',
  queueUrl: 'http://localhost:9324/000000000000/notification-requests',
  maxAttempts: 3,
  simulatedFailureRate: 0,
  logLevel: 'error',
};

export type FakeDeps = Deps & { repo: FakeRepository; queue: FakeQueue };

export const makeDeps = (overrides: Partial<Deps> = {}): FakeDeps =>
  ({
    repo: new FakeRepository(),
    queue: new FakeQueue(),
    provider: providerThat((n) => ({ providerMessageId: `sim-${n.id.slice(0, 8)}` })),
    config: testConfig,
    log: noopLogger,
    now: () => NOW,
    newId: () => ID,
    ...overrides,
  }) as FakeDeps;
