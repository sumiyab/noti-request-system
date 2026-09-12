import { createNotificationSchema } from '@noti/shared';
import { getDeps, type Deps } from '../../../deps';
import { httpHandler, parseJsonBody, parseWith } from '../../../lib/http';
import { createNotification } from '../../../services/createNotification';

export const createHandler = (deps: () => Deps) =>
  httpHandler(
    async (req) => {
      const input = parseWith(createNotificationSchema, parseJsonBody(req));
      const notification = await createNotification({ ...deps(), log: req.log }, input);
      return {
        status: 202,
        body: { data: notification },
        headers: { location: `/notifications/${notification.id}` },
      };
    },
    () => deps().log,
  );

export const handler = createHandler(getDeps);
