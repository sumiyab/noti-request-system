import { z } from 'zod';
import { ValidationError } from '../lib/errors';

/** The `byCreatedAt` index key of the last item on a page — everything a Query needs to continue. */
const cursorSchema = z.strictObject({
  id: z.uuid(),
  entityType: z.literal('NOTIFICATION'),
  createdAt: z.iso.datetime(),
});

export type CursorKey = z.infer<typeof cursorSchema>;

export const encodeCursor = (key: CursorKey) =>
  Buffer.from(JSON.stringify(key), 'utf8').toString('base64url');

/** Opaque to clients; a tampered or stale cursor is a 400 on `cursor`, never a DynamoDB exception. */
export const decodeCursor = (cursor: string): CursorKey => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new ValidationError([{ path: 'cursor', message: 'Invalid cursor' }]);
  }
  const result = cursorSchema.safeParse(parsed);
  if (!result.success) throw new ValidationError([{ path: 'cursor', message: 'Invalid cursor' }]);
  return result.data;
};
