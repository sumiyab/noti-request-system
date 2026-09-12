import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2, Context } from 'aws-lambda';
import { createNotification, getNotification, listNotifications } from '../src/handlers';

type Handler = (
  event: APIGatewayProxyEventV2,
  context: Context,
) => Promise<APIGatewayProxyStructuredResultV2 | undefined>;

const routes: { method: string; pattern: RegExp; params: string[]; handler: Handler }[] = [
  {
    method: 'POST',
    pattern: /^\/notifications$/,
    params: [],
    handler: createNotification.handler as Handler,
  },
  { method: 'GET', pattern: /^\/notifications$/, params: [], handler: listNotifications.handler as Handler },
  {
    method: 'GET',
    pattern: /^\/notifications\/([^/]+)$/,
    params: ['id'],
    handler: getNotification.handler as Handler,
  },
];

/** Mirrors provider.httpApi.cors in serverless.yml. In AWS, API Gateway does this; locally, the runner does. */
const corsHeaders = (origin: string) => ({
  'access-control-allow-origin': origin,
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-expose-headers': 'location, x-request-id',
  'access-control-max-age': '86400',
});

const toEvent = async (
  req: Request,
  url: URL,
  pathParameters: Record<string, string>,
): Promise<APIGatewayProxyEventV2> =>
  ({
    version: '2.0',
    routeKey: `${req.method} ${url.pathname}`,
    rawPath: url.pathname,
    rawQueryString: url.search.slice(1),
    headers: Object.fromEntries(req.headers),
    queryStringParameters: Object.fromEntries(url.searchParams),
    pathParameters,
    requestContext: {
      requestId: crypto.randomUUID(),
      http: {
        method: req.method,
        path: url.pathname,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: '',
      },
    },
    body: req.method === 'GET' ? undefined : await req.text(),
    isBase64Encoded: false,
  }) as unknown as APIGatewayProxyEventV2;

/** Routes one HTTP request to the matching Lambda handler and converts the result back. */
export const handleHttp = async (req: Request, frontendOrigin: string): Promise<Response> => {
  const cors = corsHeaders(frontendOrigin);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const url = new URL(req.url);
  const route = routes.find((r) => r.method === req.method && r.pattern.test(url.pathname));
  if (!route) {
    const body = JSON.stringify({
      error: { code: 'NOT_FOUND', message: 'Route not found', requestId: 'local' },
    });
    return new Response(body, { status: 404, headers: { 'content-type': 'application/json', ...cors } });
  }

  const match = url.pathname.match(route.pattern) ?? [];
  const pathParameters = Object.fromEntries(
    route.params.map((name, i) => [name, decodeURIComponent(match[i + 1] ?? '')]),
  );
  const result = await route.handler(await toEvent(req, url, pathParameters), {
    awsRequestId: 'local',
  } as Context);

  return new Response(result?.body ?? null, {
    status: result?.statusCode ?? 200,
    headers: { ...(result?.headers as Record<string, string>), ...cors },
  });
};
