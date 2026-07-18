import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { friendlyResolver } from './friendlyResolver.js';
import { Link, useNavigate } from 'react-router';
import { LoginBody } from '@bestbooks/shared';
import { useAuth } from './AuthContext.js';
import { AuthCard, Field, FormError, SubmitButton } from './components.js';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginBody>({ resolver: friendlyResolver(LoginBody) });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await login(values);
      await navigate('/');
    } catch (err) {
      setSubmitError(err);
    }
  });

  return (
    <AuthCard title="Sign in">
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
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
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <FormError error={submitError} />
        <SubmitButton disabled={isSubmitting}>Sign in</SubmitButton>
      </form>
      <p className="text-sm text-slate-600">
        <Link className="underline" to="/forgot-password">
          Forgot your password?
        </Link>{' '}
        ·{' '}
        <Link className="underline" to="/register">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}
