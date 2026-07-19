import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import {
  API_BASE_PATH,
  type BookDetail,
  type ListDetail,
  type SeriesDetail,
  type SubjectDetail,
} from '@bestbooks/shared';
import { renderApp } from '../../test/render.js';
import { server } from '../../test/server.js';
import { SubjectPage } from './SubjectPage.js';
import { ListPage } from './ListPage.js';
import { BookPage } from './BookPage.js';
import { SeriesPage } from './SeriesPage.js';
import { NotFoundPage } from './NotFoundPage.js';

const V1 = API_BASE_PATH;

const listDetail: ListDetail = {
  slug: 'best-fiction',
  title: 'The Essential Novels',
  intro: 'A short shelf, not a syllabus.',
  subject: { slug: 'fiction', name: 'Fiction' },
  parent: null,
  items: [
    {
      type: 'book',
      rank: 1,
      blurb: 'The white whale.',
      book: {
        slug: 'moby-dick',
        title: 'Moby-Dick',
        subtitle: null,
        authors: [{ slug: 'herman-melville', name: 'Herman Melville' }],
        coverUrl: null,
        firstPublishedYear: 1851,
        ratingAvg: 4.6,
        ratingCount: 128,
      },
    },
    {
      type: 'series',
      rank: 2,
      blurb: 'Deduction, serialised.',
      series: {
        slug: 'sherlock-holmes',
        title: 'Sherlock Holmes',
        description: null,
        bookCount: 4,
      },
    },
    {
      type: 'book',
      rank: 3,
      blurb: null,
      book: {
        slug: 'frankenstein',
        title: 'Frankenstein',
        subtitle: null,
        authors: [{ slug: 'mary-shelley', name: 'Mary Shelley' }],
        coverUrl: '/covers/frankenstein.jpg',
        firstPublishedYear: 1818,
        ratingAvg: 0,
        ratingCount: 0,
      },
    },
  ],
  sublists: [{ slug: 'gothic', title: 'Gothic & the Uncanny', intro: null, itemCount: 5 }],
};

const bookDetail: BookDetail = {
  id: 'b1',
  slug: 'moby-dick',
  title: 'Moby-Dick',
  subtitle: 'or, The Whale',
  authors: [{ slug: 'herman-melville', name: 'Herman Melville' }],
  description: 'Ishmael signs aboard the Pequod.\n\nNeglected in its time.',
  coverUrl: null,
  firstPublishedYear: 1851,
  pageCount: 635,
  language: 'en',
  subjects: [{ slug: 'fiction', name: 'Fiction' }],
  series: null,
  listAppearances: [{ listSlug: 'best-fiction', listTitle: 'The Essential Novels', rank: 1 }],
  related: [
    { slug: 'billy-budd', title: 'Billy Budd', coverUrl: null, reason: 'same-author' },
    { slug: 'frankenstein', title: 'Frankenstein', coverUrl: null, reason: 'co-listed' },
  ],
  ratingAvg: 4.6,
  ratingCount: 128,
};

const seriesDetail: SeriesDetail = {
  slug: 'sherlock-holmes',
  title: 'Sherlock Holmes',
  description: 'The canon.',
  books: [
    {
      slug: 'a-study-in-scarlet',
      title: 'A Study in Scarlet',
      subtitle: null,
      authors: [{ slug: 'arthur-conan-doyle', name: 'Arthur Conan Doyle' }],
      coverUrl: null,
      firstPublishedYear: 1887,
      ratingAvg: 0,
      ratingCount: 0,
      seriesPosition: 1,
    },
    {
      slug: 'the-sign-of-the-four',
      title: 'The Sign of the Four',
      subtitle: null,
      authors: [{ slug: 'arthur-conan-doyle', name: 'Arthur Conan Doyle' }],
      coverUrl: null,
      firstPublishedYear: 1890,
      ratingAvg: 0,
      ratingCount: 0,
      seriesPosition: 2,
    },
  ],
};

const subjectDetail: SubjectDetail = {
  slug: 'fiction',
  name: 'Fiction',
  description: 'The novels that repay rereading.',
  lists: [
    { slug: 'best-fiction', title: 'The Essential Novels', intro: 'A short shelf.', itemCount: 12 },
  ],
};

function renderRoute(path: string, element: React.ReactNode, url: string) {
  return renderApp(
    <Routes>
      <Route path={path} element={element} />
    </Routes>,
    { route: url },
  );
}

