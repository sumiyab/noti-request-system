import { SQSClient } from '@aws-sdk/client-sqs';
import { handleHttp } from './http';
import { pollForever } from './poller';

/**
 * Local runner: HTTP on :3001 → the real Lambda handlers; an SQS poller → the real worker handler.
 * Bun loads .env.local; the AWS SDK reaches the Docker emulators through AWS_ENDPOINT_URL_*.
 */
const port = Number(process.env.PORT ?? 3001);
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';
const queueUrl = process.env.QUEUE_URL;
if (!queueUrl) throw new Error('QUEUE_URL is not set (see .env.example)');

Bun.serve({ port, fetch: (req) => handleHttp(req, frontendOrigin) });
console.log(`[api] http://localhost:${port} (CORS origin ${frontendOrigin})`);

const controller = new AbortController();
process.on('SIGINT', () => controller.abort());
process.on('SIGTERM', () => controller.abort());
void pollForever({ client: new SQSClient({}), queueUrl, log: console.log, signal: controller.signal });
console.log(`[worker] polling ${queueUrl}`);
