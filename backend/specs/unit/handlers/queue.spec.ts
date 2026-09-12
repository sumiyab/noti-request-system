import { processNotifications } from '../../../src/handlers';
import { ProviderError } from '../../../src/providers/notificationProvider';
import { context, sqsEvent, sqsRecord } from '../../helpers/events';
import { stored } from '../../helpers/fixtures';
import { makeDeps, transitioned } from '../../helpers/mocks';

const ids = ['a', 'b', 'c'].map((c) => c.repeat(8) + '-0000-4000-8000-000000000000') as [
  string,
  string,
  string,
];

/** Every claim succeeds with a PROCESSING copy of the requested id. */
const claimAll = (deps: ReturnType<typeof makeDeps>) =>
  deps.repo.transition.mockImplementation((id, transition) =>
    Promise.resolve(
      transitioned(stored({ id, status: transition === 'claimed' ? 'PROCESSING' : 'SENT', attempts: 1 })),
    ),
  );

describe('processNotifications handler', () => {
  test('reports only the records that need a retry', async () => {
    const deps = makeDeps();
    claimAll(deps);
    deps.provider.send.mockImplementation((n) =>
      n.id === ids[1]
        ? Promise.reject(new ProviderError('timeout', true))
        : Promise.resolve({ providerMessageId: 'ok' }),
    );

    const result = await processNotifications.createHandler(() => deps)(
      sqsEvent(...ids.map((id, i) => sqsRecord({ notificationId: id }, `msg-${i}`))),
      context,
      () => {},
    );

    expect(result).toEqual({ batchItemFailures: [{ itemIdentifier: 'msg-1' }] });
    expect(deps.repo.transition).toHaveBeenCalledWith(ids[0], 'sent', expect.anything());
    expect(deps.repo.transition).toHaveBeenCalledWith(ids[1], 'retryScheduled', expect.anything());
    expect(deps.repo.transition).toHaveBeenCalledWith(ids[2], 'sent', expect.anything());
  });

  test('an unparseable body is reported (→ DLQ after maxReceiveCount) and does not stop the batch', async () => {
    const deps = makeDeps();
    claimAll(deps);

    const result = await processNotifications.createHandler(() => deps)(
      sqsEvent(
        sqsRecord('not json', 'bad-1'),
        sqsRecord({ nope: true }, 'bad-2'),
        sqsRecord({ notificationId: ids[0] }, 'ok'),
      ),
      context,
      () => {},
    );

    expect(result).toEqual({ batchItemFailures: [{ itemIdentifier: 'bad-1' }, { itemIdentifier: 'bad-2' }] });
    expect(deps.provider.send).toHaveBeenCalledTimes(1);
    expect(deps.repo.transition).toHaveBeenCalledWith(ids[0], 'sent', expect.anything());
  });

  test('an unexpected error reports the record instead of throwing', async () => {
    const deps = makeDeps();
    claimAll(deps);
    deps.provider.send.mockRejectedValueOnce(new TypeError('bug'));

    const result = await processNotifications.createHandler(() => deps)(
      sqsEvent(sqsRecord({ notificationId: ids[0] }, 'm')),
      context,
      () => {},
    );

    expect(result).toEqual({ batchItemFailures: [{ itemIdentifier: 'm' }] });
  });
});
