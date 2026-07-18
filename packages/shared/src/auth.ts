import { Type, type Static } from '@sinclair/typebox';

/**
 * Auth request/response contracts — one source of truth (docs/04). The API mounts
 * these as Fastify TypeBox schemas; the web client derives its types and its
 * react-hook-form resolver from the same objects, so the two can't drift.
 *
 * All bodies set `additionalProperties: false` (docs/05 §Input safety). Email uses
 * a pattern rather than `format: 'email'` so validation is actually enforced
 * without pulling ajv-formats into Fastify.
 */

const Email = Type.String({
  pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$',
  maxLength: 254,
  description: 'Email address',
});

// docs/05: length 10–128, no composition rules.
const Password = Type.String({ minLength: 10, maxLength: 128 });

const DisplayName = Type.String({ minLength: 1, maxLength: 50 });

const OpaqueToken = Type.String({ minLength: 1, maxLength: 512 });

const bodyOptions = { additionalProperties: false } as const;

export const RegisterBody = Type.Object(
  { email: Email, password: Password, displayName: DisplayName },
  bodyOptions,
);
export type RegisterBody = Static<typeof RegisterBody>;

export const LoginBody = Type.Object({ email: Email, password: Password }, bodyOptions);
export type LoginBody = Static<typeof LoginBody>;

export const VerifyEmailBody = Type.Object({ token: OpaqueToken }, bodyOptions);
export type VerifyEmailBody = Static<typeof VerifyEmailBody>;

export const ForgotPasswordBody = Type.Object({ email: Email }, bodyOptions);
export type ForgotPasswordBody = Static<typeof ForgotPasswordBody>;

export const ResetPasswordBody = Type.Object(
  { token: OpaqueToken, newPassword: Password },
  bodyOptions,
);
export type ResetPasswordBody = Static<typeof ResetPasswordBody>;

export const ChangePasswordBody = Type.Object(
  { currentPassword: Password, newPassword: Password },
  bodyOptions,
);
export type ChangePasswordBody = Static<typeof ChangePasswordBody>;

export const UpdateMeBody = Type.Object({ displayName: DisplayName }, bodyOptions);
export type UpdateMeBody = Static<typeof UpdateMeBody>;

/** The user shape returned to the client — never includes the password hash. */
export const PublicUser = Type.Object({
  id: Type.String(),
  email: Type.String(),
  displayName: Type.String(),
  role: Type.Union([Type.Literal('member'), Type.Literal('admin')]),
  emailVerifiedAt: Type.Union([Type.String(), Type.Null()]),
});
export type PublicUser = Static<typeof PublicUser>;

/** Login/refresh response: access token (memory only) + the profile. */
export const AuthResponse = Type.Object({
  accessToken: Type.String(),
  /** Access-token lifetime in seconds — drives the SPA's silent-refresh timer. */
  expiresIn: Type.Integer(),
  user: PublicUser,
});
export type AuthResponse = Static<typeof AuthResponse>;
