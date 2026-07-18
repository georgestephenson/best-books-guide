import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { friendlyResolver } from './friendlyResolver.js';
import { Link } from 'react-router';
import { RegisterBody } from '@bestbooks/shared';
import { registerRequest } from './api.js';
import { AuthCard, Field, FormError, SubmitButton } from './components.js';

export function RegisterPage() {
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterBody>({ resolver: friendlyResolver(RegisterBody) });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await registerRequest(values);
      setDone(true);
    } catch (err) {
      setSubmitError(err);
    }
  });

  if (done) {
    return (
      <AuthCard title="Check your email">
        <p className="text-sm text-slate-600">
          If that email is available, we&rsquo;ve sent a confirmation link. Click it to finish
          setting up your account.
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
    <AuthCard title="Create your account">
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Field
          id="displayName"
          label="Display name"
          autoComplete="nickname"
          error={errors.displayName?.message}
          {...register('displayName')}
        />
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <FormError error={submitError} />
        <SubmitButton disabled={isSubmitting}>Create account</SubmitButton>
      </form>
      <p className="text-sm text-slate-600">
        Already have an account?{' '}
        <Link className="underline" to="/login">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
