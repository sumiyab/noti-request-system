import { ProviderError } from '../../../src/providers/notificationProvider';
import { processNotification } from '../../../src/services/processNotification';
import { ID, NOW, stored } from '../../helpers/fixtures';
import { makeDeps, refused, transitioned } from '../../helpers/mocks';

const message = { notificationId: ID };
const claimed = (attempts: number) => transitioned(stored({ status: 'PROCESSING', attempts }));
const claim = { now: NOW, maxAttempts: 3 };

describe('processNotification', () => {
  test('claims, sends, marks SENT → done', async () => {
    const deps = makeDeps();
    deps.repo.transition.mockResolvedValueOnce(claimed(1));

    await expect(processNotification(deps, message)).resolves.toBe('done');

    expect(deps.repo.transition).toHaveBeenNthCalledWith(1, ID, 'claimed', claim);
    expect(deps.provider.send).toHaveBeenCalledWith(stored({ status: 'PROCESSING', attempts: 1 }));
    expect(deps.repo.transition).toHaveBeenNthCalledWith(2, ID, 'sent', {
      now: NOW,
      providerMessageId: 'sim-3f0c9a52',
    });
  });

  test('permanent provider error → FAILED, done, no retry', async () => {
    const deps = makeDeps();
    deps.repo.transition.mockResolvedValueOnce(claimed(1));
    deps.provider.send.mockRejectedValueOnce(new ProviderError('Recipient rejected', false));

    await expect(processNotification(deps, message)).resolves.toBe('done');

    expect(deps.repo.transition).toHaveBeenNthCalledWith(2, ID, 'failed', {
      now: NOW,
      lastError: 'Recipient rejected',
    });
  });

  test('transient error with attempts left → back to QUEUED, retry', async () => {
    const deps = makeDeps();
    deps.repo.transition.mockResolvedValueOnce(claimed(2));
    deps.provider.send.mockRejectedValueOnce(new ProviderError('Provider timeout', true));

    await expect(processNotification(deps, message)).resolves.toBe('retry');

    expect(deps.repo.transition).toHaveBeenNthCalledWith(2, ID, 'retryScheduled', {
      now: NOW,
      lastError: 'Provider timeout',
    });
  });

  test('transient error on the last attempt → FAILED, done', async () => {
    const deps = makeDeps();
    deps.repo.transition.mockResolvedValueOnce(claimed(3));
    deps.provider.send.mockRejectedValueOnce(new ProviderError('Provider timeout', true));

    await expect(processNotification(deps, message)).resolves.toBe('done');

    expect(deps.repo.transition).toHaveBeenNthCalledWith(2, ID, 'failed', {
      now: NOW,
      lastError: 'Provider timeout (attempts exhausted)',
    });
  });

  test.each([
    ['a finished request (duplicate delivery)', refused('conflict')],
    ['a request over the attempt cap', refused('conflict')],
    ['an unknown id', refused('not_found')],
  ])('%s is skipped without calling the provider', async (_name, result) => {
    const deps = makeDeps();
    deps.repo.transition.mockResolvedValueOnce(result);

    await expect(processNotification(deps, message)).resolves.toBe('done');

    expect(deps.provider.send).not.toHaveBeenCalled();
    expect(deps.repo.transition).toHaveBeenCalledTimes(1);
  });

  test('non-provider errors propagate without recording an outcome', async () => {
    const deps = makeDeps();
    deps.repo.transition.mockResolvedValueOnce(claimed(1));
    deps.provider.send.mockRejectedValueOnce(new TypeError('bug'));

    await expect(processNotification(deps, message)).rejects.toThrow('bug');

    expect(deps.repo.transition).toHaveBeenCalledTimes(1); // only the claim; the item stays PROCESSING
  });
});
