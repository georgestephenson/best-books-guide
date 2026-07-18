import type { InputHTMLAttributes, ReactNode } from 'react';
import { ApiError } from '../../lib/api.js';

/** A titled card wrapper for the auth pages. */
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      {children}
    </main>
  );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

/** A labelled input that surfaces its field-level error. */
export function Field({ label, error, id, ...props }: FieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm" htmlFor={id}>
      <span className="font-medium text-slate-700">{label}</span>
      <input
        id={id}
        className="rounded border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
        {...props}
      />
      {error ? <span className="text-red-600">{error}</span> : null}
    </label>
  );
}

export function SubmitButton({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="rounded bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/** Turns a thrown error into human copy — with a friendlier line for 429s. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      const wait = error.retryAfterSeconds;
      return wait
        ? `Too many attempts. Try again in about ${Math.ceil(wait / 60)} minute(s).`
        : 'Too many attempts. Please wait a moment and try again.';
    }
    return error.problem?.detail ?? error.message;
  }
  return 'Something went wrong. Please try again.';
}

export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm font-medium text-red-600">
      {errorMessage(error)}
    </p>
  );
}
