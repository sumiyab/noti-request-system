import type { SQSBatchItemFailure, SQSHandler, SQSRecord } from 'aws-lambda';
import { getDeps, type Deps } from '../../deps';
import { queueMessageSchema } from '../../queue/message';
import { processNotification, type ProcessOutcome } from '../../services/processNotification';

/** Never throws: a thrown error would fail the whole batch. Anything unexpected → report this record only. */
const processRecord = async (deps: Deps, record: SQSRecord): Promise<ProcessOutcome> => {
  const log = deps.log.child({
    messageId: record.messageId,
    receiveCount: record.attributes.ApproximateReceiveCount,
  });
  let body: unknown;
  try {
    body = JSON.parse(record.body);
  } catch {
    body = undefined;
  }
  const message = queueMessageSchema.safeParse(body);
  if (!message.success) {
    // Poison message: retrying cannot help, but reporting it routes it to the DLQ (after maxReceiveCount) as evidence.
    log.error('unparseable message body', { body: record.body });
    return 'retry';
  }
  try {
    return await processNotification({ ...deps, log }, message.data);
  } catch (error) {
    log.error('processing failed unexpectedly', { error });
    return 'retry';
  }
};

export const createHandler =
  (deps: () => Deps): SQSHandler =>
  async (event) => {
    const batchItemFailures: SQSBatchItemFailure[] = [];
    for (const record of event.Records) {
      const outcome = await processRecord(deps(), record);
      if (outcome === 'retry') batchItemFailures.push({ itemIdentifier: record.messageId });
    }
    return { batchItemFailures };
  };

export const handler = createHandler(getDeps);
