import { beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError } from '../../domain/errors.js';
import type { LanguageScreen, ScreenResult } from '../ports/language-screen.js';
import type { ReadingStatusRepository, ShelfEntry } from '../ports/reading-status-repository.js';
import type {
  AutoLanguageReport,
  PublicReviewRow,
  ReportResult,
  ReviewRepository,
  UpsertReviewInput,
  ViewerReviewRow,
} from '../ports/review-repository.js';
import {
  DeleteReview,
  GetBookReviews,
  GetViewerBook,
  ReportReview,
  UpsertReview,
} from './reviews.js';

const AT = new Date('2026-07-20T10:00:00Z');

function viewerRow(over: Partial<ViewerReviewRow> = {}): ViewerReviewRow {
  return {
    id: 'r1',
    rating: 4,
    body: 'Solid.',
    isHidden: false,
    hiddenReason: null,
    createdAt: AT,
    updatedAt: AT,
    ...over,
  };
}

/**
 * Records what the use-case asked of the repository so the tests can assert on the
 * write it composed — the language-screen verdict only shows up in that argument.
 */
class FakeReviewRepository implements ReviewRepository {
  bookIdBySlug: string | null = 'b1';
  viewer: ViewerReviewRow | null = viewerRow();
  publicRows: PublicReviewRow[] = [];
  deleteResult = true;
  reportResult: ReportResult = 'ok';

  upserts: { input: UpsertReviewInput; autoReport: AutoLanguageReport | null }[] = [];
  reports: { reviewId: string; reporterId: string; reason: string; note: string | null }[] = [];

  findBookIdBySlug(): Promise<string | null> {
    return Promise.resolve(this.bookIdBySlug);
  }
  upsertReview(
    input: UpsertReviewInput,
    autoReport: AutoLanguageReport | null,
  ): Promise<{ id: string }> {
    this.upserts.push({ input, autoReport });
    return Promise.resolve({ id: 'r1' });
  }
  deleteReview(): Promise<boolean> {
    return Promise.resolve(this.deleteResult);
  }
  listPublicByBook(): Promise<PublicReviewRow[]> {
    return Promise.resolve(this.publicRows);
  }
  getViewerReview(): Promise<ViewerReviewRow | null> {
    return Promise.resolve(this.viewer);
  }
  reportReview(
    reviewId: string,
    reporterId: string,
    reason: string,
    note: string | null,
  ): Promise<ReportResult> {
    this.reports.push({ reviewId, reporterId, reason, note });
    return Promise.resolve(this.reportResult);
  }
  listOpenReports(): never {
    throw new Error('not used');
  }
  hideReview(): never {
    throw new Error('not used');
  }
  unhideReview(): never {
    throw new Error('not used');
  }
  resolveReport(): never {
    throw new Error('not used');
  }
}

class FakeScreen implements LanguageScreen {
  result: ScreenResult = { severity: 'clean', matches: [] };
  screened: string[] = [];
  screen(text: string): ScreenResult {
    this.screened.push(text);
    return this.result;
  }
}

let reviews: FakeReviewRepository;
let screen: FakeScreen;
beforeEach(() => {
  reviews = new FakeReviewRepository();
  screen = new FakeScreen();
});

