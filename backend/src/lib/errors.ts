import type { ApiErrorCode, FieldError } from '@noti/shared';
import type { ZodError } from 'zod';

/** An error that maps to an HTTP status and a code in the error envelope. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: FieldError[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidJsonError extends AppError {
  constructor(message = 'Request body is not valid JSON') {
    super(400, 'INVALID_JSON', message);
  }
}

export class ValidationError extends AppError {
  constructor(details: FieldError[], message = 'Request validation failed') {
    super(400, 'VALIDATION_ERROR', message, details);
  }

  static fromZod = (error: ZodError, pathPrefix?: string): ValidationError =>
    new ValidationError(
      error.issues.map((issue) => ({
        path: [pathPrefix, ...issue.path.map(String)].filter((p): p is string => !!p).join('.'),
        message: issue.message,
      })),
    );
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(maxBytes: number) {
    super(413, 'PAYLOAD_TOO_LARGE', `Request body must be ${maxBytes} bytes or smaller`);
  }
}

export class EnqueueFailedError extends AppError {
  constructor() {
    super(503, 'ENQUEUE_FAILED', 'The request was stored but could not be queued; it is safe to resubmit');
  }
}
