import { formatRelativeTime, isTerminal, truncate } from '@/lib/format';

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
