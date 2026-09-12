import type {
  ApiErrorBody,
  ApiErrorCode,
  CreateNotificationInput,
  FieldError,
  ListNotificationsResponse,
  Notification,
} from '@/schemas';
import { API_URL } from './env';

/** Server error codes plus the one only the client can produce. */
export type ClientErrorCode = ApiErrorCode | 'NETWORK_ERROR';

/** Every failure of the API client is an ApiError, so callers branch on `code` and never on `instanceof`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ClientErrorCode,
    message: string,
    readonly details?: FieldError[],
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Type every TanStack Query error as ApiError, in every hook, once.
declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ApiError;
  }
}

const isErrorBody = (body: unknown): body is ApiErrorBody =>
  typeof body === 'object' && body !== null && 'error' in body;

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
    });
  } catch {
    // fetch rejects only on network failure; HTTP errors resolve normally.
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server');
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (isErrorBody(body)) {
      const { code, message, details, requestId } = body.error;
      throw new ApiError(response.status, code, message, details, requestId);
    }
    throw new ApiError(response.status, 'INTERNAL_ERROR', `Unexpected response (${response.status})`);
  }
  return body as T;
};

/** `userId` narrows the list to one user's requests (server-side, via the `byUser` index). */
export type ListParams = { cursor?: string | undefined; userId?: string | undefined; limit?: number };

export const api = {
  create: (input: CreateNotificationInput) =>
    request<{ data: Notification }>('/notifications', { method: 'POST', body: JSON.stringify(input) }),

  list: ({ cursor, userId, limit = 20 }: ListParams = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (userId) params.set('userId', userId);
    if (cursor) params.set('cursor', cursor);
    return request<ListNotificationsResponse>(`/notifications?${params.toString()}`);
  },

  get: (id: string) => request<{ data: Notification }>(`/notifications/${encodeURIComponent(id)}`),
};
