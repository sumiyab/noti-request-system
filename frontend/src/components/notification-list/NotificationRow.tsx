import { CHANNEL_LABELS, formatRelativeTime, truncate } from '@/lib/format';
import type { Notification } from '@/schemas';
import { StatusBadge } from './StatusBadge';

type Props = {
  notification: Notification;
  /** Called with the sender's id when it is clicked — the list uses it to filter to that user. */
  onSelectUser?: (userId: string) => void;
};

export const NotificationRow = ({ notification: n, onSelectUser }: Props) => (
  <li className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:gap-4" data-testid="notification-row">
    <div className="flex shrink-0 items-center gap-2 sm:w-40 sm:flex-col sm:items-start">
      <StatusBadge status={n.status} />
      <span className="text-muted-foreground text-xs">
        {CHANNEL_LABELS[n.channel]}
        {n.attempts > 0 && ` · attempt ${n.attempts}`}
      </span>
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

    <time dateTime={n.createdAt} className="text-muted-foreground shrink-0 text-xs sm:text-right">
      {formatRelativeTime(n.createdAt)}
    </time>
  </li>
);