describe('ListPage', () => {
  it('renders ranked book and series items, blurbs, covers, and sublists', async () => {
    server.use(http.get(`${V1}/lists/best-fiction`, () => HttpResponse.json(listDetail)));
    renderRoute('/lists/:slug', <ListPage />, '/lists/best-fiction');

    expect(
      await screen.findByRole('heading', { name: 'The Essential Novels', level: 1 }),
    ).toBeInTheDocument();
    // Book item, series item (with tag + book count), and a coverless/rated book.
    expect(screen.getByRole('link', { name: 'Moby-Dick' })).toHaveAttribute(
      'href',
      '/books/moby-dick',
    );
    expect(screen.getByText('The white whale.')).toBeInTheDocument();
    expect(screen.getByText(/Series · 4 books/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sherlock Holmes' })).toHaveAttribute(
      'href',
      '/series/sherlock-holmes',
    );
    // Frankenstein has a real cover → an <img>.
    expect(screen.getByRole('img', { name: /cover of frankenstein/i })).toHaveAttribute(
      'src',
      '/covers/frankenstein.jpg',
    );
    // Sublist map.
    expect(screen.getByRole('link', { name: /gothic/i })).toHaveAttribute('href', '/lists/gothic');
    // React 19 hoists the page <title>.
    expect(document.title).toContain('The Essential Novels');
  });

  it('shows a not-found message for an unpublished or missing list', async () => {
    server.use(http.get(`${V1}/lists/ghost`, () => new HttpResponse(null, { status: 404 })));
    renderRoute('/lists/:slug', <ListPage />, '/lists/ghost');
    expect(await screen.findByText(/couldn't find that list/i)).toBeInTheDocument();
  });
});

describe('BookPage', () => {
  it('renders metadata, appearances, and the related strip', async () => {
    server.use(http.get(`${V1}/books/moby-dick`, () => HttpResponse.json(bookDetail)));
    renderRoute('/books/:slug', <BookPage />, '/books/moby-dick');

    expect(await screen.findByRole('heading', { name: 'Moby-Dick', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Herman Melville')).toBeInTheDocument();
    expect(screen.getByText('4.6')).toBeInTheDocument();
    // Appears-on links to the list.
    const appears = screen.getByRole('link', { name: 'The Essential Novels' });
    expect(appears).toHaveAttribute('href', '/lists/best-fiction');
    // Related strip with reason labels.
    expect(screen.getByRole('link', { name: /billy budd/i })).toHaveAttribute(
      'href',
      '/books/billy-budd',
    );
    expect(screen.getByText('Same author')).toBeInTheDocument();
    expect(screen.getByText('Co-listed')).toBeInTheDocument();
  });
});

describe('SeriesPage', () => {
  it('lists the series books in reading order', async () => {
    server.use(http.get(`${V1}/series/sherlock-holmes`, () => HttpResponse.json(seriesDetail)));
    renderRoute('/series/:slug', <SeriesPage />, '/series/sherlock-holmes');

    expect(
      await screen.findByRole('heading', { name: 'Sherlock Holmes', level: 1 }),
    ).toBeInTheDocument();
    const list = screen.getByRole('list');
    const items = within(list).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('A Study in Scarlet');
    expect(items[1]).toHaveTextContent('The Sign of the Four');
  });
});

describe('NotFoundPage', () => {
  it('renders a calm 404 with a way back', async () => {
    renderApp(<NotFoundPage />);
    expect(await screen.findByRole('heading', { name: /doesn.t exist/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to browse/i })).toHaveAttribute('href', '/');
  });
});

describe('SubjectPage', () => {
  it('renders the subject and its lists', async () => {
    server.use(http.get(`${V1}/subjects/fiction`, () => HttpResponse.json(subjectDetail)));
    renderRoute('/subjects/:slug', <SubjectPage />, '/subjects/fiction');
    expect(await screen.findByRole('heading', { name: 'Fiction', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /the essential novels/i })).toHaveAttribute(
      'href',
      '/lists/best-fiction',
    );
  });

  it('greets a signed-in reader in the header', async () => {
    server.use(
      http.post(`${V1}/auth/refresh`, () =>
        HttpResponse.json({
          accessToken: 'tok',
          expiresIn: 900,
          user: {
            id: 'u1',
            email: 'reader@example.com',
            displayName: 'Ada',
            role: 'member',
            emailVerifiedAt: '2026-07-18T00:00:00.000Z',
          },
        }),
      ),
      http.get(`${V1}/subjects/fiction`, () => HttpResponse.json(subjectDetail)),
    );
    renderRoute('/subjects/:slug', <SubjectPage />, '/subjects/fiction');
    // The name is a disclosure button; Sign out lives in the menu it opens.
    const menu = await screen.findByRole('button', { name: /ada/i });
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
    await userEvent.click(menu);
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('tucks the Admin link into an admin’s account menu, not the top nav', async () => {
    server.use(
      http.post(`${V1}/auth/refresh`, () =>
        HttpResponse.json({
          accessToken: 'tok',
          expiresIn: 900,
          user: {
            id: 'u2',
            email: 'ed@example.com',
            displayName: 'Ed',
            role: 'admin',
            emailVerifiedAt: '2026-07-18T00:00:00.000Z',
          },
        }),
      ),
      http.get(`${V1}/subjects/fiction`, () => HttpResponse.json(subjectDetail)),
    );
    renderRoute('/subjects/:slug', <SubjectPage />, '/subjects/fiction');
    // Admin isn't a top-nav link anymore — it only appears inside the open menu.
    expect(await screen.findByRole('button', { name: /ed/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /ed/i }));
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
  });
});
