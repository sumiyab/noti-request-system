import { loadConfig } from '../../../src/lib/config';

describe('loadConfig', () => {
  test('applies defaults', () => {
    expect(loadConfig({ TABLE_NAME: 't' })).toEqual({
      tableName: 't',
      queueUrl: undefined,
      maxAttempts: 3,
      simulatedFailureRate: 0.2,
      logLevel: 'info',
    });
  });

  test('coerces numbers and reads every variable', () => {
    const config = loadConfig({
      TABLE_NAME: 't',
      QUEUE_URL: 'http://localhost:9324/q',
      MAX_ATTEMPTS: '5',
      SIMULATED_FAILURE_RATE: '0',
      LOG_LEVEL: 'debug',
    });
    expect(config).toMatchObject({
      queueUrl: 'http://localhost:9324/q',
      maxAttempts: 5,
      simulatedFailureRate: 0,
      logLevel: 'debug',
    });
  });

  test('fails fast with the variable named', () => {
    expect(() => loadConfig({})).toThrow(/Invalid configuration: TABLE_NAME/);
    expect(() => loadConfig({ TABLE_NAME: 't', SIMULATED_FAILURE_RATE: '2' })).toThrow(
      /SIMULATED_FAILURE_RATE/,
    );
  });
});
