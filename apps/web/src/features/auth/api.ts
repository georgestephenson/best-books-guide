import {
  API_BASE_PATH,
  type AuthResponse,
  type ForgotPasswordBody,
  type LoginBody,
  type PublicUser,
  type RegisterBody,
  type ResetPasswordBody,
} from '@bestbooks/shared';
import { apiJson } from '../../lib/api.js';

const AUTH = `${API_BASE_PATH}/auth`;

const post = (body?: unknown): RequestInit => ({
  method: 'POST',
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const registerRequest = (body: RegisterBody): Promise<{ message: string }> =>
  apiJson(`${AUTH}/register`, post(body));

export const loginRequest = (body: LoginBody): Promise<AuthResponse> =>
  apiJson(`${AUTH}/login`, post(body));

export const logoutRequest = (): Promise<void> => apiJson(`${AUTH}/logout`, post());

export const verifyEmailRequest = (token: string): Promise<{ verified: boolean }> =>
  apiJson(`${AUTH}/verify-email`, post({ token }));

export const forgotPasswordRequest = (body: ForgotPasswordBody): Promise<{ message: string }> =>
  apiJson(`${AUTH}/forgot-password`, post(body));

export const resetPasswordRequest = (body: ResetPasswordBody): Promise<{ message: string }> =>
  apiJson(`${AUTH}/reset-password`, post(body));

export const meRequest = (): Promise<PublicUser> => apiJson(`${API_BASE_PATH}/me`);
