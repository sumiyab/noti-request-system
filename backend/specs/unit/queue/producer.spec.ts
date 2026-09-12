import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';
import { createSqsProducer } from '../../../src/queue/producer';
import { ID } from '../../helpers/fixtures';

const sqs = mockClient(SQSClient);
const client = sqs as unknown as SQSClient;

beforeEach(() => sqs.reset());

test('sends the pointer as JSON to the configured queue', async () => {
  sqs.on(SendMessageCommand).resolves({ MessageId: 'm' });
  await createSqsProducer({ client, queueUrl: 'http://q' }).send({ notificationId: ID });
  expect(sqs).toHaveReceivedCommandWith(SendMessageCommand, {
    QueueUrl: 'http://q',
    MessageBody: JSON.stringify({ notificationId: ID }),
  });
});

test('fails clearly when the queue URL is missing', async () => {
  await expect(
    createSqsProducer({ client, queueUrl: undefined }).send({ notificationId: ID }),
  ).rejects.toThrow('QUEUE_URL');
  expect(sqs).not.toHaveReceivedCommand(SendMessageCommand);
});
