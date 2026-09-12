import { QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { makeQueryClient } from '@/app/providers';
import type { Notification } from '@/schemas';

/** A fresh QueryClient per test so cache and polling state never leak between tests. */
export const renderWithQuery = (ui: ReactElement, options?: RenderOptions) => {
  const queryClient = makeQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false, staleTime: 0 } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
};

export const notification = (overrides: Partial<Notification> = {}): Notification => ({
  id: '3f0c9a52-8f6e-4d63-9a51-3c1e0f2b7d10',
  channel: 'EMAIL',
  recipient: 'jane@example.com',
  subject: 'Welcome!',
  message: 'Thanks for signing up.',
  status: 'QUEUED',
  attempts: 0,
  createdAt: '2026-09-12T04:00:00.000Z',
  updatedAt: '2026-09-12T04:00:00.012Z',
  ...overrides,
});

const fetchMock = () => global.fetch as jest.Mock;

/** jsdom has no `Response`; this is the subset the API client reads. */
export const fakeResponse = (status: number, body?: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => (body === undefined ? Promise.reject(new SyntaxError('not json')) : Promise.resolve(body)),
});

/** Queue a JSON response for the next fetch call. */
export const mockResponse = (status: number, body: unknown) =>
  fetchMock().mockResolvedValueOnce(fakeResponse(status, body));

export const mockList = (data: Notification[], nextCursor: string | null = null) =>
  mockResponse(200, { data, nextCursor });

export const lastRequest = () => {
  const calls = fetchMock().mock.calls as [string, RequestInit | undefined][];
  const last = calls[calls.length - 1];
  if (!last) throw new Error('fetch was not called');
  return { url: last[0], init: last[1] };
};
