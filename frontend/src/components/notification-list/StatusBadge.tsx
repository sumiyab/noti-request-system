import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { STATUS_LABELS } from '@/lib/format';
import type { NotificationStatus } from '@/schemas';

const STYLES: Record<NotificationStatus, string> = {
  PENDING: 'border-transparent bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200',
  QUEUED: 'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  PROCESSING: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  SENT: 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  FAILED: 'border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
};

const LIVE: ReadonlySet<NotificationStatus> = new Set(['PENDING', 'QUEUED', 'PROCESSING']);

/** Colour-coded status. `role="status"` makes changes announced by screen readers as the list polls. */
export const StatusBadge = ({ status, className }: { status: NotificationStatus; className?: string }) => (
  <Badge
    variant="outline"
    role="status"
    data-status={status}
    className={cn(STYLES[status], LIVE.has(status) && 'animate-pulse', className)}
  >
    {STATUS_LABELS[status]}
  </Badge>
);
