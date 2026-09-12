'use client';

import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { USER_ID } from '@/schemas';

type Props = { value: string; onChange: (value: string) => void; error?: string | undefined };

/** Filters the list to one user's requests. Cleared with the × button or by emptying the field. */
export const UserFilter = ({ value, onChange, error }: Props) => (
  <div className="flex flex-col gap-1">
    <div className="relative">
      <Input
        id="user-filter"
        type="search"
        placeholder="Filter by user ID"
        aria-label="Filter by user ID"
        aria-invalid={!!error}
        aria-describedby={error ? 'user-filter-error' : undefined}
        maxLength={USER_ID.max}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pr-8"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Clear filter"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-0.5 -translate-y-1/2"
        >
          <XIcon aria-hidden="true" />
        </Button>
      )}
    </div>
    {error && (
      <p id="user-filter-error" role="alert" className="text-destructive text-xs">
        {error}
      </p>
    )}
  </div>
);
