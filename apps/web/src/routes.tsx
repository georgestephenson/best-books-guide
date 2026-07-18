import { createBrowserRouter } from 'react-router';
import { App } from './App.js';
import { SubjectPage } from './features/catalogue/SubjectPage.js';
import { ListPage } from './features/catalogue/ListPage.js';
import { BookPage } from './features/catalogue/BookPage.js';
import { SeriesPage } from './features/catalogue/SeriesPage.js';
import { CataloguePage } from './features/admin/CataloguePage.js';
import { ImportPage } from './features/admin/ImportPage.js';
import { BookFormPage } from './features/admin/BookFormPage.js';
import { SubjectsPage } from './features/admin/SubjectsPage.js';
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
  { path: '/subjects/:slug', element: <SubjectPage /> },
  { path: '/lists/:slug', element: <ListPage /> },
  { path: '/books/:slug', element: <BookPage /> },
  { path: '/series/:slug', element: <SeriesPage /> },
  { path: '/admin', element: <CataloguePage /> },
  { path: '/admin/import', element: <ImportPage /> },
  { path: '/admin/books/new', element: <BookFormPage /> },
  { path: '/admin/books/:id', element: <BookFormPage /> },
  { path: '/admin/subjects', element: <SubjectsPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/verify-email', element: <VerifyEmailPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
];

export const router = createBrowserRouter(routes);
