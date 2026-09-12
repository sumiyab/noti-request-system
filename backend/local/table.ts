import {
  CreateTableCommand,
  DynamoDBClient,
  ResourceInUseException,
  waitUntilTableExists,
  type CreateTableCommandInput,
} from '@aws-sdk/client-dynamodb';

/** Same keys and index as the CloudFormation table in serverless.yml. */
export const tableDefinition = (tableName: string): CreateTableCommandInput => ({
  TableName: tableName,
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [
    { AttributeName: 'id', AttributeType: 'S' },
    { AttributeName: 'entityType', AttributeType: 'S' },
    { AttributeName: 'createdAt', AttributeType: 'S' },
  ],
  KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'byCreatedAt',
      KeySchema: [
        { AttributeName: 'entityType', KeyType: 'HASH' },
        { AttributeName: 'createdAt', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
  ],
});

/** Creates the table in DynamoDB Local if it does not exist. Idempotent; safe to run on every start. */
export const ensureTable = async (tableName: string, client = new DynamoDBClient({})) => {
  try {
    await client.send(new CreateTableCommand(tableDefinition(tableName)));
    await waitUntilTableExists({ client, maxWaitTime: 30 }, { TableName: tableName });
    return 'created' as const;
  } catch (error) {
    if (error instanceof ResourceInUseException) return 'exists' as const;
    throw error;
  }
};
