import { describeOutcome, formatDuration, formatRelativeTime, isTerminal, truncate } from '@/lib/format';

const now = new Date('2026-09-12T12:00:00.000Z');

describe('formatRelativeTime', () => {
  test.each([
    ['2026-09-12T11:59:50.000Z', 'just now'],
    ['2026-09-12T11:57:00.000Z', '3 minutes ago'],
    ['2026-09-12T10:00:00.000Z', '2 hours ago'],
    ['2026-09-10T12:00:00.000Z', '2 days ago'],
  ])('%s → %s', (iso, expected) => {
    expect(formatRelativeTime(iso, now)).toBe(expected);
  });
});

test('isTerminal', () => {
  expect(isTerminal('SENT')).toBe(true);
  expect(isTerminal('FAILED')).toBe(true);
  expect(isTerminal('QUEUED')).toBe(false);
});

test('truncate keeps short text and shortens long text with an ellipsis', () => {
  expect(truncate('short')).toBe('short');
  expect(truncate('x'.repeat(100), 10)).toBe(`${'x'.repeat(9)}…`);
});

describe('formatDuration', () => {
  test.each([
    ['2026-09-12T04:00:01.400Z', '1.4 s'],
    ['2026-09-12T04:02:05.000Z', '2 m 05 s'],
    ['2026-09-12T05:03:00.000Z', '1 h 03 m'],
  ])('to %s → %s', (to, expected) => {
    expect(formatDuration('2026-09-12T04:00:00.000Z', to)).toBe(expected);
  });
});

describe('describeOutcome', () => {
  const at = { createdAt: '2026-09-12T04:00:00.000Z', completedAt: '2026-09-12T04:00:02.000Z' };
  test.each([
    [{ status: 'SENT', attempts: 1, ...at }, 'sent in 2.0 s'],
    [{ status: 'SENT', attempts: 2, ...at }, 'sent in 2.0 s · 2 attempts'],
    [{ status: 'FAILED', attempts: 3, ...at }, 'failed after 3 attempts · 2.0 s'],
    [{ status: 'FAILED', attempts: 0, ...at }, 'could not be queued'],
    [{ status: 'PROCESSING', attempts: 2, createdAt: at.createdAt }, 'attempt 2'],
    [{ status: 'QUEUED', attempts: 0, createdAt: at.createdAt }, ''],
  ] as const)('%o → %s', (input, expected) => {
    expect(describeOutcome(input)).toBe(expected);
  });
});
