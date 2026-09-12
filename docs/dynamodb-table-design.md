# DynamoDB table design — `notification-requests`

One table, one item per notification request, one global secondary index for listing. Everything the
API and the worker do is either a key lookup on the table or a single query on the index.

## Access patterns

Design starts from the queries, not from the data:

| #   | Access pattern                         | Caller               | Operation                                                                        |
| --- | -------------------------------------- | -------------------- | -------------------------------------------------------------------------------- |
| 1   | Create a request                       | `createNotification` | `PutItem` (condition: `id` does not exist)                                       |
| 2   | Fetch one request by id                | `getNotification`    | `GetItem` on the table                                                           |
| 3   | List requests, newest first, paginated | `listNotifications`  | `Query` on `byCreatedAt`, `ScanIndexForward=false`, `Limit`, `ExclusiveStartKey` |
| 4   | Move a request to its next status      | API and worker       | `UpdateItem` with a `ConditionExpression` on the current `status`                |

There is no "find by recipient", "find by status", or "delete" — so there are no indexes for them.

## Key structure

DynamoDB has no schema except its keys, so the keys _are_ the data model. Two rules drive every choice below:

1. **The partition key decides where an item lives.** DynamoDB hashes it to pick a physical partition, so a
   well-distributed key (a UUID) scales, while a shared key puts every item on the same partition.
2. **The sort key decides order within one partition.** `Query` can sort, range, and `Limit` — but only among
   items that share a partition key. There is no cross-partition sort; a global order needs a shared key.

|                       | Partition key                          | Sort key               | Serves                                                               |
| --------------------- | -------------------------------------- | ---------------------- | -------------------------------------------------------------------- |
| **Table**             | `id` — UUID v4                         | none (simple key)      | `GetItem` by id; `PutItem` on create; every conditional `UpdateItem` |
| **GSI `byCreatedAt`** | `entityType` — always `"NOTIFICATION"` | `createdAt` — ISO 8601 | `Query` newest first, paginated                                      |

```
Table (PK = id)                        GSI byCreatedAt (PK = entityType, SK = createdAt)
┌──────────────┬────────────────┐      ┌────────────────┬──────────────────────────┬─────────┐
│ id           │ …attributes…   │      │ entityType     │ createdAt                │ id …    │
├──────────────┼────────────────┤      ├────────────────┼──────────────────────────┼─────────┤
│ 3f0c…        │ SENT, EMAIL …  │ ───▶ │ NOTIFICATION   │ 2026-09-12T04:00:00.000Z │ 3f0c…   │
│ 9a1b…        │ QUEUED, SMS …  │ ───▶ │ NOTIFICATION   │ 2026-09-12T04:00:03.210Z │ 9a1b…   │
│ c7e2…        │ FAILED, PUSH … │ ───▶ │ NOTIFICATION   │ 2026-09-12T04:01:17.004Z │ c7e2…   │
└──────────────┴────────────────┴      └────────────────┴──────────────────────────┴─────────┘
 spread across partitions               one partition, sorted by time
 → GetItem(id)                          → Query(entityType = NOTIFICATION) DESC, Limit 20
```

- **Table key is `id` alone** because a request is a single item, never a group, and every writer already
  knows the id — the API generated it, the worker received it in the SQS message. No timestamp is needed to
  find an item.
- **Index partition key is a constant** on purpose: it applies rule 2 to get one global order. The cost — one
  hot index partition — is discussed under the index section.
- **Index sort key is an ISO string** because a fixed-width `YYYY-MM-DDTHH:mm:ss.sssZ` sorts lexically and
  chronologically at once; `ScanIndexForward = false` yields newest first.
- **`status`, `channel`, `recipient`, `attempts`, … are not keys.** DynamoDB never indexes them; they matter
  only inside `ConditionExpression` / `UpdateExpression`. `AttributeDefinitions` therefore lists only `id`,
  `entityType`, `createdAt` — declaring a non-key attribute there is an error.

## Table

