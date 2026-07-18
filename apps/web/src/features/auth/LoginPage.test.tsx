import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { API_BASE_PATH } from '@bestbooks/shared';
import { LoginPage } from './LoginPage.js';
import { renderApp } from '../../test/render.js';
import { server } from '../../test/server.js';

function renderLogin() {
  return renderApp(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<h1>Home</h1>} />
    </Routes>,
    { route: '/login' },
  );
}

describe('LoginPage', () => {
  it('shows friendly messages for empty fields', async () => {
    renderLogin();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/enter your email address/i)).toBeInTheDocument();
    expect(screen.getByText(/use at least 10 characters/i)).toBeInTheDocument();
  });

  it('validates the email format before submitting', async () => {
    renderLogin();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/password/i), 'correcthorse');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
  });

  it('signs in and navigates home on success', async () => {
    server.use(
      http.post(`${API_BASE_PATH}/auth/login`, () =>
        HttpResponse.json({
          accessToken: 'tok',
          expiresIn: 900,
          user: {
            id: 'u1',
            email: 'a@b.co',
            displayName: 'A',
            role: 'member',
            emailVerifiedAt: null,
          },
        }),
      ),
    );
    renderLogin();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'a@b.co');
    await user.type(screen.getByLabelText(/password/i), 'correcthorse');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('heading', { name: /home/i })).toBeInTheDocument();
  });

  it('surfaces a 401 as an error message', async () => {
    server.use(
      http.post(`${API_BASE_PATH}/auth/login`, () =>
        HttpResponse.json(
          {
            type: 'x/unauthenticated',
            title: 'Auth',
            status: 401,
            detail: 'invalid email or password',
          },
          { status: 401 },
        ),
      ),
    );
    renderLogin();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'a@b.co');
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid email or password/i);
  });
});
