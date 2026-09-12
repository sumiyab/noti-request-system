import { notificationIdSchema } from '@noti/shared';
import { getDeps, type Deps } from '../../deps';
import { httpHandler, parseWith } from '../../lib/http';
import { getNotification } from '../../services/getNotification';

export const createHandler = (deps: () => Deps) =>
  httpHandler(
    async (req) => {
      const id = parseWith(notificationIdSchema, req.pathParameters.id, 'id');
      const notification = await getNotification(deps(), id);
      return { status: 200, body: { data: notification } };
    },
    () => deps().log,
  );

export const handler = createHandler(getDeps);
