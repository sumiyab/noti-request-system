// Jest does not load .env files; mirror .env.example so the SDK targets the emulators.
const defaults: Record<string, string> = {
  TABLE_NAME: 'notification-requests-test',
  QUEUE_URL: 'http://localhost:9324/000000000000/notification-requests',
  MAX_ATTEMPTS: '3',
  SIMULATED_FAILURE_RATE: '0',
  LOG_LEVEL: 'error',
  AWS_ENDPOINT_URL_DYNAMODB: 'http://localhost:8000',
  AWS_ENDPOINT_URL_SQS: 'http://localhost:9324',
  AWS_REGION: 'ap-northeast-1',
  AWS_ACCESS_KEY_ID: 'local',
  AWS_SECRET_ACCESS_KEY: 'local',
};
for (const [key, value] of Object.entries(defaults)) process.env[key] ??= value;