| Setting                | Value                                          | Why                                                                         |
| ---------------------- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| Name                   | `notification-requests-${stage}`               | One table per stage; the name is injected into the Lambdas as `TABLE_NAME`. |
| Partition key          | `id` (String, UUID v4)                         | One item per request; UUIDs spread evenly across partitions.                |
| Sort key               | none                                           | A request is a single item, never a collection.                             |
| Billing                | `PAY_PER_REQUEST`                              | No traffic forecast; nothing to provision, zero cost when idle.             |
| Point-in-time recovery | on                                             | Cheap insurance; the table is the only record of a request.                 |
| `DeletionPolicy`       | `Retain` for `prod`, `Delete` for other stages | `serverless remove` on a dev stage should clean up completely.              |

## Item

```jsonc
{
  "id": "3f0c9a52-8f6e-4d63-9a51-3c1e0f2b7d10", // PK
  "entityType": "NOTIFICATION", // GSI PK — constant, see below
  "createdAt": "2026-09-12T04:00:00.000Z", // GSI SK — ISO 8601, sorts lexically = chronologically

  "channel": "EMAIL",
  "recipient": "jane@example.com",
  "subject": "Welcome!", // absent for SMS
  "message": "Thanks for signing up.",

  "status": "QUEUED", // PENDING | QUEUED | PROCESSING | SENT | FAILED
  "attempts": 0, // incremented when a worker claims the item
  "updatedAt": "2026-09-12T04:00:00.012Z",

  // present only once set:
  "completedAt": "2026-09-12T04:00:01.400Z", // SENT or FAILED
  "providerMessageId": "sim-7d10", // SENT
  "lastError": "Provider timeout", // retries and FAILED
}
```

Attribute names match the API response one-to-one, so the repository's item → DTO mapping is a pass-through
minus `entityType`. Optional attributes are **omitted**, not stored as `null`, so `attribute_exists` checks and
the API's `subject?: string` type both stay honest.

## Global secondary index `byCreatedAt`

| Setting       | Value                                           |
| ------------- | ----------------------------------------------- |
| Partition key | `entityType` (String) — always `"NOTIFICATION"` |
| Sort key      | `createdAt` (String)                            |
| Projection    | `ALL`                                           |

Listing is `Query(entityType = "NOTIFICATION")`, descending by `createdAt`, `Limit = limit`. Because the
index is a copy with `ALL` projection, the list endpoint never has to go back to the table.

**Why a constant partition key.** DynamoDB can only sort within a partition, and "newest first across the
whole system" needs one global order. A constant key gives that in one `Query`. The cost is that every item
lands in the same index partition, which caps sustained writes to the index at roughly 1,000 per second — far
above this project's needs. If it ever mattered, the key would become a date bucket (`NOTIFICATION#2026-09-12`)
and the list would query today's bucket first, then the previous day's.

**Why not `Scan`.** `Scan` reads the whole table on every list call and returns items in no useful order;
it is fine at ten items and unusable at ten thousand.

**Why not a `status` index.** The UI shows every request, not "only failed ones", and the worker locates items
by id from the SQS message — nobody queries by status.

### Pagination cursor

`Query` returns `LastEvaluatedKey` — for this index it is `{ id, entityType, createdAt }`. The repository
base64url-encodes that JSON as `nextCursor`; the next request sends it back and the repository decodes it into
`ExclusiveStartKey`. The cursor is validated on decode (a zod schema for the three keys) so a malformed or
hand-edited cursor becomes a `400 VALIDATION_ERROR` on `cursor`, not a DynamoDB exception. Clients never need
to know what is inside.

## Writes and conditions

Every status change is one `UpdateItem` whose `ConditionExpression` names the states it may start from. A
write that does not satisfy the condition throws `ConditionalCheckFailedException`, which the service treats
as "someone else got there first" — it is not an error to retry.

