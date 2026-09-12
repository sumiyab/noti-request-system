import type { Channel, NotificationStatus } from '@/schemas';
import { TERMINAL_STATUSES } from '@/schemas';

export const CHANNEL_LABELS: Record<Channel, string> = { EMAIL: 'Email', SMS: 'SMS', PUSH: 'Push' };

export const STATUS_LABELS: Record<NotificationStatus, string> = {
  PENDING: 'Pending',
  QUEUED: 'Queued',
  PROCESSING: 'Processing',
  SENT: 'Sent',
  FAILED: 'Failed',
};

export const isTerminal = (status: NotificationStatus) =>
  (TERMINAL_STATUSES as readonly NotificationStatus[]).includes(status);

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

/** "just now", "3 minutes ago", "2 hours ago" — relative to `now` for testability. */
export const formatRelativeTime = (iso: string, now: Date = new Date()) => {
  const diff = new Date(iso).getTime() - now.getTime();
  const abs = Math.abs(diff);
  if (abs < 30_000) return 'just now';
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, ms] of UNITS) {
    if (abs >= ms) return formatter.format(Math.round(diff / ms), unit);
  }
  return formatter.format(Math.round(diff / 1000), 'second');
};

export const truncate = (text: string, max = 80) =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;
