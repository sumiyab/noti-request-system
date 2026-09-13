import { cn } from 'cn';

type Props = { live: boolean; updatedAt: number | undefined };

/** Tells the reader whether the list is still polling (something is in flight) or settled. */
export const LiveIndicator = ({ live, updatedAt }: Props) => (
  <span className="text-muted-foreground flex items-center gap-1.5 text-xs" data-testid="live-indicator">
    <span
      aria-hidden="true"
      className={cn(
        'inline-block size-2 rounded-full',
        live ? 'bg-emerald-500 motion-safe:animate-pulse' : 'bg-muted-foreground/40',
      )}
    />
    {live ? 'Live · updating every 2 s' : updatedAt ? 'Up to date' : 'Loading'}
  </span>
);
