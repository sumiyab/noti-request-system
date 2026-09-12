import { MAX_BODY_BYTES, type ApiErrorBody } from '@noti/shared';
import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import type { ZodType } from 'zod';
import { AppError, InvalidJsonError, PayloadTooLargeError, ValidationError } from './errors';
import type { Logger } from './logger';

export type HttpRequest = {
  body: string | undefined;
  pathParameters: Record<string, string | undefined>;
  queryStringParameters: Record<string, string | undefined>;
  requestId: string;
  log: Logger;
};

export type HttpResult = { status: number; body?: unknown; headers?: Record<string, string> };

const BASE_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

const decodeBody = (event: APIGatewayProxyEventV2) =>
  event.body === undefined
    ? undefined
    : event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;

const toResponse = (result: HttpResult, requestId: string): APIGatewayProxyResultV2 => ({
  statusCode: result.status,
  headers: { ...BASE_HEADERS, 'x-request-id': requestId, ...result.headers },
  body: result.body === undefined ? '' : JSON.stringify(result.body),
});

const errorResult = (error: AppError, requestId: string): HttpResult => {
  const body: ApiErrorBody = {
    error: {
      code: error.code,
      message: error.message,
      requestId,
      ...(error.details && { details: error.details }),
    },
  };
  return { status: error.status, body };
};

/**
 * Wraps an HTTP handler with everything that is identical for every route: body size limit, request id,
 * error → envelope mapping. Handlers return `{ status, body, headers }` or throw an AppError / ZodError.
 */
export const httpHandler =
  (fn: (req: HttpRequest) => Promise<HttpResult>, getLog: () => Logger): APIGatewayProxyHandlerV2 =>
  async (event) => {
    const requestId = event.requestContext.requestId;
    const reqLog = getLog().child({ requestId, route: event.routeKey });
    try {
      const body = decodeBody(event);
      if (body !== undefined && Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
        throw new PayloadTooLargeError(MAX_BODY_BYTES);
      }
      const result = await fn({
        body,
        pathParameters: event.pathParameters ?? {},
        queryStringParameters: event.queryStringParameters ?? {},
        requestId,
        log: reqLog,
      });
      return toResponse(result, requestId);
    } catch (error) {
      if (error instanceof AppError) {
        reqLog.info('request rejected', { status: error.status, code: error.code });
        return toResponse(errorResult(error, requestId), requestId);
      }
      reqLog.error('unhandled error', { error });
      const internal = new AppError(500, 'INTERNAL_ERROR', 'Something went wrong');
      return toResponse(errorResult(internal, requestId), requestId);
    }
  };

/** Parses the raw body as a JSON object; anything else is INVALID_JSON. */
export const parseJsonBody = (req: HttpRequest): unknown => {
  if (req.body === undefined || req.body.trim() === '')
    throw new InvalidJsonError('Request body is required');
  let parsed: unknown;
  try {
    parsed = JSON.parse(req.body);
  } catch {
    throw new InvalidJsonError();
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new InvalidJsonError('Request body must be a JSON object');
  }
  return parsed;
};

/** Validates with a zod schema; failures become VALIDATION_ERROR with one detail per issue. */
export const parseWith = <T>(schema: ZodType<T>, input: unknown, pathPrefix?: string): T => {
  const result = schema.safeParse(input);
  if (!result.success) throw ValidationError.fromZod(result.error, pathPrefix);
  return result.data;
};
