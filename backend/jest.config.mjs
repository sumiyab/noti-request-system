/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  transform: { '^.+\\.ts$': ['@swc/jest', { jsc: { target: 'es2022', parser: { syntax: 'typescript' } } }] },
  roots: ['<rootDir>/specs/unit'],
  testMatch: ['**/*.spec.ts'],
  clearMocks: true,
  setupFilesAfterEnv: ['aws-sdk-client-mock-jest'],
  collectCoverageFrom: ['src/**/*.ts', '!src/deps.ts'],
  coverageThreshold: { global: { branches: 85, lines: 90 } },
};
