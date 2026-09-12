import base from './jest.config.mjs';

/** Runs against DynamoDB Local + ElasticMQ (docker compose up). Sequential: the suites share one table and queue. */
export default {
  ...base,
  roots: ['<rootDir>/specs/integration'],
  setupFiles: ['<rootDir>/specs/integration/env.ts'],
  testTimeout: 30_000,
  coverageThreshold: undefined,
};
