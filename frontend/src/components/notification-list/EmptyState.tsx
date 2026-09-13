import { InboxIcon } from 'lucide-react';

type Props = { userId?: string | undefined };

export const EmptyState = ({ userId }: Props) => (
  <div className="flex flex-col items-center gap-2 py-10 text-center" role="status">
    <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
      <InboxIcon className="size-5" aria-hidden="true" />
    </span>
    <p className="font-medium">{userId ? `No requests from ${userId} yet` : 'No requests yet'}</p>
    <p className="text-muted-foreground max-w-xs text-sm">
      {userId
        ? 'Requests they send will appear here as they move through the queue.'
        : 'Submit one on the left — it appears here and updates live as it moves through the queue.'}
    </p>
  </div>
);
