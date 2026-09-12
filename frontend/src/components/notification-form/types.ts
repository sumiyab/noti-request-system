import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';
import type { Channel } from '@/schemas';

/**
 * Flat shape the form edits. The API type is a discriminated union (SMS has no subject);
 * the resolver validates against that union, and `shouldUnregister` drops `subject` when it is unmounted.
 */
export type NotificationFormValues = {
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
