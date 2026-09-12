import { createNotification } from '../../../src/services/createNotification';
import { makeDeps } from '../../helpers/fakes';
import { ID, NOW, emailInput, smsInput } from '../../helpers/fixtures';

describe('createNotification', () => {
  test('stores PENDING, enqueues a pointer, marks QUEUED, returns the item', async () => {
    const deps = makeDeps();
    const result = await createNotification(deps, emailInput);

    expect(deps.queue.sent).toEqual([{ notificationId: ID }]);
    expect(result).toEqual({
      id: ID,
      ...emailInput,
      status: 'QUEUED',
      attempts: 0,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    expect(deps.repo.items.get(ID)?.status).toBe('QUEUED');
  });

  test('SMS items carry no subject key', async () => {
    const deps = makeDeps();
    const result = await createNotification(deps, smsInput);
    expect('subject' in result).toBe(false);
  });

  test('marks FAILED and throws ENQUEUE_FAILED when the queue send fails', async () => {
    const deps = makeDeps();
    deps.queue.failWith = new Error('sqs down');

    await expect(createNotification(deps, emailInput)).rejects.toMatchObject({
      code: 'ENQUEUE_FAILED',
      status: 503,
    });
    expect(deps.repo.items.get(ID)).toMatchObject({
      status: 'FAILED',
      lastError: 'Could not enqueue the request',
      completedAt: NOW.toISOString(),
    });
  });

  test('returns the current item when the worker claimed it before the QUEUED update', async () => {
    const deps = makeDeps();
    const originalSend = deps.queue.send;
    // Simulate the worker racing ahead: by the time the send resolves, the item is already PROCESSING.
    deps.queue.send = async (message) => {
      await originalSend(message);
      await deps.repo.transition(ID, 'claimed', { now: NOW, maxAttempts: 3 });
    };

    const result = await createNotification(deps, emailInput);
    expect(result.status).toBe('PROCESSING');
    expect(result.attempts).toBe(1);
  });
});
