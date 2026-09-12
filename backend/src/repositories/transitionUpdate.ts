import { TRANSITIONS, isTerminal, type Transition } from '../domain/lifecycle';

export type TransitionOptions = {
  now: Date;
  lastError?: string;
  providerMessageId?: string;
  /** Required for `claimed`: the claim also increments `attempts` and refuses once the cap is reached. */
  maxAttempts?: number;
};

/**
 * Builds the UpdateItem pieces for a transition: the SET/ADD expression and the ConditionExpression that
 * enforces the allowed "from" states. Pure, so the unit tests assert the exact expressions.
 */
export const buildTransitionUpdate = (transition: Transition, options: TransitionOptions) => {
  const { from, to } = TRANSITIONS[transition];
  const now = options.now.toISOString();
  const names: Record<string, string> = { '#status': 'status' };
  const values: Record<string, unknown> = { ':to': to, ':now': now };
  const sets = ['#status = :to', 'updatedAt = :now'];
  const conditions: string[] = [];

  const fromKeys = from.map((status, i) => {
    values[`:from${i}`] = status;
    return `:from${i}`;
  });
  conditions.push(`#status IN (${fromKeys.join(', ')})`);

  if (options.lastError !== undefined) {
    values[':lastError'] = options.lastError;
    sets.push('lastError = :lastError');
  }
  if (options.providerMessageId !== undefined) {
    values[':providerMessageId'] = options.providerMessageId;
    sets.push('providerMessageId = :providerMessageId');
  }
  if (isTerminal(to)) sets.push('completedAt = :now');

  let add: string | undefined;
  if (transition === 'claimed') {
    if (options.maxAttempts === undefined) throw new Error('claimed requires maxAttempts');
    values[':one'] = 1;
    values[':max'] = options.maxAttempts;
    conditions.push('attempts < :max');
    add = 'ADD attempts :one';
  }

  return {
    UpdateExpression: [`SET ${sets.join(', ')}`, add].filter(Boolean).join(' '),
    ConditionExpression: conditions.join(' AND '),
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  };
};
