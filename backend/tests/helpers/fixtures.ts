import type { CreateNotificationInput, Notification } from '@noti/shared';

export const ID = '3f0c9a52-8f6e-4d63-9a51-3c1e0f2b7d10';
export const NOW = new Date('2026-09-12T04:00:00.000Z');
export const USER_ID = 'user-42';

export const emailInput: CreateNotificationInput = {
  userId: USER_ID,
  channel: 'EMAIL',
  recipient: 'jane@example.com',
  subject: 'Welcome!',
  message: 'Thanks for signing up.',
};

export const smsInput: CreateNotificationInput = {
  userId: USER_ID,
  channel: 'SMS',
  recipient: '+97699112233',
  message: 'Code 4821',
};

export const stored = (overrides: Partial<Notification> = {}): Notification => ({
  id: ID,
  ...emailInput,
  status: 'QUEUED',
  attempts: 0,
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
  ...overrides,
});
