import { listNotificationsQuerySchema } from '@noti/shared';
import { getDeps, type Deps } from '../../deps';
import { httpHandler, parseWith } from '../../lib/http';
import { listNotifications } from '../../services/listNotifications';

export const createHandler = (deps: () => Deps) =>
  httpHandler(
    async (req) => {
      const query = parseWith(listNotificationsQuerySchema, req.queryStringParameters);
      const page = await listNotifications(deps(), query);
      return { status: 200, body: page };
    },
    () => deps().log,
  );

export const handler = createHandler(getDeps);
