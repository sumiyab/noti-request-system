import { getNotification } from '../../../src/services/getNotification';
import { listNotifications } from '../../../src/services/listNotifications';
import { ID, stored } from '../../helpers/fixtures';
import { makeDeps } from '../../helpers/mocks';

describe('getNotification', () => {
  test('returns the item', async () => {
    const deps = makeDeps();
    deps.repo.get.mockResolvedValueOnce(stored());

    await expect(getNotification(deps, ID)).resolves.toEqual(stored());
    expect(deps.repo.get).toHaveBeenCalledWith(ID);
  });

  test('throws NOT_FOUND', async () => {
    await expect(getNotification(makeDeps(), ID)).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });
});

describe('listNotifications', () => {
  test('passes the validated query through and returns the page unchanged', async () => {
    const deps = makeDeps();
    const page = { data: [stored()], nextCursor: 'next' };
    deps.repo.list.mockResolvedValueOnce(page);

    const query = { limit: 2, cursor: 'prev', userId: 'user-42' };
    await expect(listNotifications(deps, query)).resolves.toBe(page);
    expect(deps.repo.list).toHaveBeenCalledWith(query);
  });
});
