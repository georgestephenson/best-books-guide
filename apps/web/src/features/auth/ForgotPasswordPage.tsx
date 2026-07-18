import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { friendlyResolver } from './friendlyResolver.js';
import { Link } from 'react-router';
import { ForgotPasswordBody } from '@bestbooks/shared';
import { forgotPasswordRequest } from './api.js';
import { AuthCard, Field, FormError, SubmitButton } from './components.js';

export function ForgotPasswordPage() {
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordBody>({ resolver: friendlyResolver(ForgotPasswordBody) });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await forgotPasswordRequest(values);
      setDone(true);
    } catch (err) {
      setSubmitError(err);
    }
  });

  if (done) {
    return (
      <AuthCard title="Check your email">
        <p className="text-sm text-slate-600">
          If that account exists, a password-reset link is on its way.
        </p>
        <p className="text-sm text-slate-600">
          <Link className="underline" to="/login">
            Back to sign in
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset your password">
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <FormError error={submitError} />
        <SubmitButton disabled={isSubmitting}>Send reset link</SubmitButton>
      </form>
    </AuthCard>
  );
}
