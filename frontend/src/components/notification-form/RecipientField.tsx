'use client';

import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { LIMITS, type Channel } from '@/schemas';
import type { FieldProps } from './types';

const RECIPIENT: Record<
  Channel,
  { label: string; placeholder: string; hint: string; type: 'email' | 'tel' | 'text'; maxLength: number }
> = {
  EMAIL: {
    label: 'Email address',
    placeholder: 'jane@example.com',
    hint: 'Where the email will be sent.',
    type: 'email',
    maxLength: LIMITS.EMAIL.recipient,
  },
  SMS: {
    label: 'Phone number',
    placeholder: '+97699112233',
    hint: 'E.164 format: country code first, digits only.',
    type: 'tel',
    maxLength: 16,
  },
  PUSH: {
    label: 'Device token',
    placeholder: 'fcm-token:abc123',
    hint: 'The token issued to the device by APNs or FCM.',
    type: 'text',
    maxLength: LIMITS.PUSH.recipient.max,
  },
};

export const RecipientField = ({
  register,
  errors,
  channel,
  disabled,
}: Pick<FieldProps, 'register' | 'errors' | 'channel' | 'disabled'>) => {
  const meta = RECIPIENT[channel];
  const invalid = !!errors.recipient;
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor="recipient">{meta.label}</FieldLabel>
      <Input
        id="recipient"
        type={meta.type}
        placeholder={meta.placeholder}
        maxLength={meta.maxLength}
        autoComplete="off"
        disabled={disabled}
        aria-invalid={invalid}
        {...register('recipient')}
      />
      <FieldDescription>{meta.hint}</FieldDescription>
      <FieldError errors={[errors.recipient]} />
    </Field>
  );
};
