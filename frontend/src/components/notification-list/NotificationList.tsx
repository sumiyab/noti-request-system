'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNotifications } from '@/hooks/useNotifications';
import { LoadMoreButton } from './LoadMoreButton';
import { NotificationRow } from './NotificationRow';

const Message = ({ children, tone = 'muted' }: { children: string; tone?: 'muted' | 'error' }) => (
  <p
    className={tone === 'error' ? 'text-destructive text-sm' : 'text-muted-foreground text-sm'}
    role="status"
  >
    {children}
  </p>
);

export const NotificationList = () => {
  const query = useNotifications();
  const items = query.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Requests</CardTitle>
        <CardDescription>Newest first. Updates automatically while a request is in flight.</CardDescription>
      </CardHeader>
      <CardContent>
        {query.isPending && <Message>Loading requests…</Message>}
        {query.isError && <Message tone="error">{`Could not load requests: ${query.error.message}`}</Message>}
        {query.isSuccess && items.length === 0 && (
          <Message>No requests yet — submit one on the left.</Message>
        )}
        {items.length > 0 && (
          <ul className="divide-y" aria-label="Notification requests">
            {items.map((n) => (
              <NotificationRow key={n.id} notification={n} />
            ))}
          </ul>
        )}
        <LoadMoreButton
          hasMore={query.hasNextPage}
          loading={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        />
      </CardContent>
    </Card>
  );
};
