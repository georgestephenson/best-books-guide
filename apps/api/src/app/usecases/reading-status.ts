import type { SetReadingStatusBody, ViewerShelf, MyBooks } from '@bestbooks/shared';
import { NotFoundError } from '../../domain/errors.js';
import type { Clock } from '../ports/clock.js';
import type { ReadingStatusRepository } from '../ports/reading-status-repository.js';
import { toMyBooks } from '../member-view.js';

/** `YYYY-MM-DD` for a Date (docs/03 dates ride as strings). */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Set/replace the caller's shelf for a book (docs/01 F3). */
export class SetReadingStatus {
  constructor(
    private readonly repo: ReadingStatusRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    userId: string,
    bookSlug: string,
    body: SetReadingStatusBody,
  ): Promise<ViewerShelf> {
    const bookId = await this.repo.findBookIdBySlug(bookSlug);
    if (!bookId) throw new NotFoundError('book not found');

    // finished_on is only meaningful on the finished shelf (docs/03); default it to
    // today when a book is marked finished without one, and clear it otherwise.
    const finishedOn =
      body.status === 'finished' ? (body.finishedOn ?? isoDate(this.clock.now())) : null;
    const startedOn = body.startedOn ?? null;

    await this.repo.upsert({ userId, bookId, status: body.status, startedOn, finishedOn });
    return { status: body.status, startedOn, finishedOn };
  }
}

/** Remove a book from the caller's shelves entirely (docs/01 F3). */
export class RemoveReadingStatus {
  constructor(private readonly repo: ReadingStatusRepository) {}

  async execute(userId: string, bookSlug: string): Promise<void> {
    const bookId = await this.repo.findBookIdBySlug(bookSlug);
    if (!bookId) throw new NotFoundError('book not found');
    await this.repo.remove(userId, bookId);
  }
}

/** My Books, grouped by shelf; the finished shelf doubles as the reading log (F3). */
export class GetMyBooks {
  constructor(private readonly repo: ReadingStatusRepository) {}

  async execute(userId: string): Promise<MyBooks> {
    return toMyBooks(await this.repo.myBooks(userId));
  }
}
