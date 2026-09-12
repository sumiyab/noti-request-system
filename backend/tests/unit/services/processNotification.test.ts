import { ProviderError } from '../../../src/providers/notificationProvider';
import { processNotification } from '../../../src/services/processNotification';
import { makeDeps, providerThat } from '../../helpers/fakes';
import { ID, NOW, stored } from '../../helpers/fixtures';

const message = { notificationId: ID };

describe('processNotification', () => {
  test('claims, sends, marks SENT → done', async () => {
    const deps = makeDeps();
    deps.repo.seed(stored({ status: 'QUEUED' }));

    await expect(processNotification(deps, message)).resolves.toBe('done');
    expect(deps.repo.items.get(ID)).toMatchObject({
      status: 'SENT',
      attempts: 1,
      providerMessageId: 'sim-3f0c9a52',
      completedAt: NOW.toISOString(),
    });
  });

  test('permanent provider error → FAILED, done, no retry', async () => {
    const deps = makeDeps({ provider: providerThat(() => new ProviderError('Recipient rejected', false)) });
    deps.repo.seed(stored({ status: 'QUEUED' }));

    await expect(processNotification(deps, message)).resolves.toBe('done');
    expect(deps.repo.items.get(ID)).toMatchObject({
      status: 'FAILED',
      attempts: 1,
      lastError: 'Recipient rejected',
    });
  });

  test('transient error with attempts left → back to QUEUED, retry', async () => {
    const deps = makeDeps({ provider: providerThat(() => new ProviderError('Provider timeout', true)) });
    deps.repo.seed(stored({ status: 'QUEUED', attempts: 1 }));

    await expect(processNotification(deps, message)).resolves.toBe('retry');
    expect(deps.repo.items.get(ID)).toMatchObject({
      status: 'QUEUED',
      attempts: 2,
      lastError: 'Provider timeout',
    });
    expect(deps.repo.items.get(ID)?.completedAt).toBeUndefined();
  });

  test('transient error on the last attempt → FAILED, done', async () => {
    const deps = makeDeps({ provider: providerThat(() => new ProviderError('Provider timeout', true)) });
    deps.repo.seed(stored({ status: 'QUEUED', attempts: 2 }));

    await expect(processNotification(deps, message)).resolves.toBe('done');
    expect(deps.repo.items.get(ID)).toMatchObject({
      status: 'FAILED',
      attempts: 3,
      lastError: 'Provider timeout (attempts exhausted)',
    });
  });

  test('duplicate delivery of a finished request is skipped without calling the provider', async () => {
    const provider = providerThat((n) => ({ providerMessageId: n.id }));
    const deps = makeDeps({ provider });
    deps.repo.seed(stored({ status: 'SENT', attempts: 1 }));

    await expect(processNotification(deps, message)).resolves.toBe('done');
    expect(provider.calls).toHaveLength(0);
    expect(deps.repo.items.get(ID)?.status).toBe('SENT');
  });

  test('the attempt cap is enforced by the claim, not only by the counter', async () => {
    const provider = providerThat((n) => ({ providerMessageId: n.id }));
    const deps = makeDeps({ provider });
    deps.repo.seed(stored({ status: 'QUEUED', attempts: 3 }));

    await expect(processNotification(deps, message)).resolves.toBe('done');
    expect(provider.calls).toHaveLength(0);
  });

  test('an unknown id is skipped', async () => {
    await expect(processNotification(makeDeps(), message)).resolves.toBe('done');
  });

  test('a crashed previous attempt (still PROCESSING) can be claimed again', async () => {
    const deps = makeDeps();
    deps.repo.seed(stored({ status: 'PROCESSING', attempts: 1 }));
    await expect(processNotification(deps, message)).resolves.toBe('done');
    expect(deps.repo.items.get(ID)).toMatchObject({ status: 'SENT', attempts: 2 });
  });

  test('non-provider errors propagate so the handler can report the record', async () => {
    const deps = makeDeps({ provider: providerThat(() => new TypeError('bug')) });
    deps.repo.seed(stored({ status: 'QUEUED' }));
    await expect(processNotification(deps, message)).rejects.toThrow('bug');
    expect(deps.repo.items.get(ID)?.status).toBe('PROCESSING');
  });
});
