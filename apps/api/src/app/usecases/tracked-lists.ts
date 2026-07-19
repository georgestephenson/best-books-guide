import type { ListTracking, TrackedList } from '@bestbooks/shared';
import { NotFoundError } from '../../domain/errors.js';
import type { TrackedListRepository } from '../ports/tracked-list-repository.js';

/** Track a published list from its page (docs/01 F7). 404 if it isn't publicly visible. */
export class TrackList {
  constructor(private readonly repo: TrackedListRepository) {}

  async execute(userId: string, listSlug: string): Promise<ListTracking> {
    const listId = await this.repo.findTrackableListIdBySlug(listSlug);
    if (!listId) throw new NotFoundError('list not found');
    await this.repo.track(userId, listId);
    return { tracked: true };
  }
}

/** Untrack a list (docs/01 F7 — untrack any time). */
export class UntrackList {
  constructor(private readonly repo: TrackedListRepository) {}

  async execute(userId: string, listSlug: string): Promise<ListTracking> {
    const listId = await this.repo.findTrackableListIdBySlug(listSlug);
    if (!listId) throw new NotFoundError('list not found');
    await this.repo.untrack(userId, listId);
    return { tracked: false };
  }
}

/** Whether the caller tracks a list — drives the list page's Track button state. */
export class GetListTracking {
  constructor(private readonly repo: TrackedListRepository) {}

  async execute(userId: string, listSlug: string): Promise<ListTracking> {
    const listId = await this.repo.findTrackableListIdBySlug(listSlug);
    if (!listId) throw new NotFoundError('list not found');
    return { tracked: await this.repo.isTracked(userId, listId) };
  }
}

/** The member's tracked lists with computed progress (docs/01 F7, home + My Books). */
export class GetTrackedLists {
  constructor(private readonly repo: TrackedListRepository) {}

  async execute(userId: string): Promise<TrackedList[]> {
    return this.repo.listTracked(userId);
  }
}
