import { decodeCursor, encodeCursor } from '../../../src/repositories/cursor';
import { ID, NOW, USER_ID } from '../../helpers/fixtures';

const invalidCursor = expect.objectContaining({
  code: 'VALIDATION_ERROR',
  details: [{ path: 'cursor', message: 'Invalid cursor' }],
}) as Error;

describe('cursor', () => {
  const allKey = { id: ID, entityType: 'NOTIFICATION' as const, createdAt: NOW.toISOString() };
  const userKey = { id: ID, userId: USER_ID, createdAt: NOW.toISOString() };

  test('round-trips a byCreatedAt key and is url-safe', () => {
    const cursor = encodeCursor(allKey);
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(cursor, {})).toEqual(allKey);
  });

  test('round-trips a byUser key', () => {
    expect(decodeCursor(encodeCursor(userKey), { userId: USER_ID })).toEqual(userKey);
  });

  test.each([
    '',
    'not-base64!',
    Buffer.from('{"id":"x"}').toString('base64url'),
    Buffer.from('[]').toString('base64url'),
  ])('rejects %p as a 400 on cursor', (cursor) => {
    expect(() => decodeCursor(cursor, {})).toThrow(invalidCursor);
  });

  test('rejects a cursor from the other index or another user', () => {
    expect(() => decodeCursor(encodeCursor(userKey), {})).toThrow(invalidCursor);
    expect(() => decodeCursor(encodeCursor(allKey), { userId: USER_ID })).toThrow(invalidCursor);
    expect(() => decodeCursor(encodeCursor(userKey), { userId: 'someone-else' })).toThrow(invalidCursor);
  });
});
