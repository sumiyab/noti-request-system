/** Delivery channels a notification request can target. */
export const CHANNELS = ['EMAIL', 'SMS', 'PUSH'] as const;

/** Lifecycle states. The allowed transitions live in the backend (`domain/lifecycle.ts`). */
export const STATUSES = ['PENDING', 'QUEUED', 'PROCESSING', 'SENT', 'FAILED'] as const;

/** States a request can never leave. */
export const TERMINAL_STATUSES = ['SENT', 'FAILED'] as const;

/** Per-channel input limits. The same numbers drive the form hints and the API errors. */
export const LIMITS = {
  EMAIL: { recipient: 254, subject: 150, message: 5_000 },
  SMS: { message: 1_600 },
  PUSH: { recipient: { min: 8, max: 512 }, subject: 100, message: 1_000 },
} as const;

/** Total delivery attempts before a request is marked FAILED. */
export const MAX_ATTEMPTS = 3;

/** Largest request body the API will parse, in bytes. */
export const MAX_BODY_BYTES = 32 * 1024;

/** Pagination bounds for GET /notifications. */
export const LIST_LIMIT = { min: 1, max: 100, default: 20 } as const;

/** Error codes the API can return in the error envelope. */
export const API_ERROR_CODES = [
  'INVALID_JSON',
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'PAYLOAD_TOO_LARGE',
  'ENQUEUE_FAILED',
  'INTERNAL_ERROR',
] as const;
