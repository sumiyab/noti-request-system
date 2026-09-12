'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError, FieldGroup } from '@/components/ui/field';
import { useCreateNotification } from '@/hooks/useCreateNotification';
import { createNotificationSchema, type CreateNotificationInput } from '@/schemas';
import { ChannelField } from './ChannelField';
import { MessageFields } from './MessageFields';
import { RecipientField } from './RecipientField';
import type { NotificationFormValues } from './types';

const DEFAULTS: NotificationFormValues = { channel: 'EMAIL', recipient: '', subject: '', message: '' };

const FORM_FIELDS = new Set<keyof NotificationFormValues>(['channel', 'recipient', 'subject', 'message']);

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
  const channel = useWatch({ control: form.control, name: 'channel' });
  const pending = create.isPending;

  const onSubmit = form.handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: () => {
        form.reset({ ...DEFAULTS, channel: values.channel });
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
        <CardDescription>Choose a channel and fill in the details.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void onSubmit(event)} noValidate aria-busy={pending}>
          <FieldGroup>
            <ChannelField {...fieldProps} disabled={pending} />
            <RecipientField {...fieldProps} channel={channel} disabled={pending} />
            <MessageFields {...fieldProps} channel={channel} disabled={pending} />
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
