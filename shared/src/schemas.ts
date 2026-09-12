import { z } from 'zod';
import { API_ERROR_CODES, CHANNELS, LIMITS, LIST_LIMIT, STATUSES } from './constants';

// ---------------------------------------------------------------------------
// Input: what a client sends to POST /notifications
// ---------------------------------------------------------------------------

/** E.164: "+" followed by 2–15 digits, no leading zero. */
const E164 = /^\+[1-9]\d{1,14}$/;

/** Device tokens as issued by APNs / FCM: no whitespace, a limited character set. */
const DEVICE_TOKEN = /^[A-Za-z0-9:._-]+$/;

const message = (max: number) =>
  z.string().trim().min(1, 'Message is required').max(max, `Message must be ${max} characters or fewer`);

const subject = (max: number) =>
  z.string().trim().min(1, 'Subject is required').max(max, `Subject must be ${max} characters or fewer`);

/**
 * Discriminated by `channel`, so each channel has exactly the fields it needs:
 *  - EMAIL: subject required
 *  - SMS:   no subject at all (a strict object rejects it as an unknown key)
 *  - PUSH:  subject required (it is the push title)
 * Strict objects reject unknown keys, so a typo like `reciepient` fails loudly.
 */
export const createNotificationSchema = z.discriminatedUnion('channel', [
  z.strictObject({
    channel: z.literal('EMAIL'),
    recipient: z
      .string()
      .trim()
      .max(LIMITS.EMAIL.recipient, `Email must be ${LIMITS.EMAIL.recipient} characters or fewer`)
      .pipe(z.email('Enter a valid email address')),
    subject: subject(LIMITS.EMAIL.subject),
    message: message(LIMITS.EMAIL.message),
  }),
  z.strictObject({
    channel: z.literal('SMS'),
    recipient: z.string().trim().regex(E164, 'Enter a phone number in E.164 format, e.g. +97699112233'),
    message: message(LIMITS.SMS.message),
  }),
  z.strictObject({
    channel: z.literal('PUSH'),
    recipient: z
      .string()
      .trim()
      .min(LIMITS.PUSH.recipient.min, `Device token must be at least ${LIMITS.PUSH.recipient.min} characters`)
      .max(LIMITS.PUSH.recipient.max, `Device token must be ${LIMITS.PUSH.recipient.max} characters or fewer`)
      .regex(DEVICE_TOKEN, 'Device token may only contain letters, digits, and : . _ -'),
    subject: subject(LIMITS.PUSH.subject),
    message: message(LIMITS.PUSH.message),
  }),
]);

// ---------------------------------------------------------------------------
// Query / path parameters
// ---------------------------------------------------------------------------

export const notificationIdSchema = z.uuid('id must be a UUID');

export const listNotificationsQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(LIST_LIMIT.min).max(LIST_LIMIT.max).default(LIST_LIMIT.default),
  /** Opaque; produced by the previous page's `nextCursor`. Decoded and validated by the repository. */
  cursor: z.string().min(1).optional(),
});

// ---------------------------------------------------------------------------
// Output: the stored request as returned by every endpoint
// ---------------------------------------------------------------------------

export const channelSchema = z.enum(CHANNELS);
export const statusSchema = z.enum(STATUSES);

export const notificationSchema = z.object({
  id: z.uuid(),
  channel: channelSchema,
  recipient: z.string(),
  /** Absent for SMS. */
  subject: z.string().optional(),
  message: z.string(),
  status: statusSchema,
  /** Delivery attempts made so far; incremented when a worker claims the request. */
  attempts: z.number().int().min(0),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  /** Set once the request reaches SENT or FAILED. */
  completedAt: z.iso.datetime().optional(),
  /** Set by the provider on SENT. */
  providerMessageId: z.string().optional(),
  /** Why the last attempt failed; present on retries and on FAILED. */
  lastError: z.string().optional(),
});

export const listNotificationsResponseSchema = z.object({
  data: z.array(notificationSchema),
  nextCursor: z.string().nullable(),
});

export const fieldErrorSchema = z.object({ path: z.string(), message: z.string() });

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(API_ERROR_CODES),
    message: z.string(),
    details: z.array(fieldErrorSchema).optional(),
    requestId: z.string(),
  }),
});
