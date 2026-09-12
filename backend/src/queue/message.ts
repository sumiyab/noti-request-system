import { z } from 'zod';

/** The whole message: a pointer to the request. DynamoDB is the source of truth. */
export const queueMessageSchema = z.strictObject({
  notificationId: z.uuid(),
});

export type QueueMessage = z.infer<typeof queueMessageSchema>;
