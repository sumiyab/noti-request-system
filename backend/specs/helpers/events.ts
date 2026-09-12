import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
  SQSEvent,
  SQSRecord,
} from 'aws-lambda';

type HttpEventInput = {
  method?: string;
  path?: string;
  body?: unknown;
  rawBody?: string;
  pathParameters?: Record<string, string>;
  query?: Record<string, string>;
};

export const httpEvent = ({
  method = 'GET',
  path = '/notifications',
  body,
  rawBody,
  pathParameters,
  query,
}: HttpEventInput) =>
  ({
    version: '2.0',
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: new URLSearchParams(query ?? {}).toString(),
    headers: { 'content-type': 'application/json' },
    ...(query && { queryStringParameters: query }),
    ...(pathParameters && { pathParameters }),
    requestContext: {
      requestId: 'req-test-1',
      http: { method, path, protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'jest' },
    },
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
    isBase64Encoded: false,
  }) as unknown as APIGatewayProxyEventV2;

export const sqsRecord = (body: unknown, messageId = 'msg-1', receiveCount = '1'): SQSRecord =>
  ({
    messageId,
    receiptHandle: `rh-${messageId}`,
    body: typeof body === 'string' ? body : JSON.stringify(body),
    attributes: { ApproximateReceiveCount: receiveCount },
    messageAttributes: {},
    eventSource: 'aws:sqs',
    awsRegion: 'ap-northeast-1',
  }) as unknown as SQSRecord;

export const sqsEvent = (...records: SQSRecord[]): SQSEvent => ({ Records: records });

export const context = {} as Context;

export type HttpResponse = APIGatewayProxyStructuredResultV2 & { body: string };

export const parseResponse = (response: unknown) => {
  const result = response as HttpResponse;
  return { ...result, json: result.body ? (JSON.parse(result.body) as Record<string, unknown>) : undefined };
};