describe('UpsertReview', () => {
  it('404s when the slug resolves to no book', async () => {
    reviews.bookIdBySlug = null;
    await expect(
      new UpsertReview(reviews, screen).execute('u1', 'ghost', { rating: 4, body: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(reviews.upserts).toHaveLength(0);
  });

  it('publishes clean text with no report', async () => {
    await new UpsertReview(reviews, screen).execute('u1', 'sapiens', {
      rating: 5,
      body: 'Excellent.',
    });

    expect(reviews.upserts[0]?.autoReport).toBeNull();
    expect(reviews.upserts[0]?.input).toMatchObject({
      userId: 'u1',
      bookId: 'b1',
      rating: 5,
      body: 'Excellent.',
    });
  });

  it('trims the body and stores a whitespace-only body as null', async () => {
    await new UpsertReview(reviews, screen).execute('u1', 'sapiens', {
      rating: 3,
      body: '   \n  ',
    });

    expect(reviews.upserts[0]?.input.body).toBeNull();
    // a bare star rating never reaches the screen
    expect(screen.screened).toHaveLength(0);
  });

  it('treats an omitted body as null without screening', async () => {
    await new UpsertReview(reviews, screen).execute('u1', 'sapiens', { rating: 3 });

    expect(reviews.upserts[0]?.input.body).toBeNull();
    expect(screen.screened).toHaveLength(0);
  });

  it('auto-reports a mild hit but leaves it visible', async () => {
    screen.result = { severity: 'mild', matches: ['darn'] };
    await new UpsertReview(reviews, screen).execute('u1', 'sapiens', {
      rating: 2,
      body: 'darn it',
    });

    expect(reviews.upserts[0]?.autoReport).toEqual({
      note: 'Automated language screen — mild (flagged: darn)',
      hide: false,
      hiddenReason: null,
    });
  });

  it('hides a severe hit and records the pending-review reason', async () => {
    screen.result = { severity: 'severe', matches: ['a', 'b'] };
    await new UpsertReview(reviews, screen).execute('u1', 'sapiens', {
      rating: 1,
      body: 'bad words',
    });

    expect(reviews.upserts[0]?.autoReport).toEqual({
      note: 'Automated language screen — severe (flagged: a, b)',
      hide: true,
      hiddenReason: 'Automated language screen (pending review)',
    });
  });

  it('omits the flagged clause when the screen reports no matched terms', async () => {
    screen.result = { severity: 'mild', matches: [] };
    await new UpsertReview(reviews, screen).execute('u1', 'sapiens', {
      rating: 2,
      body: 'hmm',
    });

    expect(reviews.upserts[0]?.autoReport?.note).toBe('Automated language screen — mild');
  });

  it('returns the stored review as the viewer sees it, including hidden state', async () => {
    reviews.viewer = viewerRow({ isHidden: true, hiddenReason: 'Pending review' });
    const out = await new UpsertReview(reviews, screen).execute('u1', 'sapiens', {
      rating: 4,
      body: 'ok',
    });

    expect(out).toMatchObject({ rating: 4, isHidden: true, hiddenReason: 'Pending review' });
  });
});

describe('DeleteReview', () => {
  it('404s on an unknown book', async () => {
    reviews.bookIdBySlug = null;
    await expect(new DeleteReview(reviews).execute('u1', 'ghost')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('404s when the member had no review for the book', async () => {
    reviews.deleteResult = false;
    await expect(new DeleteReview(reviews).execute('u1', 'sapiens')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('resolves when a review was deleted', async () => {
    await expect(new DeleteReview(reviews).execute('u1', 'sapiens')).resolves.toBeUndefined();
  });
});

describe('GetBookReviews', () => {
  it('404s on an unknown book', async () => {
    reviews.bookIdBySlug = null;
    await expect(new GetBookReviews(reviews).execute('ghost')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('maps visible rows to the public shape', async () => {
    reviews.publicRows = [
      {
        id: 'r1',
        rating: 5,
        body: 'Great.',
        displayName: 'Ada',
        createdAt: AT,
        updatedAt: AT,
      },
    ];
    const out = await new GetBookReviews(reviews).execute('sapiens');

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ rating: 5, body: 'Great.', displayName: 'Ada' });
    // the public shape must never leak the author's user id
    expect(out[0]).not.toHaveProperty('userId');
  });
});

describe('GetViewerBook', () => {
  const shelfEntry: ShelfEntry = {
    status: 'reading',
    startedOn: '2026-07-01',
    finishedOn: null,
    updatedAt: AT,
  };

  function fakeShelves(entry: ShelfEntry | null, bookId: string | null = 'b1') {
    return {
      findBookIdBySlug: () => Promise.resolve(bookId),
      get: () => Promise.resolve(entry),
    } as unknown as ReadingStatusRepository;
  }

  it('404s on an unknown book', async () => {
    await expect(
      new GetViewerBook(fakeShelves(null, null), reviews).execute('u1', 'ghost'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('combines the shelf entry and the viewer review', async () => {
    const out = await new GetViewerBook(fakeShelves(shelfEntry), reviews).execute('u1', 'sapiens');

    expect(out).toMatchObject({
      status: 'reading',
      startedOn: '2026-07-01',
      finishedOn: null,
    });
    expect(out.review).toMatchObject({ rating: 4 });
  });

  it('nulls every field when the member has neither shelf nor review', async () => {
    reviews.viewer = null;
    const out = await new GetViewerBook(fakeShelves(null), reviews).execute('u1', 'sapiens');

    expect(out).toEqual({ status: null, startedOn: null, finishedOn: null, review: null });
  });
});

describe('ReportReview', () => {
  it('files the report, defaulting an omitted note to null', async () => {
    await new ReportReview(reviews).execute('r1', 'u2', { reason: 'abuse' });

    expect(reviews.reports[0]).toEqual({
      reviewId: 'r1',
      reporterId: 'u2',
      reason: 'abuse',
      note: null,
    });
  });

  it('passes a supplied note through', async () => {
    await new ReportReview(reviews).execute('r1', 'u2', { reason: 'spam', note: 'links' });

    expect(reviews.reports[0]?.note).toBe('links');
  });

  it('404s when the review is gone', async () => {
    reviews.reportResult = 'not_found';
    await expect(
      new ReportReview(reviews).execute('r1', 'u2', { reason: 'abuse' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('409s when the member already reported it', async () => {
    reviews.reportResult = 'duplicate';
    await expect(
      new ReportReview(reviews).execute('r1', 'u2', { reason: 'abuse' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
