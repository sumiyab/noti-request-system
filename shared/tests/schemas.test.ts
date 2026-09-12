import { createNotificationSchema, listNotificationsQuerySchema, notificationIdSchema } from '../src';

const email = { channel: 'EMAIL', recipient: 'jane@example.com', subject: 'Welcome!', message: 'Hi' };
const sms = { channel: 'SMS', recipient: '+97699112233', message: 'Hi' };
const push = { channel: 'PUSH', recipient: 'abc123:def_456', subject: 'Title', message: 'Hi' };

const errorPaths = (input: unknown) => {
  const result = createNotificationSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
};

describe('createNotificationSchema', () => {
  test('accepts a valid request for each channel', () => {
    for (const input of [email, sms, push]) {
      expect(createNotificationSchema.safeParse(input).success).toBe(true);
    }
  });

  test('trims strings', () => {
    const parsed = createNotificationSchema.parse({
      ...email,
      recipient: '  jane@example.com ',
      subject: ' Hi ',
    });
    expect(parsed.recipient).toBe('jane@example.com');
    expect(parsed.channel === 'EMAIL' && parsed.subject).toBe('Hi');
  });

  test('rejects unknown fields', () => {
    expect(createNotificationSchema.safeParse({ ...email, reciepient: 'x' }).success).toBe(false);
  });

  test('rejects an unknown channel', () => {
    expect(errorPaths({ ...email, channel: 'FAX' })).toEqual(['channel']);
  });

  test.each([
    ['EMAIL recipient must be an email', { ...email, recipient: 'jane@' }, ['recipient']],
    ['EMAIL subject required', { ...email, subject: '' }, ['subject']],
    ['EMAIL subject ≤ 150', { ...email, subject: 'x'.repeat(151) }, ['subject']],
    ['EMAIL message ≤ 5000', { ...email, message: 'x'.repeat(5001) }, ['message']],
    ['SMS recipient must be E.164 (no plus)', { ...sms, recipient: '99112233' }, ['recipient']],
    ['SMS recipient must be E.164 (leading zero)', { ...sms, recipient: '+0123' }, ['recipient']],
    ['SMS message ≤ 1600', { ...sms, message: 'x'.repeat(1601) }, ['message']],
    ['PUSH token ≥ 8', { ...push, recipient: 'short' }, ['recipient']],
    ['PUSH token charset', { ...push, recipient: 'has space!' }, ['recipient']],
    ['PUSH token ≤ 512', { ...push, recipient: 'a'.repeat(513) }, ['recipient']],
    ['PUSH subject ≤ 100', { ...push, subject: 'x'.repeat(101) }, ['subject']],
    ['PUSH message ≤ 1000', { ...push, message: 'x'.repeat(1001) }, ['message']],
  ])('%s', (_name, input, paths) => {
    expect(errorPaths(input)).toEqual(paths);
  });

  test('SMS rejects a subject', () => {
    expect(createNotificationSchema.safeParse({ ...sms, subject: 'Hi' }).success).toBe(false);
  });

  test('reports every failing field at once', () => {
    expect(errorPaths({ ...email, recipient: 'nope', subject: '', message: '' })).toEqual([
      'recipient',
      'subject',
      'message',
    ]);
  });
});

describe('listNotificationsQuerySchema', () => {
  test('defaults limit to 20 and coerces strings', () => {
    expect(listNotificationsQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(listNotificationsQuerySchema.parse({ limit: '5', cursor: 'abc' })).toEqual({
      limit: 5,
      cursor: 'abc',
    });
  });

  test.each(['0', '101', 'ten', '1.5'])('rejects limit=%s', (limit) => {
    expect(listNotificationsQuerySchema.safeParse({ limit }).success).toBe(false);
  });

  test('rejects unknown query keys', () => {
    expect(listNotificationsQuerySchema.safeParse({ page: '2' }).success).toBe(false);
  });
});

describe('notificationIdSchema', () => {
  test('requires a UUID', () => {
    expect(notificationIdSchema.safeParse('3f0c9a52-8f6e-4d63-9a51-3c1e0f2b7d10').success).toBe(true);
    expect(notificationIdSchema.safeParse('abc').success).toBe(false);
  });
});
