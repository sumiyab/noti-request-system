import { SendMessageCommand, type SQSClient } from '@aws-sdk/client-sqs';
import type { QueueMessage } from './message';

export interface QueueProducer {
  send(message: QueueMessage): Promise<void>;
}

export const createSqsProducer = ({
  client,
  queueUrl,
}: {
  client: SQSClient;
  queueUrl: string | undefined;
}): QueueProducer => ({
  send: async (message) => {
    if (!queueUrl) throw new Error('QUEUE_URL is not configured');
    await client.send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify(message) }));
  },
});
