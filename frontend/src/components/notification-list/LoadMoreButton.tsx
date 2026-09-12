import { Button } from '@/components/ui/button';

type Props = { hasMore: boolean; loading: boolean; onClick: () => void };

export const LoadMoreButton = ({ hasMore, loading, onClick }: Props) => {
  if (!hasMore) return null;
  return (
    <div className="flex justify-center pt-4">
      <Button variant="outline" onClick={onClick} disabled={loading}>
        {loading ? 'Loading…' : 'Load more'}
      </Button>
    </div>
  );
};
