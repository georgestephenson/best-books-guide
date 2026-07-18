import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { typeboxResolver } from '@hookform/resolvers/typebox';
import { Link, useSearchParams } from 'react-router';
import { Type, type Static } from '@sinclair/typebox';
import { resetPasswordRequest } from './api.js';
import { AuthCard, Field, FormError, SubmitButton } from './components.js';

// The token comes from the URL, not the form — the form only collects the password.
const NewPasswordForm = Type.Object(
  { newPassword: Type.String({ minLength: 10, maxLength: 128 }) },
  { additionalProperties: false },
);
type NewPasswordForm = Static<typeof NewPasswordForm>;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordForm>({ resolver: typeboxResolver(NewPasswordForm) });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await resetPasswordRequest({ token, newPassword: values.newPassword });
      setDone(true);
    } catch (err) {
      setSubmitError(err);
    }
  });

  if (!token) {
    return (
      <AuthCard title="Invalid link">
        <p className="text-sm text-slate-600">This reset link is missing its token.</p>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Password updated">
        <p className="text-sm text-slate-600">Your password has been reset.</p>
        <p className="text-sm text-slate-600">
          <Link className="underline" to="/login">
            Sign in
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password">
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Field
          id="newPassword"
          label="New password"
          type="password"
          autoComplete="new-password"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <FormError error={submitError} />
        <SubmitButton disabled={isSubmitting}>Reset password</SubmitButton>
      </form>
    </AuthCard>
  );
}
