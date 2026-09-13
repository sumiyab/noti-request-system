import { Skeleton } from '@/components/ui/skeleton';

/** Three placeholder rows shaped like real ones, so the layout does not jump when data arrives. */
export const ListSkeleton = () => (
  <ul role="status" aria-label="Loading requests" className="divide-y">
    <li className="sr-only">Loading requests…</li>
    {[0, 1, 2].map((i) => (
      <li key={i} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:gap-4" aria-hidden="true">
        <div className="flex shrink-0 gap-2 sm:w-40 sm:flex-col">
          <Skeleton className="h-5 w-16 rounded-4xl" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-full max-w-md" />
        </div>
        <Skeleton className="h-3 w-16" />
      </li>
    ))}
  </ul>
);
