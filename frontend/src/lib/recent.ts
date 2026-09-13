'use client';

import { useSyncExternalStore } from 'react';

/**
 * The id of the request the user just created, so the list can highlight it when it appears. A tiny external
 * store rather than context: the form and the list are siblings, and the value is transient.
 */
const HIGHLIGHT_MS = 4000;

let recentId: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export const markRecent = (id: string) => {
  recentId = id;
  emit();
  clearTimeout(timer);
  timer = setTimeout(() => {
    recentId = null;
    emit();
  }, HIGHLIGHT_MS);
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useRecentId = () =>
  useSyncExternalStore(
    subscribe,
    () => recentId,
    () => null,
  );

/** Element id of a row, shared by the list (renders it) and the success toast (scrolls to it). */
export const rowElementId = (id: string) => `notification-${id}`;
