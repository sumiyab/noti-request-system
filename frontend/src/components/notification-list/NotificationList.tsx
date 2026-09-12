'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useNotifications } from '@/hooks/useNotifications';
import { userIdSchema } from '@/schemas';
import { LoadMoreButton } from './LoadMoreButton';
import { NotificationRow } from './NotificationRow';
import { UserFilter } from './UserFilter';

const FILTER_DEBOUNCE_MS = 300;

const Message = ({ children, tone = 'muted' }: { children: string; tone?: 'muted' | 'error' }) => (
  <p
    className={tone === 'error' ? 'text-destructive text-sm' : 'text-muted-foreground text-sm'}
    role="status"
  >
    {children}
  </p>
);

/**
 * The typed filter, validated with the same schema the API uses: empty → no filter, valid → `{ userId }`,
 * invalid → an error to show and no query (the API would only answer 400).
 */
const resolveFilter = (raw: string): { userId?: string; error?: string | undefined } => {
  if (raw.trim() === '') return {};
  const result = userIdSchema.safeParse(raw);
  return result.success ? { userId: result.data } : { error: result.error.issues[0]?.message };
};

export const NotificationList = () => {
  const [filterInput, setFilterInput] = useState('');
  const { userId, error: filterError } = resolveFilter(useDebouncedValue(filterInput, FILTER_DEBOUNCE_MS));
  const query = useNotifications(userId === undefined ? {} : { userId });
  const items = query.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Requests</CardTitle>
        <CardDescription>
          {userId ? `Requests sent by ${userId}, newest first.` : 'Newest first.'} Updates automatically while
          a request is in flight.
        </CardDescription>
        <UserFilter value={filterInput} onChange={setFilterInput} error={filterError} />
      </CardHeader>
      <CardContent>
        {query.isPending && <Message>Loading requests…</Message>}
        {query.isError && <Message tone="error">{`Could not load requests: ${query.error.message}`}</Message>}
        {query.isSuccess && items.length === 0 && (
          <Message>
            {userId ? `No requests from ${userId} yet.` : 'No requests yet — submit one on the left.'}
          </Message>
        )}
        {items.length > 0 && (
          <ul className="divide-y" aria-label="Notification requests">
            {items.map((n) => (
              <NotificationRow key={n.id} notification={n} onSelectUser={setFilterInput} />
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
