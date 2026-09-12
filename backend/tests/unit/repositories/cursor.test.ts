import { decodeCursor, encodeCursor } from '../../../src/repositories/cursor';
import { ID, NOW } from '../../helpers/fixtures';

describe('cursor', () => {
  const key = { id: ID, entityType: 'NOTIFICATION' as const, createdAt: NOW.toISOString() };

  test('round-trips and is url-safe', () => {
    const cursor = encodeCursor(key);
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(cursor)).toEqual(key);
  });

  test.each([
    '',
    'not-base64!',
    Buffer.from('{"id":"x"}').toString('base64url'),
    Buffer.from('[]').toString('base64url'),
  ])('rejects %p as a 400 on cursor', (cursor) => {
    expect(() => decodeCursor(cursor)).toThrow(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        details: [{ path: 'cursor', message: 'Invalid cursor' }],
      }),
    );
  });
});
