'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError, FieldGroup } from '@/components/ui/field';
import { useCreateNotification } from '@/hooks/useCreateNotification';
import { createNotificationSchema, type CreateNotificationInput } from '@/schemas';
import { MessageFields } from './MessageFields';
import { RecipientField } from './RecipientField';
import type { NotificationFormValues } from './types';
import { UserIdField } from './UserIdField';

/** The form submits email requests; the API and the list support SMS and PUSH as well. */
const CHANNEL = 'EMAIL';

const DEFAULTS: NotificationFormValues = {
  userId: '',
  channel: CHANNEL,
  recipient: '',
  subject: '',
  message: '',
};

const FORM_FIELDS = new Set<keyof NotificationFormValues>([
  'userId',
  'channel',
  'recipient',
  'subject',
  'message',
]);

const isFormField = (path: string): path is keyof NotificationFormValues =>
  FORM_FIELDS.has(path as keyof NotificationFormValues);

export const NotificationForm = () => {
  const form = useForm<NotificationFormValues, unknown, CreateNotificationInput>({
    // The shared schema is the resolver: the form validates with exactly the API's rules.
    resolver: zodResolver<NotificationFormValues, unknown, CreateNotificationInput>(createNotificationSchema),
    defaultValues: DEFAULTS,
    mode: 'onBlur',
    shouldUnregister: true,
  });
  const create = useCreateNotification();
  const pending = create.isPending;

  const onSubmit = form.handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: () => {
        // The same user usually sends several requests, so only the message-specific fields clear.
        form.reset({ ...DEFAULTS, userId: values.userId });
        toast.success('Request accepted', { description: 'It has been queued for delivery.' });
      },
      onError: (error) => {
        if (error.code !== 'VALIDATION_ERROR') return; // generic errors are toasted globally
        for (const { path, message } of error.details ?? []) {
          form.setError(isFormField(path) ? path : 'root.server', { type: 'server', message });
        }
      },
    }),
  );

  const fieldProps = { control: form.control, register: form.register, errors: form.formState.errors };

  return (
    <Card>
      <CardHeader>
        <CardTitle>New request</CardTitle>
        <CardDescription>Fill in who is sending, the recipient, subject, and message.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void onSubmit(event)} noValidate aria-busy={pending}>
          <FieldGroup>
            <input type="hidden" {...form.register('channel')} />
            <UserIdField {...fieldProps} disabled={pending} />
            <RecipientField {...fieldProps} channel={CHANNEL} disabled={pending} />
            <MessageFields {...fieldProps} channel={CHANNEL} disabled={pending} />
            <FieldError errors={[form.formState.errors.root?.server]} />
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? 'Submitting…' : 'Send notification'}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
};