| Transition       | Condition                                                      | Update                                                                                |
| ---------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| create           | `attribute_not_exists(id)`                                     | `PutItem` with `status = PENDING`, `attempts = 0`                                     |
| `enqueued`       | `#status = PENDING`                                            | `SET #status = QUEUED, updatedAt = :now`                                              |
| `enqueueFailed`  | `#status = PENDING`                                            | `SET #status = FAILED, lastError = :err, completedAt = :now, updatedAt = :now`        |
| `claimed`        | `#status IN (PENDING, QUEUED, PROCESSING) AND attempts < :max` | `SET #status = PROCESSING, updatedAt = :now ADD attempts :one`                        |
| `sent`           | `#status = PROCESSING`                                         | `SET #status = SENT, providerMessageId = :pmid, completedAt = :now, updatedAt = :now` |
| `retryScheduled` | `#status = PROCESSING`                                         | `SET #status = QUEUED, lastError = :err, updatedAt = :now`                            |
| `failed`         | `#status = PROCESSING`                                         | `SET #status = FAILED, lastError = :err, completedAt = :now, updatedAt = :now`        |

`status` is a DynamoDB reserved word, hence `#status` via `ExpressionAttributeNames`.

Two consequences worth stating:

- **Duplicate SQS deliveries are harmless.** A second delivery for a `SENT` item fails the `claimed` condition
  and the worker skips it. Correctness never depends on exactly-once delivery.
- **The attempts cap is enforced at the database.** `attempts < :max` in the claim condition means that even if
  SQS redelivered more times than expected, a fourth attempt cannot start.

## CloudFormation (in `backend/serverless.yml`)

```yaml
resources:
  Resources:
    NotificationRequestsTable:
      Type: AWS::DynamoDB::Table
      DeletionPolicy: ${self:custom.tableDeletionPolicy.${sls:stage}, 'Delete'}
      Properties:
        TableName: notification-requests-${sls:stage}
        BillingMode: PAY_PER_REQUEST
        AttributeDefinitions:
          - { AttributeName: id, AttributeType: S }
          - { AttributeName: entityType, AttributeType: S }
          - { AttributeName: createdAt, AttributeType: S }
        KeySchema:
          - { AttributeName: id, KeyType: HASH }
        GlobalSecondaryIndexes:
          - IndexName: byCreatedAt
            KeySchema:
              - { AttributeName: entityType, KeyType: HASH }
              - { AttributeName: createdAt, KeyType: RANGE }
            Projection: { ProjectionType: ALL }
        PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true }

custom:
  tableDeletionPolicy:
    prod: Retain
```

Only key attributes appear in `AttributeDefinitions` — DynamoDB is schemaless for everything else.

Per-function IAM follows the access patterns exactly:

| Function               | Actions                                   | Resource                   |
| ---------------------- | ----------------------------------------- | -------------------------- |
| `createNotification`   | `dynamodb:PutItem`, `dynamodb:UpdateItem` | table                      |
| `listNotifications`    | `dynamodb:Query`                          | table `/index/byCreatedAt` |
| `getNotification`      | `dynamodb:GetItem`                        | table                      |
| `processNotifications` | `dynamodb:GetItem`, `dynamodb:UpdateItem` | table                      |

## Local development

`backend/local/setup.ts` creates the same table (same keys, same index) in DynamoDB Local on first start, using
`CreateTableCommand` with the definition above. The AWS SDK is pointed at the emulator purely via
`AWS_ENDPOINT_URL_DYNAMODB=http://localhost:8000`; the repository code is identical in both environments.

## Alternatives considered

| Alternative                                             | Why not                                                                                                                                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single-table design with generic `pk` / `sk`            | One entity type; generic keys would only make the items harder to read in the console.                                                                                                            |
| `createdAt` as the table's sort key (`pk = entityType`) | Puts every _table_ write on one partition too, and `GetItem` by id would need the timestamp. Keeping `id` as the table key and paying for the constant key only on the index is the better trade. |
| Numeric epoch for `createdAt`                           | ISO strings sort the same, are readable in the console and in API responses, and need no conversion.                                                                                              |
| TTL to expire old requests                              | Not asked for; would be a one-attribute addition (`expiresAt`) later.                                                                                                                             |
| DynamoDB Streams to trigger the SQS send                | Removes the stuck-`PENDING` window (see README trade-offs) but adds a Lambda and a stream; listed under future improvements.                                                                      |
