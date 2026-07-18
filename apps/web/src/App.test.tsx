import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen } from '@testing-library/react';
import { API_BASE_PATH, type SubjectDetail } from '@bestbooks/shared';
import { App } from './App.js';
import { renderApp } from './test/render.js';
import { server } from './test/server.js';

const subjects: SubjectDetail[] = [
  {
    slug: 'fiction',
    name: 'Fiction',
    description: 'The novels that repay rereading.',
    lists: [
      {
        slug: 'best-fiction',
        title: 'The Essential Novels',
        intro: 'A short shelf.',
        itemCount: 12,
      },
    ],
  },
];

describe('App (catalogue home)', () => {
  it('renders subjects and their lists with a sign-in link', async () => {
    server.use(http.get(`${API_BASE_PATH}/subjects`, () => HttpResponse.json(subjects)));
    renderApp(<App />);
    expect(
      await screen.findByRole('heading', { name: /what should you read next/i }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Fiction' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /the essential novels/i })).toHaveAttribute(
      'href',
      '/lists/best-fiction',
    );
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows an empty state before any list is published', async () => {
    server.use(http.get(`${API_BASE_PATH}/subjects`, () => HttpResponse.json([])));
    renderApp(<App />);
    expect(await screen.findByText(/first curated lists are being written/i)).toBeInTheDocument();
  });

  it('shows an error when the catalogue fails to load', async () => {
    server.use(
      http.get(`${API_BASE_PATH}/subjects`, () => new HttpResponse(null, { status: 500 })),
    );
    renderApp(<App />);
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
  });
});
