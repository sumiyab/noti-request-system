import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';
import type { Channel } from '@/schemas';

/**
 * Flat shape the form edits. The API type is a discriminated union (SMS has no subject); the resolver
 * validates against that union. The field components are channel-aware so the form can offer other
 * channels later without changes below this file.
 */
export type NotificationFormValues = {
  userId: string;
  channel: Channel;
  recipient: string;
  subject?: string;
  message: string;
};

export type FieldProps = {
  control: Control<NotificationFormValues>;
  register: UseFormRegister<NotificationFormValues>;
  errors: FieldErrors<NotificationFormValues>;
  channel: Channel;
  disabled: boolean;
};
