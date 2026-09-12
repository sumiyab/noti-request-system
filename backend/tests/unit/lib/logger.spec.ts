import { createLogger } from '../../../src/lib/logger';

const capture = () => {
  const lines: Record<string, unknown>[] = [];
  const write = (line: string) => lines.push(JSON.parse(line) as Record<string, unknown>);
  return { lines, write };
};

describe('logger', () => {
  test('writes one JSON object per line with bindings and fields', () => {
    const { lines, write } = capture();
    createLogger('info', { requestId: 'r1' }, write)
      .child({ notificationId: 'n1' })
      .info('queued', { attempts: 0 });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: 'info',
      msg: 'queued',
      requestId: 'r1',
      notificationId: 'n1',
      attempts: 0,
    });
    expect(typeof lines[0]?.ts).toBe('string');
  });

  test('drops entries below the minimum level', () => {
    const { lines, write } = capture();
    const log = createLogger('warn', {}, write);
    log.debug('a');
    log.info('b');
    log.warn('c');
    expect(lines.map((l) => l.msg)).toEqual(['c']);
  });

  test('serialises errors', () => {
    const { lines, write } = capture();
    createLogger('error', {}, write).error('boom', { error: new TypeError('bad') });
    expect(lines[0]?.error).toMatchObject({ name: 'TypeError', message: 'bad' });
  });
});
