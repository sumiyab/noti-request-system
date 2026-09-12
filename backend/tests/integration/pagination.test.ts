import { httpEvent } from '../helpers/events';
import { USER_ID, emailInput } from '../helpers/fixtures';
import { harness } from './harness';

const h = harness();

beforeAll(async () => {
  await h.reset();
  for (let i = 0; i < 25; i++) {
    await h.call(h.handlers.create, httpEvent({ method: 'POST', body: { ...emailInput, subject: `#${i}` } }));
  }
  for (let i = 0; i < 3; i++) {
    await h.call(
      h.handlers.create,
      httpEvent({ method: 'POST', body: { ...emailInput, userId: 'someone-else', subject: `other #${i}` } }),
    );
  }
});

type Page = {
  data: { id: string; userId: string; subject: string; createdAt: string }[];
  nextCursor: string | null;
};

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
      const page = res.json as Page;
      pages += 1;
      seen.push(...page.data.map((n) => n.id));
      subjects.push(...page.data.map((n) => n.subject));
      const times = page.data.map((n) => n.createdAt);
      expect([...times].sort().reverse()).toEqual(times);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    expect(pages).toBe(3);
    expect(new Set(seen).size).toBe(28);
    expect(subjects[0]).toBe('other #2');
    expect(subjects[27]).toBe('#0');
  });

  test('userId narrows the list to one user, with its own cursor', async () => {
    const first = await h.call(h.handlers.list, httpEvent({ query: { limit: '2', userId: USER_ID } }));
    expect(first.statusCode).toBe(200);
    const page1 = first.json as Page;
    expect(page1.data.map((n) => n.subject)).toEqual(['#24', '#23']);
    expect(page1.nextCursor).not.toBeNull();

    const second = await h.call(
      h.handlers.list,
      httpEvent({ query: { limit: '2', userId: USER_ID, cursor: page1.nextCursor! } }),
    );
    expect((second.json as Page).data.map((n) => n.subject)).toEqual(['#22', '#21']);

    const other = await h.call(h.handlers.list, httpEvent({ query: { userId: 'someone-else' } }));
    const page3 = other.json as Page;
    expect(page3.data.map((n) => n.subject)).toEqual(['other #2', 'other #1', 'other #0']);
    expect(page3.nextCursor).toBeNull();
    expect(page3.data.every((n) => n.userId === 'someone-else')).toBe(true);

    // A cursor from the all-requests query cannot continue a per-user one.
    const all = await h.call(h.handlers.list, httpEvent({ query: { limit: '1' } }));
    const mixed = await h.call(
      h.handlers.list,
      httpEvent({ query: { userId: USER_ID, cursor: (all.json as Page).nextCursor! } }),
    );
    expect(mixed.statusCode).toBe(400);
  });

  test('a tampered cursor is a 400 on cursor', async () => {
    const res = await h.call(h.handlers.list, httpEvent({ query: { cursor: 'bm90LWEtY3Vyc29y' } }));
    expect(res.statusCode).toBe(400);
    expect(res.json).toMatchObject({ error: { code: 'VALIDATION_ERROR', details: [{ path: 'cursor' }] } });
  });

  test('the last page has nextCursor null even when exactly full', async () => {
    const res = await h.call(h.handlers.list, httpEvent({ query: { limit: '28' } }));
    expect((res.json as { data: unknown[]; nextCursor: null }).data).toHaveLength(28);
    expect((res.json as { nextCursor: unknown }).nextCursor).toBeNull();
  });
});
