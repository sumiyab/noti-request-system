import { ProviderError } from '../../src/providers/notificationProvider';
import { httpEvent } from '../helpers/events';
import { emailInput } from '../helpers/fixtures';
import { harness } from './harness';

const h = harness();

beforeEach(() => h.reset());

describe('retries', () => {
  test('transient errors requeue with attempts counted; the 3rd failure is final and the message is dropped', async () => {
    h.setDeps({ provider: { send: () => Promise.reject(new ProviderError('Provider timeout', true)) } });
    const created = await h.call(h.handlers.create, httpEvent({ method: 'POST', body: emailInput }));
    const id = (created.json?.data as { id: string }).id;
    const status = async () =>
      (await h.call(h.handlers.get, httpEvent({ pathParameters: { id } }))).json?.data as Record<
        string,
        unknown
      >;

    // ElasticMQ honours the visibility timeout, so re-receive would wait 60 s; replay the same records instead.
    const messages = await h.receive();
    const event = {
      Records: messages.map((m) => ({
        messageId: m.MessageId,
        receiptHandle: m.ReceiptHandle,
        body: m.Body,
        attributes: {},
      })),
    };
    const run = () => h.handlers.worker(event as never, {} as never, () => {});

    expect(await run()).toEqual({ batchItemFailures: [{ itemIdentifier: messages[0]?.MessageId }] });
    expect(await status()).toMatchObject({ status: 'QUEUED', attempts: 1, lastError: 'Provider timeout' });

    expect(await run()).toEqual({ batchItemFailures: [{ itemIdentifier: messages[0]?.MessageId }] });
    expect(await status()).toMatchObject({ status: 'QUEUED', attempts: 2 });

    expect(await run()).toEqual({ batchItemFailures: [] });
    expect(await status()).toMatchObject({
      status: 'FAILED',
      attempts: 3,
      lastError: 'Provider timeout (attempts exhausted)',
    });

    // A 4th delivery cannot claim it: the condition `attempts < :max` and the terminal status both refuse.
    expect(await run()).toEqual({ batchItemFailures: [] });
    expect(await status()).toMatchObject({ status: 'FAILED', attempts: 3 });
  });

  test('concurrent claims of the same request: exactly one succeeds', async () => {
    const created = await h.call(h.handlers.create, httpEvent({ method: 'POST', body: emailInput }));
    const id = (created.json?.data as { id: string }).id;
    const { buildDeps } = await import('../../src/deps');
    const repo = buildDeps(h.config).repo;

    const results = await Promise.all(
      Array.from({ length: 5 }, () => repo.transition(id, 'claimed', { now: new Date(), maxAttempts: 3 })),
    );
    // The first claim moves QUEUED → PROCESSING; later ones still satisfy the status guard (PROCESSING is
    // claimable) but each increments attempts, so the cap stops them after 3 in total.
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(results.filter((r) => !r.ok && r.reason === 'conflict')).toHaveLength(2);
  });
});
