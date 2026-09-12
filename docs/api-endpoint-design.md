# API endpoint design

Field rules and envelopes are in [api-contract-and-validation.md](api-contract-and-validation.md); the
per-endpoint reference is in the [README](../README.md#api-reference). This document is the _shape_ of the
API: which endpoints exist, why those and not others, and how each one behaves at the edges.

## Resource model

One resource: the **notification request** at `/notifications`. It is a _request_ — a record that something
should be sent — not the notification itself, which is why the resource is created, read, and listed but never
edited: its status changes are made by the system, not by clients.

```
/notifications            collection   POST (create)   GET (list)
/notifications/{id}       item         GET (read)
```

| Not exposed                         | Why                                                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUT` / `PATCH /notifications/{id}` | A request is immutable once accepted; the system owns `status`. Editing a queued message would race the worker.                                                                 |
| `DELETE /notifications/{id}`        | Deleting history removes the audit trail. "Cancel while `QUEUED`" is a status transition, not a delete — listed under future improvements as `POST /notifications/{id}/cancel`. |
| `/notifications/{id}/status`        | The status is a field of the item, not a sub-resource; `GET /notifications/{id}` already returns it.                                                                            |
| `POST /notifications/batch`         | No requirement; the form sends one at a time.                                                                                                                                   |
| `/health`                           | HTTP API + Lambda has no process to be unhealthy; CloudWatch metrics cover availability.                                                                                        |

## Endpoint catalogue

| Endpoint                  | Purpose                                  | Lambda               | Idempotent                           | Success            | Errors                                           |
| ------------------------- | ---------------------------------------- | -------------------- | ------------------------------------ | ------------------ | ------------------------------------------------ |
| `POST /notifications`     | Submit a request                         | `createNotification` | No (each call creates a new request) | `202` + `Location` | `400`, `413`, `503`, `500`                       |
| `GET /notifications`      | Newest-first page, optionally one user's | `listNotifications`  | Yes                                  | `200`              | `400` (bad `limit` / `cursor` / `userId`), `500` |
| `GET /notifications/{id}` | One request by id                        | `getNotification`    | Yes                                  | `200`              | `400` (not a UUID), `404`, `500`                 |

Everything else on the API returns `404 NOT_FOUND` from API Gateway's default route (`$default` is not
configured, so an unknown path never reaches a Lambda).

## Per-endpoint behaviour

### `POST /notifications`

```
→ content-type: application/json
  { "userId": "…", "channel": "EMAIL", "recipient": "…", "subject": "…", "message": "…" }

← 202 Accepted
  location: /notifications/3f0c9a52-…
  { "data": { …, "status": "QUEUED", "attempts": 0, … } }
```

- **`202`, not `201`.** The response says "accepted for processing"; the resource exists but its outcome is
  unknown. `Location` points at where to poll.
- **The body echoes the full item**, so the UI can insert it into the list immediately without a second call.
- **Not idempotent by design.** Two identical submissions are two requests. A client-supplied
  `Idempotency-Key` header (stored on the item, conditional `PutItem`) is the standard fix if retries of the
  _same_ submission ever need to be de-duplicated; not needed for a form with a disabled submit button.
- **`503 ENQUEUE_FAILED` is the only retryable error.** The client may resubmit; the stored `FAILED` item
  remains as a record of the attempt.

### `GET /notifications?limit=20&cursor=…&userId=…`

```
← 200 OK
  { "data": [ …newest first… ], "nextCursor": "eyJ…" | null }
```

- **`userId` is the one filter**, because it is the one a product needs ("my requests") and the one an index
  serves: the `byUser` GSI makes it a `Query`, not a `FilterExpression`, so pages stay full and cheap. With an
  authorizer this stops being a parameter and becomes the caller's identity.

- **Cursor pagination, not offsets.** DynamoDB has no `OFFSET`; a cursor is stable under inserts (a new item
  at the top does not shift page 2), which matters for a list that updates every 2 s.
- **`nextCursor: null` means last page** — explicit, so clients do not infer "fewer than `limit` items".
  (DynamoDB can return a `LastEvaluatedKey` even when no items remain; the repository resolves that so the
  API's contract stays simple.)
- **Newest first only.** No `order` parameter: the UI has one view, and the index has one direction that is
  cheap. Adding `order=asc` later is `ScanIndexForward: true`, nothing more.
- **No other filters (`status=`, `channel=`).** No index supports them; a `FilterExpression` would scan pages
  and return uneven page sizes. If a "failed only" view is ever needed, that is a new GSI, not a query param.
- **Read-after-write is near-immediate but not guaranteed.** The list reads a GSI, which is eventually
  consistent — typically single-digit milliseconds behind. The UI prepends the `POST` response to its cache and
  invalidates the list, so a user never notices; an API client that `POST`s then immediately `GET`s the list
  could, rarely, miss the new item for one poll.

### `GET /notifications/{id}`

```
← 200 OK   { "data": { … } }
← 404      { "error": { "code": "NOT_FOUND", … } }
```

- **Strongly consistent read** (`ConsistentRead: true` on `GetItem`): the `Location` from a `POST` must
  resolve on the very next request. The cost (2× read units) is irrelevant at this volume.
- **`400` for a malformed id, `404` for an unknown one.** Different questions, different answers; it also
  avoids a DynamoDB call for garbage input.

## Routing and transport

| Concern             | Choice                                                                                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Gateway             | API Gateway **HTTP API** (v2 payload). Routes are declared per function in `serverless.yml`; each route maps to exactly one Lambda.                                                                                                        |
| Base path           | The stack's `HttpApiUrl` output, e.g. `https://abc123.execute-api.ap-northeast-1.amazonaws.com`. No custom domain in this project; adding one is `httpApi.domain` plus a certificate.                                                      |
| Versioning          | **None** (`/notifications`, not `/v1/notifications`). One client, one deployment, and additive changes (new optional response fields) are non-breaking. If a breaking change ever ships, a new stage or a `/v2` prefix is a config change. |
| Content negotiation | None — JSON only. `Accept` is ignored.                                                                                                                                                                                                     |
| Compression         | Left to API Gateway defaults; responses are small (a page of 20 is ~6 KB).                                                                                                                                                                 |
| Caching             | `cache-control: no-store` on every response. The list changes every few seconds and the item's `status` is the whole point of reading it; nothing may be cached.                                                                           |
| CORS                | Configured on the HTTP API, restricted to the frontend origin; `Location` is exposed. See README → Design decisions.                                                                                                                       |
| Auth                | None. The task scopes this out; the hook is a Cognito JWT authorizer on the HTTP API, with `ownerId` becoming the list's partition key.                                                                                                    |
| Rate limiting       | None at the API layer. HTTP API supports per-stage throttling (`throttle.rateLimit / burstLimit`) if the endpoint were public; noted, not enabled.                                                                                         |

## Headers

| Header          | Direction | Value                             | Why                                                                                                      |
| --------------- | --------- | --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `content-type`  | both      | `application/json; charset=utf-8` | Only format spoken.                                                                                      |
| `location`      | ← `POST`  | `/notifications/{id}` (path only) | Standard for `202`/`201`; path-relative so it works behind any base URL. Exposed via CORS.               |
| `cache-control` | ← all     | `no-store`                        | See caching above.                                                                                       |
| `x-request-id`  | ← all     | API Gateway request id            | The same id that appears in `error.requestId` and in every log line, available on success responses too. |

## Endpoint → infrastructure

| Endpoint                  | Lambda               | DynamoDB                         | SQS           | IAM actions                                                  |
| ------------------------- | -------------------- | -------------------------------- | ------------- | ------------------------------------------------------------ |
| `POST /notifications`     | `createNotification` | `PutItem`, `UpdateItem` on table | `SendMessage` | `dynamodb:PutItem`, `dynamodb:UpdateItem`, `sqs:SendMessage` |
| `GET /notifications`      | `listNotifications`  | `Query` on `byCreatedAt`         | —             | `dynamodb:Query` (index ARN only)                            |
| `GET /notifications/{id}` | `getNotification`    | `GetItem` (consistent)           | —             | `dynamodb:GetItem`                                           |

Each row is one function with exactly that policy — the mapping _is_ the least-privilege design.

## Client usage pattern

```
POST /notifications ──► 202 { data }        insert into the list immediately
        │
        └─ while any item is non-terminal:
             every 2 s: GET /notifications ──► 200 { data, nextCursor }   replace the first page
                    (no per-item GET: one list call refreshes every status at once)
```

`GET /notifications/{id}` is for deep links and API clients following `Location`; the UI never needs it because
the list already contains everything.

## Evolution

Changes that would **not** break existing clients (add freely):

- new optional fields on the notification object (`scheduledFor`, `templateId`)
- new query parameters with defaults that preserve today's behaviour (`order`, `channel`)
- new endpoints (`POST /notifications/{id}/cancel`)

Changes that **would** (need a new version/stage):

- renaming or removing a field, changing `status` values, changing the envelope
- **moving `userId` from the body to the token.** The planned path once a JWT authorizer (Cognito) sits in
  front of the API: `createNotification` reads `requestContext.authorizer.jwt.claims.sub`, the list endpoint
  scopes itself to the caller and drops `?userId=`, and the body field is rejected as unknown. Clients that
  send `userId` today would break, so it ships as a new stage or with a transition window that accepts both.

## Alternatives considered

| Alternative                                                         | Why not                                                                                                                       |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `/v1/` prefix from day one                                          | Speculative; adds a segment to every URL for a benefit that a stage name or prefix provides just as well _when_ it is needed. |
| RPC-style paths (`/createNotification`, `/getNotifications`)        | Method-in-the-path duplicates the HTTP verb and makes caching/CORS rules per-path instead of per-resource.                    |
| `POST` returning `201 Created`                                      | Implies the resource is complete; delivery has not happened.                                                                  |
| Offset pagination (`?page=2`)                                       | Not supported by DynamoDB; unstable under inserts.                                                                            |
| `GET /notifications/{id}` via the GSI for consistency with the list | Table `GetItem` is cheaper, simpler, and can be strongly consistent; the GSI cannot.                                          |
| GraphQL / AppSync                                                   | One resource, three operations; a query language adds a schema layer with nothing to compose.                                 |
| REST API (v1) for request validators and API keys                   | Neither is required; HTTP API is cheaper and faster.                                                                          |
