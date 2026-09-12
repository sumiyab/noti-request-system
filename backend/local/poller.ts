import {
  DeleteMessageBatchCommand,
  ReceiveMessageCommand,
  type Message,
  type SQSClient,
} from '@aws-sdk/client-sqs';
import type { Context, SQSEvent, SQSRecord } from 'aws-lambda';
import { processNotifications } from '../src/handlers';

type Options = { client: SQSClient; queueUrl: string; log: (msg: string) => void; signal?: AbortSignal };

/** Builds the same SQSEvent shape Lambda would. */
const toEvent = (messages: Message[]): SQSEvent => ({
  Records: messages.map(
    (m) =>
      ({
        messageId: m.MessageId ?? '',
        receiptHandle: m.ReceiptHandle ?? '',
        body: m.Body ?? '',
        attributes: { ApproximateReceiveCount: m.Attributes?.ApproximateReceiveCount ?? '1' },
        messageAttributes: {},
        eventSource: 'aws:sqs',
      }) as unknown as SQSRecord,
  ),
});

/**
 * Stands in for the Lambda event source mapping: long-poll, invoke the worker handler with a batch, delete
 * every record NOT reported in batchItemFailures. Failed records reappear after the visibility timeout.
 */
export const pollForever = async ({ client, queueUrl, log, signal }: Options) => {
  while (!signal?.aborted) {
    try {
      const { Messages = [] } = await client.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20,
          MessageSystemAttributeNames: ['ApproximateReceiveCount'],
        }),
      );
      if (Messages.length === 0) continue;

      const result = await processNotifications.handler(toEvent(Messages), {} as Context, () => {});
      const failed = new Set((result?.batchItemFailures ?? []).map((f) => f.itemIdentifier));
      const succeeded = Messages.filter((m) => !failed.has(m.MessageId ?? ''));
      log(`[worker] batch of ${Messages.length}: ${succeeded.length} done, ${failed.size} to retry`);

      if (succeeded.length > 0) {
        await client.send(
          new DeleteMessageBatchCommand({
            QueueUrl: queueUrl,
            Entries: succeeded.map((m) => ({ Id: m.MessageId ?? '', ReceiptHandle: m.ReceiptHandle ?? '' })),
          }),
        );
      }
    } catch (error) {
      log(`[worker] poll error: ${error instanceof Error ? error.message : String(error)}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
};
