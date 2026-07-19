import type { SubjectRef } from '@bestbooks/shared';

/** A tracked list with progress computed from the member's shelves (docs/03 §tracked_lists). */
export interface TrackedListRow {
  slug: string;
  title: string;
  subject: SubjectRef;
  progress: {
    total: number;
    finished: number;
    reading: number;
    pctFinished: number;
    pctReading: number;
  };
}

export type TrackResult = 'ok' | 'not_found';

/**
 * Track-a-list (docs/01 F7). Only *published, publicly-visible* lists can be tracked;
 * `findTrackableListIdBySlug` returns null for anything a visitor couldn't see, so a
 * use-case can 404 without duplicating the visibility rule. Progress is computed at
 * read time by expanding each list to its book set (series items → their books,
 * parent lists → own items ∪ sublists' items) and joining the member's shelves —
 * nothing but the subscription is stored, so it can't drift.
 */
export interface TrackedListRepository {
  /** Id of a list the member may track (published, and — if a sublist — parent published too). */
  findTrackableListIdBySlug(slug: string): Promise<string | null>;
  track(userId: string, listId: string): Promise<void>;
  untrack(userId: string, listId: string): Promise<void>;
  isTracked(userId: string, listId: string): Promise<boolean>;
  /** The member's tracked lists with live progress, newest-tracked first. */
  listTracked(userId: string): Promise<TrackedListRow[]>;
}
