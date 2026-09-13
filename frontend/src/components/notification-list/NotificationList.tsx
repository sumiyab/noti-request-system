'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useNotifications } from '@/hooks/useNotifications';
import { isTerminal } from '@/lib/format';
import { useRecentId } from '@/lib/recent';
import { userIdSchema } from '@/schemas';
import { EmptyState } from './EmptyState';
import { ListFooter } from './ListFooter';
import { ListSkeleton } from './ListSkeleton';
import { LiveIndicator } from './LiveIndicator';
import { NotificationRow } from './NotificationRow';
import { UserFilter } from './UserFilter';

const FILTER_DEBOUNCE_MS = 300;

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
  const recentId = useRecentId();
  const items = query.data?.pages.flatMap((page) => page.data) ?? [];
  const live = items.some((n) => !isTerminal(n.status));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Requests</CardTitle>
            <CardDescription className="mt-1">
              {userId ? `Sent by ${userId}, newest first.` : 'Newest first.'}
            </CardDescription>
          </div>
          <LiveIndicator live={live} updatedAt={query.dataUpdatedAt || undefined} />
        </div>
        <UserFilter value={filterInput} onChange={setFilterInput} error={filterError} />
      </CardHeader>
      <CardContent>
        {query.isPending && <ListSkeleton />}
        {query.isError && (
          <p className="text-destructive text-sm" role="status">
            {`Could not load requests: ${query.error.message}`}
          </p>
        )}
        {query.isSuccess && items.length === 0 && <EmptyState userId={userId} />}
        {items.length > 0 && (
          <ul className="divide-y" aria-label="Notification requests">
            {items.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                onSelectUser={setFilterInput}
                recent={n.id === recentId}
              />
            ))}
          </ul>
        )}
        <ListFooter
          count={items.length}
          hasMore={query.hasNextPage}
          loading={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
        />
      </CardContent>
    </Card>
  );
};
