import { ProviderError, type NotificationProvider } from './notificationProvider';

type Options = {
  /** Probability of a transient failure per attempt, 0–1. */
  failureRate: number;
  /** Injected so tests are deterministic. */
  random?: () => number;
  /** Simulated network latency. */
  latencyMs?: number;
};

/**
 * Stands in for a real provider and exercises every branch of the lifecycle:
 *  - a recipient containing "fail" → permanent error (no retry)
 *  - otherwise, with probability `failureRate` → transient error (retried)
 *  - otherwise → accepted, with a provider message id
 */
export const createSimulatedProvider = ({
  failureRate,
  random = Math.random,
  latencyMs = 0,
}: Options): NotificationProvider => ({
  send: async (notification) => {
    if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs));
    if (notification.recipient.toLowerCase().includes('fail')) {
      throw new ProviderError('Recipient rejected by provider', false);
    }
    if (random() < failureRate) {
      throw new ProviderError('Provider timeout', true);
    }
    return { providerMessageId: `sim-${notification.id.slice(0, 8)}-${notification.attempts}` };
  },
});
