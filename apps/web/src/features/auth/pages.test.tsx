import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { API_BASE_PATH } from '@bestbooks/shared';
import { RegisterPage } from './RegisterPage.js';
import { ForgotPasswordPage } from './ForgotPasswordPage.js';
import { ResetPasswordPage } from './ResetPasswordPage.js';
import { VerifyEmailPage } from './VerifyEmailPage.js';
import { renderApp } from '../../test/render.js';
import { server } from '../../test/server.js';

describe('RegisterPage', () => {
  it('confirms after a successful submit', async () => {
    server.use(
      http.post(`${API_BASE_PATH}/auth/register`, () =>
        HttpResponse.json({ message: 'ok' }, { status: 201 }),
      ),
    );
    renderApp(<RegisterPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/display name/i), 'Reader');
    await user.type(screen.getByLabelText(/email/i), 'reader@example.com');
    await user.type(screen.getByLabelText(/password/i), 'correcthorsebattery');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });
});

describe('ForgotPasswordPage', () => {
  it('shows the uniform confirmation', async () => {
    server.use(
      http.post(`${API_BASE_PATH}/auth/forgot-password`, () =>
        HttpResponse.json({ message: 'ok' }, { status: 202 }),
      ),
    );
    renderApp(<ForgotPasswordPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'reader@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByText(/on its way/i)).toBeInTheDocument();
  });
});

describe('ResetPasswordPage', () => {
  it('rejects a link with no token', () => {
    renderApp(<ResetPasswordPage />, { route: '/reset-password' });
    expect(screen.getByText(/missing its token/i)).toBeInTheDocument();
  });

  it('confirms after resetting with a token', async () => {
    server.use(
      http.post(`${API_BASE_PATH}/auth/reset-password`, () => HttpResponse.json({ message: 'ok' })),
    );
    renderApp(<ResetPasswordPage />, { route: '/reset-password?token=abc' });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/new password/i), 'a-fresh-secret');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    expect(await screen.findByText(/password updated/i)).toBeInTheDocument();
  });
});

describe('VerifyEmailPage', () => {
  it('confirms on a valid token', async () => {
    server.use(
      http.post(`${API_BASE_PATH}/auth/verify-email`, () => HttpResponse.json({ verified: true })),
    );
    renderApp(<VerifyEmailPage />, { route: '/verify-email?token=abc' });
    expect(await screen.findByText(/email confirmed/i)).toBeInTheDocument();
  });

  it('reports an invalid or expired token', async () => {
    server.use(
      http.post(`${API_BASE_PATH}/auth/verify-email`, () =>
        HttpResponse.json(
          {
            type: 'x/validation',
            title: 'v',
            status: 422,
            detail: 'This verification link is invalid or has expired.',
          },
          { status: 422 },
        ),
      ),
    );
    renderApp(<VerifyEmailPage />, { route: '/verify-email?token=bad' });
    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid or has expired/i);
  });

  it('shows a missing-token message with no token', () => {
    renderApp(<VerifyEmailPage />, { route: '/verify-email' });
    expect(screen.getByText(/missing its token/i)).toBeInTheDocument();
  });
});
