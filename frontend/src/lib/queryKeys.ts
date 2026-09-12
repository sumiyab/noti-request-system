export const queryKeys = {
  notifications: {
    all: ['notifications'] as const,
    list: () => ['notifications', 'list'] as const,
    detail: (id: string) => ['notifications', 'detail', id] as const,
  },
};
