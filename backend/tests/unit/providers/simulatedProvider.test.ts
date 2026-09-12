import { ProviderError } from '../../../src/providers/notificationProvider';
import { createSimulatedProvider } from '../../../src/providers/simulatedProvider';
import { stored } from '../../helpers/fixtures';

describe('simulated provider', () => {
  test('accepts and returns a message id derived from the request', async () => {
    const provider = createSimulatedProvider({ failureRate: 0.5, random: () => 0.9 });
    await expect(provider.send(stored({ attempts: 2 }))).resolves.toEqual({
      providerMessageId: 'sim-3f0c9a52-2',
    });
  });

  test('"fail" in the recipient is a permanent error', async () => {
    const provider = createSimulatedProvider({ failureRate: 0, random: () => 0.9 });
    await expect(provider.send(stored({ recipient: 'FAIL@example.com' }))).rejects.toEqual(
      expect.objectContaining({ retryable: false }),
    );
  });

  test('random below the failure rate is a transient error', async () => {
    const provider = createSimulatedProvider({ failureRate: 0.2, random: () => 0.1 });
    const error = await provider.send(stored()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ retryable: true, message: 'Provider timeout' });
  });
});
