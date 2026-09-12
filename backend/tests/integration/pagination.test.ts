import { httpEvent } from '../helpers/events';
import { emailInput } from '../helpers/fixtures';
import { harness } from './harness';

const h = harness();

beforeAll(async () => {
  await h.reset();
  for (let i = 0; i < 25; i++) {
    await h.call(h.handlers.create, httpEvent({ method: 'POST', body: { ...emailInput, subject: `#${i}` } }));
  }
});

describe('GET /notifications pagination', () => {
  test('walks all pages newest first with an opaque cursor and no duplicates', async () => {
    const seen: string[] = [];
    const subjects: string[] = [];
    let cursor: string | undefined;
    let pages = 0;

    do {
      const res = await h.call(
        h.handlers.list,
        httpEvent({ query: { limit: '10', ...(cursor && { cursor }) } }),
      );
      expect(res.statusCode).toBe(200);
      const page = res.json as {
        data: { id: string; subject: string; createdAt: string }[];
        nextCursor: string | null;
      };
      pages += 1;
      seen.push(...page.data.map((n) => n.id));
      subjects.push(...page.data.map((n) => n.subject));
      const times = page.data.map((n) => n.createdAt);
      expect([...times].sort().reverse()).toEqual(times);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    expect(pages).toBe(3);
    expect(new Set(seen).size).toBe(25);
    expect(subjects[0]).toBe('#24');
    expect(subjects[24]).toBe('#0');
  });

  test('a tampered cursor is a 400 on cursor', async () => {
    const res = await h.call(h.handlers.list, httpEvent({ query: { cursor: 'bm90LWEtY3Vyc29y' } }));
    expect(res.statusCode).toBe(400);
    expect(res.json).toMatchObject({ error: { code: 'VALIDATION_ERROR', details: [{ path: 'cursor' }] } });
  });

  test('the last page has nextCursor null even when exactly full', async () => {
    const res = await h.call(h.handlers.list, httpEvent({ query: { limit: '25' } }));
    expect((res.json as { data: unknown[]; nextCursor: null }).data).toHaveLength(25);
    expect((res.json as { nextCursor: unknown }).nextCursor).toBeNull();
  });
});
