'use client';

import { Controller } from 'react-hook-form';
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CHANNEL_LABELS } from '@/lib/format';
import { CHANNELS } from '@/schemas';
import type { FieldProps } from './types';

export const ChannelField = ({
  control,
  errors,
  disabled,
}: Pick<FieldProps, 'control' | 'errors' | 'disabled'>) => (
  <Controller
    control={control}
    name="channel"
    render={({ field }) => (
      <FieldSet data-invalid={!!errors.channel}>
        <FieldLegend variant="label">Channel</FieldLegend>
        <RadioGroup
          value={field.value}
          onValueChange={field.onChange}
          onBlur={field.onBlur}
          disabled={disabled}
          aria-invalid={!!errors.channel}
          className="flex gap-4"
        >
          {CHANNELS.map((channel) => (
            <Field key={channel} orientation="horizontal" className="w-auto">
              <RadioGroupItem value={channel} id={`channel-${channel}`} />
              <FieldLabel htmlFor={`channel-${channel}`} className="font-normal">
                {CHANNEL_LABELS[channel]}
              </FieldLabel>
            </Field>
          ))}
        </RadioGroup>
        <FieldError errors={[errors.channel]} />
      </FieldSet>
    )}
  />
);
