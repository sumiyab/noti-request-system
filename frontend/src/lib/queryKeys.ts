export const queryKeys = {
  notifications: {
    all: ['notifications'] as const,
    lists: () => ['notifications', 'list'] as const,
    /** One cache entry per filter, so switching users never shows another user's page. */
    list: (filter: { userId?: string } = {}) => ['notifications', 'list', filter] as const,
    detail: (id: string) => ['notifications', 'detail', id] as const,
  },
};
