import { MAX_BODY_BYTES } from '@noti/shared';
import { z } from 'zod';
import { AppError, NotFoundError } from '../../../src/lib/errors';
import { httpHandler, parseJsonBody, parseWith } from '../../../src/lib/http';
import { noopLogger } from '../../../src/lib/logger';
import { context, httpEvent, parseResponse } from '../../helpers/events';

const run = async (fn: Parameters<typeof httpHandler>[0], event = httpEvent({})) =>
  parseResponse(await httpHandler(fn, () => noopLogger)(event, context, () => {}));

describe('httpHandler', () => {
  test('serialises a result with the base headers and request id', async () => {
    const res = await run(async () => ({ status: 202, body: { data: 1 }, headers: { location: '/x' } }));
    expect(res.statusCode).toBe(202);
    expect(res.json).toEqual({ data: 1 });
    expect(res.headers).toMatchObject({
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-request-id': 'req-test-1',
      location: '/x',
    });
  });

  test('maps AppError to its status and the error envelope', async () => {
    const res = await run(async () => {
      throw new NotFoundError('nope');
    });
    expect(res.statusCode).toBe(404);
    expect(res.json).toEqual({ error: { code: 'NOT_FOUND', message: 'nope', requestId: 'req-test-1' } });
  });

  test('includes details when present', async () => {
    const res = await run(async () => {
      throw new AppError(400, 'VALIDATION_ERROR', 'bad', [{ path: 'x', message: 'y' }]);
    });
    expect(res.json).toMatchObject({ error: { details: [{ path: 'x', message: 'y' }] } });
  });

  test('turns unexpected errors into a generic 500', async () => {
    const res = await run(async () => {
      throw new Error('secret internals');
    });
    expect(res.statusCode).toBe(500);
    expect(res.json).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong', requestId: 'req-test-1' },
    });
  });

  test('rejects bodies over the limit before running the handler', async () => {
    const fn = jest.fn();
    const res = await run(fn, httpEvent({ method: 'POST', rawBody: 'x'.repeat(MAX_BODY_BYTES + 1) }));
    expect(res.statusCode).toBe(413);
    expect(res.json).toMatchObject({ error: { code: 'PAYLOAD_TOO_LARGE' } });
    expect(fn).not.toHaveBeenCalled();
  });

  test('decodes base64 bodies', async () => {
    const event = {
      ...httpEvent({ method: 'POST' }),
      body: Buffer.from('{"a":1}').toString('base64'),
      isBase64Encoded: true,
    };
    const res = await run(async (req) => ({ status: 200, body: parseJsonBody(req) }), event);
    expect(res.json).toEqual({ a: 1 });
  });
});

describe('parseJsonBody', () => {
  const req = (body: string | undefined) => ({
    body,
    pathParameters: {},
    queryStringParameters: {},
    requestId: 'r',
    log: noopLogger,
  });

  test.each([undefined, '', '   ', '{', '[]', '"str"', 'null'])('rejects %p', (body) => {
    expect(() => parseJsonBody(req(body))).toThrow(expect.objectContaining({ code: 'INVALID_JSON' }));
  });

  test('returns the object', () => {
    expect(parseJsonBody(req('{"a":1}'))).toEqual({ a: 1 });
  });
});

describe('parseWith', () => {
  test('maps every zod issue to a detail, with an optional path prefix', () => {
    const schema = z.strictObject({ a: z.string(), b: z.number() });
    const error = (fn: () => unknown) => {
      try {
        fn();
      } catch (e) {
        return e as { code: string; details: { path: string; message: string }[] };
      }
      throw new Error('did not throw');
    };
    const objectError = error(() => parseWith(schema, { a: 1 }));
    expect(objectError.code).toBe('VALIDATION_ERROR');
    expect(objectError.details.map((d) => d.path)).toEqual(['a', 'b']);
    expect(error(() => parseWith(z.uuid(), 'x', 'id')).details.map((d) => d.path)).toEqual(['id']);
  });
});
