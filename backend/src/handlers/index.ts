/**
 * One entry per Lambda. Each endpoint lives in its own folder; `serverless.yml` points at the folder's
 * `index.handler`, and the local runner and specs import from here.
 */
export * as createNotification from './http/createNotification';
export * as getNotification from './http/getNotification';
export * as listNotifications from './http/listNotifications';
export * as processNotifications from './queue/processNotifications';
