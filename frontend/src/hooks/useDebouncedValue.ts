'use client';

import { useEffect, useState } from 'react';

/** The value as of `delayMs` after it last changed — so a query fires once per pause in typing, not per key. */
export const useDebouncedValue = <T>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
};
