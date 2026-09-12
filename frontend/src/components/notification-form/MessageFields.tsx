'use client';

import { useWatch } from 'react-hook-form';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LIMITS } from '@/schemas';
import type { FieldProps } from './types';

const SUBJECT_LABEL = { EMAIL: 'Subject', PUSH: 'Title' } as const;

const Counter = ({ value, max }: { value: string; max: number }) => (
  <span className="tabular-nums" aria-live="polite">
    {value.length} / {max}
  </span>
);

/** Subject (EMAIL/PUSH only) and message. When the subject is unmounted, RHF drops its value (`shouldUnregister`). */
export const MessageFields = ({ control, register, errors, channel, disabled }: FieldProps) => {
  const subject = useWatch({ control, name: 'subject' }) ?? '';
  const message = useWatch({ control, name: 'message' }) ?? '';
  const messageMax = LIMITS[channel].message;

  return (
    <>
      {channel !== 'SMS' && (
        <Field data-invalid={!!errors.subject}>
          <FieldLabel htmlFor="subject">{SUBJECT_LABEL[channel]}</FieldLabel>
          <Input
            id="subject"
            maxLength={LIMITS[channel].subject}
            disabled={disabled}
            aria-invalid={!!errors.subject}
            {...register('subject')}
          />
          <FieldDescription className="flex justify-between">
            <span>{channel === 'PUSH' ? 'Shown as the notification title.' : 'Shown in the inbox.'}</span>
            <Counter value={subject} max={LIMITS[channel].subject} />
          </FieldDescription>
          <FieldError errors={[errors.subject]} />
        </Field>
      )}

      <Field data-invalid={!!errors.message}>
        <FieldLabel htmlFor="message">Message</FieldLabel>
        <Textarea
          id="message"
          rows={5}
          maxLength={messageMax}
          disabled={disabled}
          aria-invalid={!!errors.message}
          {...register('message')}
        />
        <FieldDescription className="flex justify-end">
          <Counter value={message} max={messageMax} />
        </FieldDescription>
        <FieldError errors={[errors.message]} />
      </Field>
    </>
  );
};
