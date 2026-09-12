/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  transform: { '^.+\\.ts$': ['@swc/jest', { jsc: { target: 'es2022', parser: { syntax: 'typescript' } } }] },
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.spec.ts'],
  clearMocks: true,
};
