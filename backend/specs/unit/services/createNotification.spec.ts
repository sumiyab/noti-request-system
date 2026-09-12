import { createNotification } from '../../../src/services/createNotification';
import { ID, NOW, emailInput, smsInput, stored } from '../../helpers/fixtures';
import { makeDeps, refused, transitioned } from '../../helpers/mocks';

const pending = (overrides = {}) => stored({ status: 'PENDING', ...overrides });

describe('createNotification', () => {
  test('stores PENDING, enqueues a pointer, marks QUEUED, returns the item', async () => {
    const deps = makeDeps();
    deps.repo.transition.mockResolvedValueOnce(transitioned(stored({ status: 'QUEUED' })));

    const result = await createNotification(deps, emailInput);

    expect(deps.repo.create).toHaveBeenCalledWith(pending());
    expect(deps.queue.send).toHaveBeenCalledWith({ notificationId: ID });
    expect(deps.repo.transition).toHaveBeenCalledWith(ID, 'enqueued', { now: NOW });
    expect(result).toEqual(stored({ status: 'QUEUED' }));
  });

  test('SMS items carry no subject key', async () => {
    const deps = makeDeps();
    deps.repo.transition.mockResolvedValueOnce(transitioned(stored({ ...smsInput, status: 'QUEUED' })));

    await createNotification(deps, smsInput);

    const [written] = deps.repo.create.mock.calls[0]!;
    expect('subject' in written).toBe(false);
  });

  test('writes DynamoDB before SQS, so a queued pointer always has an item behind it', async () => {
    const deps = makeDeps();
    deps.repo.transition.mockResolvedValueOnce(transitioned(stored({ status: 'QUEUED' })));

    await createNotification(deps, emailInput);

    expect(deps.repo.create.mock.invocationCallOrder[0]).toBeLessThan(
      deps.queue.send.mock.invocationCallOrder[0]!,
    );
  });

  test('marks FAILED and throws ENQUEUE_FAILED when the queue send fails', async () => {
    const deps = makeDeps();
    deps.queue.send.mockRejectedValueOnce(new Error('sqs down'));
    deps.repo.transition.mockResolvedValueOnce(transitioned(stored({ status: 'FAILED' })));

    await expect(createNotification(deps, emailInput)).rejects.toMatchObject({
      code: 'ENQUEUE_FAILED',
      status: 503,
    });
    expect(deps.repo.transition).toHaveBeenCalledWith(ID, 'enqueueFailed', {
      now: NOW,
      lastError: 'Could not enqueue the request',
    });
    expect(deps.repo.transition).not.toHaveBeenCalledWith(ID, 'enqueued', expect.anything());
  });

  test('returns the current item when the worker claimed it before the QUEUED update', async () => {
    const deps = makeDeps();
    const claimed = stored({ status: 'PROCESSING', attempts: 1 });
    deps.repo.transition.mockResolvedValueOnce(refused('conflict'));
    deps.repo.get.mockResolvedValueOnce(claimed);

    const result = await createNotification(deps, emailInput);

    expect(deps.repo.get).toHaveBeenCalledWith(ID);
    expect(result).toEqual(claimed);
  });
});
