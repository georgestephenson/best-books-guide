import { createBrowserRouter } from 'react-router';
import { App } from './App.js';
import { LoginPage } from './features/auth/LoginPage.js';
import { RegisterPage } from './features/auth/RegisterPage.js';
import { VerifyEmailPage } from './features/auth/VerifyEmailPage.js';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage.js';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage.js';

/**
 * React Router 7 in data mode ([ADR-0008]) — the route tree here is what the
 * post-MVP SSR upgrade (framework mode) reuses unchanged. Deep links work because
 * Nginx serves the SPA fallback for unknown paths.
 */
export const routes = [
  { path: '/', element: <App /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/verify-email', element: <VerifyEmailPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
];

export const router = createBrowserRouter(routes);
