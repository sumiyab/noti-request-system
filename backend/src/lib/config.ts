import { z } from 'zod';

const configSchema = z.object({
  TABLE_NAME: z.string().min(1, 'TABLE_NAME is required'),
  /** Only the create function needs the queue. */
  QUEUE_URL: z.string().url().optional(),
  MAX_ATTEMPTS: z.coerce.number().int().min(1).default(3),
  SIMULATED_FAILURE_RATE: z.coerce.number().min(0).max(1).default(0.2),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Config = {
  tableName: string;
  queueUrl: string | undefined;
  maxAttempts: number;
  simulatedFailureRate: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
};

/** Reads and validates the environment once. A bad deploy fails on the first invocation with a clear message. */
export const loadConfig = (env: Record<string, string | undefined> = process.env): Config => {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid configuration: ${problems}`);
  }
  const { TABLE_NAME, QUEUE_URL, MAX_ATTEMPTS, SIMULATED_FAILURE_RATE, LOG_LEVEL } = result.data;
  return {
    tableName: TABLE_NAME,
    queueUrl: QUEUE_URL,
    maxAttempts: MAX_ATTEMPTS,
    simulatedFailureRate: SIMULATED_FAILURE_RATE,
    logLevel: LOG_LEVEL,
  };
};
