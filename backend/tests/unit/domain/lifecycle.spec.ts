import { STATUSES } from '@noti/shared';
import { TRANSITIONS, canTransition, isTerminal, type Transition } from '../../../src/domain/lifecycle';

const allowed: Record<Transition, string[]> = {
  enqueued: ['PENDING'],
  enqueueFailed: ['PENDING'],
  claimed: ['PENDING', 'QUEUED', 'PROCESSING'],
  sent: ['PROCESSING'],
  retryScheduled: ['PROCESSING'],
  failed: ['PROCESSING'],
};

describe('lifecycle', () => {
  test.each(Object.entries(allowed))('%s is allowed from exactly %j', (transition, from) => {
    for (const status of STATUSES) {
      expect(canTransition(transition as Transition, status)).toBe(from.includes(status));
    }
  });

  test('terminal states have no outgoing transition', () => {
    for (const transition of Object.keys(TRANSITIONS) as Transition[]) {
      expect(canTransition(transition, 'SENT')).toBe(false);
      expect(canTransition(transition, 'FAILED')).toBe(false);
    }
  });

  test('isTerminal', () => {
    expect(STATUSES.filter(isTerminal)).toEqual(['SENT', 'FAILED']);
  });
});
