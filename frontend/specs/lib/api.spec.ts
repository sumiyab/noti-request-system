import { ApiError, api } from '@/lib/api';
import { fakeResponse, lastRequest, mockResponse, notification } from '../helpers';

describe('api client', () => {
  test('create posts JSON and returns the envelope', async () => {
    const created = notification();
    mockResponse(202, { data: created });

    const result = await api.create({
      userId: 'user-42',
      channel: 'EMAIL',
      recipient: 'jane@example.com',
      subject: 'Hi',
      message: 'x',
    });

    expect(result.data).toEqual(created);
    const { url, init } = lastRequest();
    expect(url).toBe('http://localhost:3001/notifications');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'content-type': 'application/json' });
    expect(JSON.parse(init?.body as string)).toEqual({
      userId: 'user-42',
      channel: 'EMAIL',
      recipient: 'jane@example.com',
      subject: 'Hi',
      message: 'x',
    });
  });

  test('list builds the query string with limit, userId and cursor', async () => {
    mockResponse(200, { data: [], nextCursor: null });
    await api.list({ cursor: 'abc', limit: 10, userId: 'user-42' });
    expect(lastRequest().url).toBe('http://localhost:3001/notifications?limit=10&userId=user-42&cursor=abc');

    mockResponse(200, { data: [], nextCursor: null });
    await api.list();
    expect(lastRequest().url).toBe('http://localhost:3001/notifications?limit=20');
  });

  test('an error envelope becomes an ApiError with code and details', async () => {
    mockResponse(400, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: [{ path: 'recipient', message: 'Enter a valid email address' }],
        requestId: 'req-1',
      },
    });

    const error = await api.get('x').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      details: [{ path: 'recipient', message: 'Enter a valid email address' }],
      requestId: 'req-1',
    });
  });

  test('a non-JSON failure becomes INTERNAL_ERROR with the status', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(fakeResponse(504));
    await expect(api.list()).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 504 });
  });

  test('a network failure becomes NETWORK_ERROR', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(api.list()).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });
});
