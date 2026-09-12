import { createNotification, getNotification, listNotifications } from '../../../src/handlers';
import { context, httpEvent, parseResponse } from '../../helpers/events';
import { ID, USER_ID, emailInput, stored } from '../../helpers/fixtures';
import { makeDeps, transitioned } from '../../helpers/mocks';

const invoke = async (
  handler: ReturnType<typeof createNotification.createHandler>,
  event: ReturnType<typeof httpEvent>,
) => parseResponse(await handler(event, context, () => {}));

describe('POST /notifications', () => {
  test('202 with Location and the stored item', async () => {
    const deps = makeDeps();
    deps.repo.transition.mockResolvedValueOnce(transitioned(stored({ status: 'QUEUED' })));
    const res = await invoke(
      createNotification.createHandler(() => deps),
      httpEvent({ method: 'POST', body: emailInput }),
    );

    expect(res.statusCode).toBe(202);
    expect(res.headers?.location).toBe(`/notifications/${ID}`);
    expect(res.json).toMatchObject({ data: { id: ID, userId: USER_ID, status: 'QUEUED', channel: 'EMAIL' } });
  });

  test('400 VALIDATION_ERROR when userId is missing', async () => {
    const { userId: _userId, ...body } = emailInput;
    const res = await invoke(
      createNotification.createHandler(() => makeDeps()),
      httpEvent({ method: 'POST', body }),
    );
    expect(res.statusCode).toBe(400);
    expect(res.json).toMatchObject({
      error: { code: 'VALIDATION_ERROR', details: [{ path: 'userId' }] },
    });
  });

  test('400 VALIDATION_ERROR with one detail per field', async () => {
    const res = await invoke(
      createNotification.createHandler(() => makeDeps()),
      httpEvent({
        method: 'POST',
        body: { userId: USER_ID, channel: 'EMAIL', recipient: 'nope', subject: '', message: 'x' },
      }),
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
      createNotification.createHandler(() => makeDeps()),
      httpEvent({ method: 'POST', rawBody: '{oops' }),
    );
    expect(res.statusCode).toBe(400);
    expect(res.json).toMatchObject({ error: { code: 'INVALID_JSON' } });
  });

  test('503 ENQUEUE_FAILED when SQS is down', async () => {
    const deps = makeDeps();
    deps.queue.send.mockRejectedValueOnce(new Error('down'));
    deps.repo.transition.mockResolvedValueOnce(transitioned(stored({ status: 'FAILED' })));
    const res = await invoke(
      createNotification.createHandler(() => deps),
      httpEvent({ method: 'POST', body: emailInput }),
    );
    expect(res.statusCode).toBe(503);
    expect(res.json).toMatchObject({ error: { code: 'ENQUEUE_FAILED' } });
  });
});

describe('GET /notifications', () => {
  test('200 with a page and defaults', async () => {
    const deps = makeDeps();
    deps.repo.list.mockResolvedValueOnce({ data: [stored()], nextCursor: null });
    const res = await invoke(
      listNotifications.createHandler(() => deps),
      httpEvent({}),
    );
    expect(res.statusCode).toBe(200);
    expect(res.json).toEqual({ data: [stored()], nextCursor: null });
    expect(deps.repo.list).toHaveBeenCalledWith({ limit: 20 });
  });

  test('passes limit, cursor and userId through validated', async () => {
    const deps = makeDeps();
    const res = await invoke(
      listNotifications.createHandler(() => deps),
      httpEvent({ query: { limit: '5', cursor: 'abc', userId: ` ${USER_ID} ` } }),
    );
    expect(res.statusCode).toBe(200);
    expect(deps.repo.list).toHaveBeenCalledWith({ limit: 5, cursor: 'abc', userId: USER_ID });
  });

  test('400 for a bad userId', async () => {
    const res = await invoke(
      listNotifications.createHandler(() => makeDeps()),
      httpEvent({ query: { userId: 'has space' } }),
    );
    expect(res.statusCode).toBe(400);
    expect(res.json).toMatchObject({ error: { details: [{ path: 'userId' }] } });
  });

  test('400 for a bad limit', async () => {
    const res = await invoke(
      listNotifications.createHandler(() => makeDeps()),
      httpEvent({ query: { limit: '500' } }),
    );
    expect(res.statusCode).toBe(400);
    expect(res.json).toMatchObject({ error: { details: [{ path: 'limit' }] } });
  });
});

describe('GET /notifications/{id}', () => {
  test('200', async () => {
    const deps = makeDeps();
    deps.repo.get.mockResolvedValueOnce(stored());
    const res = await invoke(
      getNotification.createHandler(() => deps),
      httpEvent({ path: '/notifications/{id}', pathParameters: { id: ID } }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.json).toEqual({ data: stored() });
  });

  test('404 for an unknown id', async () => {
    const res = await invoke(
      getNotification.createHandler(() => makeDeps()),
      httpEvent({ pathParameters: { id: ID } }),
    );
    expect(res.statusCode).toBe(404);
  });

  test('400 for a non-UUID id', async () => {
    const res = await invoke(
      getNotification.createHandler(() => makeDeps()),
      httpEvent({ pathParameters: { id: 'abc' } }),
    );
    expect(res.statusCode).toBe(400);
    expect(res.json).toMatchObject({ error: { details: [{ path: 'id' }] } });
  });
});
