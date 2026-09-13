# Operations — deploying and running in AWS

How the stack is deployed, what is live, and what to watch.

## Deploy the backend to AWS

```bash
cd backend
bunx serverless login                   # once — Serverless Framework v4 requires an account (free for individuals)
bunx serverless deploy --stage dev            # prints the endpoints; --param="frontendOrigin=https://…" for a custom host
```

Optional: `--param="alarmEmail=you@example.com"` subscribes an address to the alarm topic (SNS sends a
confirmation link). Without it the three alarms still evaluate and show in the CloudWatch console.

Point the frontend at the deployed API:

```bash
echo "NEXT_PUBLIC_API_URL=https://<api-id>.execute-api.<region>.amazonaws.com" > frontend/.env.local
bun run dev:frontend                    # or: cd frontend && bun run build → static site in frontend/out
```

`frontend/out` can be hosted on any static host (S3 + CloudFront, Vercel, Netlify). The dev stage allows
`http://localhost:3000` and the deployed frontend (https://noti-request-system.vercel.app) as CORS origins.
Tear the backend down with `bunx serverless remove --stage dev`.

## Deploy the frontend to Vercel

The repo is a Bun workspace, so the Vercel project is linked at the **repo root** with **Root Directory =
`frontend`**; that way `@noti/shared` (a `workspace:*` link) resolves during the build.

```bash
vercel link                                                   # once, at the repo root → creates .vercel/ (gitignored)
vercel env add NEXT_PUBLIC_API_URL production                  # paste the HttpApiUrl from `serverless deploy`
vercel deploy --prod                                           # builds `next build` (static export) and promotes it
```

Vercel detects Next.js and Bun from `bun.lock`. `NEXT_PUBLIC_API_URL` is inlined at build time
(`next.config.ts`), so changing it needs a redeploy. If the frontend moves to another host, redeploy the
backend with `--param="frontendOrigin=https://<new-host>"` so API Gateway's CORS allow-list follows it.

## Live deployment

What is currently running, and where:

- **Frontend** — Vercel project `noti-request-system` → <https://noti-request-system.vercel.app>. Static
  export of `frontend/`; `NEXT_PUBLIC_API_URL` set in the Production environment. Redeployed with
  `vercel deploy --prod` from the repo root.
- **API** — API Gateway HTTP API `jvw8398zx2` in `ap-southeast-2` →
  `https://jvw8398zx2.execute-api.ap-southeast-2.amazonaws.com`. CORS allow-list: `http://localhost:3000` and
  the Vercel origin. No authorizer — see [Trade-offs](design-decisions.md#trade-offs-and-known-limitations).
- **Compute** — 4 Lambdas (`createNotification`, `listNotifications`, `getNotification`,
  `processNotifications`), Node.js 22. CloudFormation stack `noti-request-system-dev`, deployed with
  `serverless deploy --stage dev`. One IAM role per function, scoped to the table/indexes/queue it touches.
- **Data** — DynamoDB `notification-requests-dev` with GSIs `byCreatedAt` and `byUser`. PAY_PER_REQUEST,
  point-in-time recovery on.
- **Queue** — SQS `notification-requests-dev` + `notification-requests-dlq-dev`. Event source mapping →
  `processNotifications`, batch ≤ 10, `ReportBatchItemFailures`; 60 s visibility timeout; DLQ after 5
  receives. `SIMULATED_FAILURE_RATE=0.2` so retries are visible.
- **Logs** — CloudWatch `/aws/lambda/noti-request-system-dev-*`, 14-day retention. Structured JSON lines with
  `requestId` / `notificationId`; `aws logs tail <group> --follow` to watch a request go through.
- **Tracing** — X-Ray active on every function, so one trace follows a request from the API Lambda through SQS
  into the worker.
- **Alarms** — SNS topic `noti-request-system-dev-alarms` with three CloudWatch alarms: DLQ not empty (any
  message, 1 min), worker `Errors ≥ 1` (5 min), API `5xx ≥ 1` (5 min). Deploy with
  `--param="alarmEmail=you@example.com"` to subscribe an address; without it the alarms still fire and show in
  the console.
- **Guard rails** — HTTP API stage throttle 10 req/s sustained, burst 20 (the API is unauthenticated, so this
  is the only thing between it and a loop); worker reserved concurrency 5 (≤ 50 in-flight sends against the
  provider); DynamoDB encrypted with a KMS key so every decrypt is in CloudTrail.

The [request sequence](../README.md#request-sequence) diagram above is this exact deployment. Nothing in the
frontend bundle or the Lambda code is environment-specific: the same handlers run against DynamoDB Local +
ElasticMQ in [Run locally](../README.md#run-it) and against AWS here.

## Scale — what this stack handles today, and what gives first

The write path is horizontal (DynamoDB on-demand, SQS, Lambda) and every transition is idempotent, so 100k
users _over a day_ is comfortable. 100k users _at the same moment_ is not, and the limits are known and in
this order:

1. **The API throttle** — 10 req/s, burst 20 on the HTTP API stage. A deliberate guard for an unauthenticated
   demo endpoint, not a capacity figure; it is one line (`ThrottlingRateLimit`) and the account default is 10
   000 req/s. Under real load, per-client limits belong to WAF or a usage plan behind an authorizer.
2. **Polling** — 100k open browsers polling every 2 s is 50 000 `Query`/s. This is the architectural ceiling:
   the fix is backoff (2 → 5 → 15 s) and per-item polling for one's own in-flight requests short term, and
   push (WebSocket API or SSE fed by a DynamoDB Stream) at scale.
3. **Lambda concurrency** — an account quota (400 in the dev account) shared by all four functions; the API is
   one invocation per request. Raising it is a quota request to AWS, not a code change; 10 000+ is routine.
   Provisioned concurrency would flatten cold starts at a known peak.
4. **The `byCreatedAt` index** — one constant partition key caps the global newest-first list at roughly 1 000
   writes/s. Either shard the key by time bucket (`NOTIFICATION#2026-09-13T14`) or, once there is an
   authorizer, drop the global list altogether: users see their own history via `byUser`, whose key is
   naturally spread.
5. **Worker throughput** — reserved concurrency 5 × batch 10 at ~1 s per send ≈ 50 sends/s, so 100k queued
   requests drain in ~35 minutes. The number is chosen to sit under a provider's rate limit (SES and SNS SMS
   defaults are in the tens to low hundreds per second per account); raise it with the provider's quota — the
   provider, not this stack, is the real ceiling on sends.
6. **Not a concern** — DynamoDB on-demand (UUID table key spreads writes; tens of thousands of WCU/RCU on
   demand), SQS standard (effectively unlimited), the Lambda code itself (stateless, ~70–100 ms warm).
