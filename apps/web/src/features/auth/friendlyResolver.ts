import { typeboxResolver } from '@hookform/resolvers/typebox';
import type { FieldValues, Resolver } from 'react-hook-form';

// Exactly what typeboxResolver accepts (a TObject / compiled check), so callers
// can pass the shared schemas without a cast.
type TypeboxSchema = Parameters<typeof typeboxResolver>[0];

/**
 * The raw TypeBox/ajv messages ("Expected string to match '^[^@\\s]+…'") are
 * accurate but unreadable. This maps them to plain copy per field. Server-side
 * validation still returns the RFC 9457 `errors[]` as a fallback, but the client
 * validates first, so this is what users normally see.
 */
function friendlyMessage(field: string, value: unknown): string | null {
  const empty = value === undefined || value === null || value === '';
  switch (field) {
    case 'email':
      return empty ? 'Enter your email address.' : 'Enter a valid email address.';
    case 'displayName':
      return 'Enter a display name.';
    case 'password':
    case 'newPassword':
      return 'Use at least 10 characters.';
    case 'currentPassword':
      return 'Enter your current password.';
    default:
      return null;
  }
}

/** A typeboxResolver whose field messages are rewritten to friendly copy. */
export function friendlyResolver<T extends FieldValues>(schema: TypeboxSchema): Resolver<T> {
  const base = typeboxResolver(schema) as Resolver<T>;
  return async (values, context, options) => {
    const result = await base(values, context, options);
    for (const [field, error] of Object.entries(result.errors)) {
      const friendly = friendlyMessage(field, (values as Record<string, unknown>)[field]);
      if (friendly && error && typeof error === 'object') {
        (error as { message?: string }).message = friendly;
      }
    }
    return result;
  };
}
