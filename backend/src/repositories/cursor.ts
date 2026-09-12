import { z } from 'zod';
import { ValidationError } from '../lib/errors';

/**
 * The index key of the last item on a page — everything a Query needs to continue. Which index depends on the
 * query: `byCreatedAt` (all requests) or `byUser` (one user's). DynamoDB rejects an ExclusiveStartKey with
 * attributes the index does not have, so each shape carries exactly its own keys.
 */
const cursorSchema = z.union([
  z.strictObject({ id: z.uuid(), entityType: z.literal('NOTIFICATION'), createdAt: z.iso.datetime() }),
  z.strictObject({ id: z.uuid(), userId: z.string().min(1), createdAt: z.iso.datetime() }),
]);

export type CursorKey = z.infer<typeof cursorSchema>;

export const encodeCursor = (key: CursorKey) =>
  Buffer.from(JSON.stringify(key), 'utf8').toString('base64url');

const invalid = () => new ValidationError([{ path: 'cursor', message: 'Invalid cursor' }]);

/**
 * Opaque to clients; a tampered or stale cursor is a 400 on `cursor`, never a DynamoDB exception. A cursor
 * from the other index — or another user's — is also rejected, so a page can never continue a different query.
 */
export const decodeCursor = (cursor: string, expected: { userId?: string | undefined }): CursorKey => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw invalid();
  }
  const result = cursorSchema.safeParse(parsed);
  if (!result.success) throw invalid();
  const key = result.data;
  if ('userId' in key ? key.userId !== expected.userId : expected.userId !== undefined) throw invalid();
  return key;
};
