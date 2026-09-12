import { getNotification } from '../../../src/services/getNotification';
import { listNotifications } from '../../../src/services/listNotifications';
import { makeDeps } from '../../helpers/fakes';
import { ID, stored } from '../../helpers/fixtures';

describe('getNotification', () => {
  test('returns the item', async () => {
    const deps = makeDeps();
    deps.repo.seed(stored());
    await expect(getNotification(deps, ID)).resolves.toEqual(stored());
  });

  test('throws NOT_FOUND', async () => {
    await expect(getNotification(makeDeps(), ID)).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });
});

describe('listNotifications', () => {
  test('passes limit and cursor through to the repository', async () => {
    const deps = makeDeps();
    for (let i = 0; i < 3; i++) {
      deps.repo.seed(stored({ id: `${i}`.padEnd(36, '0'), createdAt: `2026-09-12T04:00:0${i}.000Z` }));
    }
    const first = await listNotifications(deps, { limit: 2 });
    expect(first.data.map((n) => n.createdAt)).toEqual([
      '2026-09-12T04:00:02.000Z',
      '2026-09-12T04:00:01.000Z',
    ]);
    expect(first.nextCursor).toBe('2');

    const second = await listNotifications(deps, { limit: 2, cursor: first.nextCursor! });
    expect(second.data).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
  });
});
