'use client';

import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { USER_ID } from '@/schemas';
import type { FieldProps } from './types';

/**
 * Who is sending. Typed in here because the demo has no sign-in; with an authorizer in front of the API this
 * field disappears and the backend reads the id from the token instead.
 */
export const UserIdField = ({
  register,
  errors,
  disabled,
}: Pick<FieldProps, 'register' | 'errors' | 'disabled'>) => {
  const invalid = !!errors.userId;
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor="userId">User ID</FieldLabel>
      <Input
        id="userId"
        type="text"
        placeholder="user-42"
        maxLength={USER_ID.max}
        autoComplete="username"
        disabled={disabled}
        aria-invalid={invalid}
        {...register('userId')}
      />
      <FieldDescription>
        The user this request is sent on behalf of. Kept between submissions.
      </FieldDescription>
      <FieldError errors={[errors.userId]} />
    </Field>
  );
};
