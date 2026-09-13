import { Button } from '@/components/ui/button';

type Props = { count: number; hasMore: boolean; loading: boolean; onLoadMore: () => void };

const plural = (n: number) => (n === 1 ? 'request' : 'requests');

/** Where the reader is in the list: how many are shown, whether more exist, and the way to get them. */
export const ListFooter = ({ count, hasMore, loading, onLoadMore }: Props) => {
  if (count === 0) return null;
  return (
    <div className="flex flex-col items-center gap-3 pt-4 sm:flex-row sm:justify-between">
      <p className="text-muted-foreground text-sm" aria-live="polite" data-testid="list-footer">
        {hasMore
          ? `Showing ${count} ${plural(count)} · more available`
          : `Showing all ${count} ${plural(count)}`}
      </p>
      {hasMore && (
        <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loading}>
          {loading ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </div>
  );
};
