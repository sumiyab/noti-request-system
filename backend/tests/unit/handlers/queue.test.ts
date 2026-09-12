import { createHandler } from '../../../src/handlers/queue/processNotifications';
import { ProviderError } from '../../../src/providers/notificationProvider';
import { context, sqsEvent, sqsRecord } from '../../helpers/events';
import { makeDeps, providerThat } from '../../helpers/fakes';
import { stored } from '../../helpers/fixtures';

const ids = ['a', 'b', 'c'].map((c) => c.repeat(8) + '-0000-4000-8000-000000000000') as [
  string,
  string,
  string,
];

describe('processNotifications handler', () => {
  test('reports only the records that need a retry', async () => {
    const provider = providerThat((n) =>
      n.id === ids[1] ? new ProviderError('timeout', true) : { providerMessageId: 'ok' },
    );
    const deps = makeDeps({ provider });
    ids.forEach((id) => deps.repo.seed(stored({ id })));

    const result = await createHandler(() => deps)(
      sqsEvent(...ids.map((id, i) => sqsRecord({ notificationId: id }, `msg-${i}`))),
      context,
      () => {},
    );

    expect(result).toEqual({ batchItemFailures: [{ itemIdentifier: 'msg-1' }] });
    expect(deps.repo.items.get(ids[0])?.status).toBe('SENT');
    expect(deps.repo.items.get(ids[1])?.status).toBe('QUEUED');
    expect(deps.repo.items.get(ids[2])?.status).toBe('SENT');
  });

  test('an unparseable body is reported (→ DLQ after maxReceiveCount) and does not stop the batch', async () => {
    const deps = makeDeps();
    deps.repo.seed(stored({ id: ids[0] }));
    const result = await createHandler(() => deps)(
      sqsEvent(
        sqsRecord('not json', 'bad-1'),
        sqsRecord({ nope: true }, 'bad-2'),
        sqsRecord({ notificationId: ids[0] }, 'ok'),
      ),
      context,
      () => {},
    );
    expect(result).toEqual({ batchItemFailures: [{ itemIdentifier: 'bad-1' }, { itemIdentifier: 'bad-2' }] });
    expect(deps.repo.items.get(ids[0])?.status).toBe('SENT');
  });

  test('an unexpected error reports the record instead of throwing', async () => {
    const deps = makeDeps({ provider: providerThat(() => new TypeError('bug')) });
    deps.repo.seed(stored({ id: ids[0] }));
    const result = await createHandler(() => deps)(
      sqsEvent(sqsRecord({ notificationId: ids[0] }, 'm')),
      context,
      () => {},
    );
    expect(result).toEqual({ batchItemFailures: [{ itemIdentifier: 'm' }] });
  });
});
