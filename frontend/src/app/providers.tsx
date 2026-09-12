'use client';

import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { ApiError } from '@/lib/api';

const MESSAGES: Partial<Record<ApiError['code'], string>> = {
  ENQUEUE_FAILED: 'Could not queue the request — please try again.',
  NETWORK_ERROR: 'Cannot reach the server.',
  PAYLOAD_TOO_LARGE: 'The request is too large.',
};

/** One QueryClient per app instance; generic mutation errors become a toast here, once. */
export const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 1000 } },
    mutationCache: new MutationCache({
      onError: (error) => {
        if (error.code === 'VALIDATION_ERROR') return; // rendered inline by the form
        toast.error(MESSAGES[error.code] ?? 'Something went wrong.');
      },
    }),
  });

export const Providers = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(makeQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
