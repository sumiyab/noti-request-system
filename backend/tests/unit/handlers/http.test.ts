import { createHandler as createCreate } from '../../../src/handlers/http/createNotification';
import { createHandler as createGet } from '../../../src/handlers/http/getNotification';
import { createHandler as createList } from '../../../src/handlers/http/listNotifications';
import { context, httpEvent, parseResponse } from '../../helpers/events';
import { makeDeps } from '../../helpers/fakes';
import { ID, emailInput, stored } from '../../helpers/fixtures';

const invoke = async (handler: ReturnType<typeof createCreate>, event: ReturnType<typeof httpEvent>) =>
  parseResponse(await handler(event, context, () => {}));

describe('POST /notifications', () => {
  test('202 with Location and the stored item', async () => {
    const deps = makeDeps();
    const res = await invoke(
      createCreate(() => deps),
      httpEvent({ method: 'POST', body: emailInput }),
    );

    expect(res.statusCode).toBe(202);
    expect(res.headers?.location).toBe(`/notifications/${ID}`);
    expect(res.json).toMatchObject({ data: { id: ID, status: 'QUEUED', channel: 'EMAIL' } });
  });

  test('400 VALIDATION_ERROR with one detail per field', async () => {
    const res = await invoke(
      createCreate(() => makeDeps()),
      httpEvent({ method: 'POST', body: { channel: 'EMAIL', recipient: 'nope', subject: '', message: 'x' } }),
    );
    expect(res.statusCode).toBe(400);
    expect(res.json).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        details: [
          { path: 'recipient', message: 'Enter a valid email address' },
          { path: 'subject', message: 'Subject is required' },
        ],
      },
    });
  });

  test('400 INVALID_JSON', async () => {
    const res = await invoke(
      createCreate(() => makeDeps()),
      httpEvent({ method: 'POST', rawBody: '{oops' }),
    );
    expect(res.statusCode).toBe(400);
    expect(res.json).toMatchObject({ error: { code: 'INVALID_JSON' } });
  });

  test('503 ENQUEUE_FAILED when SQS is down', async () => {
    const deps = makeDeps();
    deps.queue.failWith = new Error('down');
    const res = await invoke(
      createCreate(() => deps),
      httpEvent({ method: 'POST', body: emailInput }),
    );
    expect(res.statusCode).toBe(503);
    expect(res.json).toMatchObject({ error: { code: 'ENQUEUE_FAILED' } });
  });
});

describe('GET /notifications', () => {
  test('200 with a page and defaults', async () => {
    const deps = makeDeps();
    deps.repo.seed(stored());
    const res = await invoke(
      createList(() => deps),
      httpEvent({}),
    );
    expect(res.statusCode).toBe(200);
    expect(res.json).toEqual({ data: [stored()], nextCursor: null });
  });

  test('400 for a bad limit', async () => {
    const res = await invoke(
      createList(() => makeDeps()),
      httpEvent({ query: { limit: '500' } }),
    );
    expect(res.statusCode).toBe(400);
    expect(res.json).toMatchObject({ error: { details: [{ path: 'limit' }] } });
  });
});

describe('GET /notifications/{id}', () => {
  test('200', async () => {
    const deps = makeDeps();
    deps.repo.seed(stored());
    const res = await invoke(
      createGet(() => deps),
      httpEvent({ path: '/notifications/{id}', pathParameters: { id: ID } }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.json).toEqual({ data: stored() });
  });

  test('404 for an unknown id', async () => {
    const res = await invoke(
      createGet(() => makeDeps()),
      httpEvent({ pathParameters: { id: ID } }),
    );
    expect(res.statusCode).toBe(404);
  });

  test('400 for a non-UUID id', async () => {
    const res = await invoke(
      createGet(() => makeDeps()),
      httpEvent({ pathParameters: { id: 'abc' } }),
    );
    expect(res.statusCode).toBe(400);
    expect(res.json).toMatchObject({ error: { details: [{ path: 'id' }] } });
  });
});
