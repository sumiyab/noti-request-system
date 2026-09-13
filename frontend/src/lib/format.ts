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

/** "1.4 s", "2 m 05 s", "1 h 03 m" — how long a request took from creation to its terminal state. */
export const formatDuration = (fromIso: string, toIso: string) => {
  const ms = Math.max(0, new Date(toIso).getTime() - new Date(fromIso).getTime());
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} m ${String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0')} s`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} m`;
};

/** The second line of a row: what happened and how long it took. Empty while nothing has happened yet. */
export const describeOutcome = (n: {
  status: NotificationStatus;
  attempts: number;
  createdAt: string;
  completedAt?: string | undefined;
}) => {
  const tries = `${n.attempts} ${n.attempts === 1 ? 'attempt' : 'attempts'}`;
  if (n.status === 'SENT') {
    const took = n.completedAt ? `sent in ${formatDuration(n.createdAt, n.completedAt)}` : 'sent';
    return n.attempts > 1 ? `${took} · ${tries}` : took;
  }
  if (n.status === 'FAILED') {
    const took = n.completedAt ? ` · ${formatDuration(n.createdAt, n.completedAt)}` : '';
    return n.attempts > 0 ? `failed after ${tries}${took}` : 'could not be queued';
  }
  return n.attempts > 0 ? `attempt ${n.attempts}` : '';
};
