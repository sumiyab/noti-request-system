import { httpEvent } from '../helpers/events';
import { emailInput, smsInput } from '../helpers/fixtures';
import { harness } from './harness';

const h = harness();

beforeEach(() => h.reset());

describe('create → queue → process', () => {
  test('a request is stored QUEUED, the pointer is on the queue, the worker marks it SENT', async () => {
    const created = await h.call(h.handlers.create, httpEvent({ method: 'POST', body: emailInput }));
    expect(created.statusCode).toBe(202);
    const id = (created.json?.data as { id: string }).id;
    expect(created.headers?.location).toBe(`/notifications/${id}`);
    expect(created.json).toMatchObject({
      data: { userId: emailInput.userId, status: 'QUEUED', attempts: 0 },
    });

    const { processed, failures } = await h.runWorkerOnce();
    expect(processed).toBe(1);
    expect(failures).toEqual([]);

    const fetched = await h.call(h.handlers.get, httpEvent({ pathParameters: { id } }));
    expect(fetched.statusCode).toBe(200);
    const data = fetched.json?.data as Record<string, unknown>;
    expect(data).toMatchObject({ id, status: 'SENT', attempts: 1 });
    expect(data.providerMessageId).toMatch(/^sim-/);
    expect(typeof data.completedAt).toBe('string');
  });

  test('SMS requests are stored without a subject attribute', async () => {
    const created = await h.call(h.handlers.create, httpEvent({ method: 'POST', body: smsInput }));
    const id = (created.json?.data as { id: string }).id;
    const fetched = await h.call(h.handlers.get, httpEvent({ pathParameters: { id } }));
    expect('subject' in (fetched.json?.data as object)).toBe(false);
  });

  test('a permanent provider error ends in FAILED with lastError and the message is deleted', async () => {
    const created = await h.call(
      h.handlers.create,
      httpEvent({ method: 'POST', body: { ...emailInput, recipient: 'fail@example.com' } }),
    );
    const id = (created.json?.data as { id: string }).id;

    const { failures } = await h.runWorkerOnce();
    expect(failures).toEqual([]);
    expect(await h.receive(1)).toHaveLength(0);

    const fetched = await h.call(h.handlers.get, httpEvent({ pathParameters: { id } }));
    expect(fetched.json).toMatchObject({
      data: { status: 'FAILED', attempts: 1, lastError: 'Recipient rejected by provider' },
    });
  });

  test('duplicate delivery after SENT is a no-op', async () => {
    const created = await h.call(h.handlers.create, httpEvent({ method: 'POST', body: emailInput }));
    const id = (created.json?.data as { id: string }).id;
    const messages = await h.receive();
    const event = {
      Records: messages.map((m) => ({
        messageId: m.MessageId,
        receiptHandle: m.ReceiptHandle,
        body: m.Body,
        attributes: {},
      })),
    };

    const first = await h.handlers.worker(event as never, {} as never, () => {});
    const second = await h.handlers.worker(event as never, {} as never, () => {});
    expect(first).toEqual({ batchItemFailures: [] });
    expect(second).toEqual({ batchItemFailures: [] });

    const fetched = await h.call(h.handlers.get, httpEvent({ pathParameters: { id } }));
    expect(fetched.json).toMatchObject({ data: { status: 'SENT', attempts: 1 } });
  });

  test('unexpected provider failures leave the item PROCESSING and report the record', async () => {
    h.setDeps({ provider: { send: () => Promise.reject(new TypeError('bug')) } });
    const created = await h.call(h.handlers.create, httpEvent({ method: 'POST', body: emailInput }));
    const id = (created.json?.data as { id: string }).id;

    const { failures } = await h.runWorkerOnce();
    expect(failures).toHaveLength(1);
    const fetched = await h.call(h.handlers.get, httpEvent({ pathParameters: { id } }));
    expect(fetched.json).toMatchObject({ data: { status: 'PROCESSING', attempts: 1 } });
  });
});
