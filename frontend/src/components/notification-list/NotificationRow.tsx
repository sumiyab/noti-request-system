import { BellIcon, MailIcon, MessageSquareIcon } from 'lucide-react';
import { cn } from 'cn';
import { CHANNEL_LABELS, describeOutcome, formatRelativeTime, truncate } from '@/lib/format';
import { rowElementId } from '@/lib/recent';
import type { Channel, Notification } from '@/schemas';
import { StatusBadge } from './StatusBadge';

const CHANNEL_ICONS: Record<Channel, typeof MailIcon> = {
  EMAIL: MailIcon,
  SMS: MessageSquareIcon,
  PUSH: BellIcon,
};

type Props = {
  notification: Notification;
  /** Called with the sender's id when it is clicked — the list uses it to filter to that user. */
  onSelectUser?: (userId: string) => void;
  /** Briefly emphasised: the request the user just created. */
  recent?: boolean;
};

export const NotificationRow = ({ notification: n, onSelectUser, recent = false }: Props) => {
  const Icon = CHANNEL_ICONS[n.channel];
  const outcome = describeOutcome(n);
  const created = new Date(n.createdAt);
  return (
    <li
      id={rowElementId(n.id)}
      data-testid="notification-row"
      data-recent={recent || undefined}
      className={cn(
        'flex scroll-mt-24 flex-col gap-2 rounded-lg py-4 transition-colors sm:flex-row sm:items-start sm:gap-4',
        recent && 'animate-highlight',
      )}
    >
      <div className="flex shrink-0 items-center gap-2 sm:w-40 sm:flex-col sm:items-start">
        <StatusBadge status={n.status} />
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
          <Icon className="size-3.5" aria-hidden="true" />
          {CHANNEL_LABELS[n.channel]}
        </span>
        {outcome && <span className="text-muted-foreground text-xs">{outcome}</span>}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{n.recipient}</p>
        <p className="text-muted-foreground truncate text-xs">
          from{' '}
          {onSelectUser ? (
            <button
              type="button"
              onClick={() => onSelectUser(n.userId)}
              title={`Show only requests from ${n.userId}`}
              className="hover:text-foreground underline-offset-2 hover:underline"
            >
              {n.userId}
            </button>
          ) : (
            n.userId
          )}
        </p>
        {n.subject && <p className="truncate text-sm">{n.subject}</p>}
        <p className="text-muted-foreground text-sm">{truncate(n.message)}</p>
        {n.lastError && (
          <p className="text-destructive mt-1 text-sm" role="note">
            {n.lastError}
          </p>
        )}
      </div>

      <time
        dateTime={n.createdAt}
        title={created.toLocaleString()}
        className="text-muted-foreground shrink-0 text-xs sm:text-right"
      >
        {formatRelativeTime(n.createdAt)}
      </time>
    </li>
  );
};
