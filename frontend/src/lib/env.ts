/** Base URL of the backend API. Inlined at build time by Next.js (NEXT_PUBLIC_ prefix). */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
