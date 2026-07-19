import { and, desc, eq, exists, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type {
  TrackedListRepository,
  TrackedListRow,
} from '../../app/ports/tracked-list-repository.js';
import type { Database } from './pool.js';
import { lists, subjects, trackedLists } from './schema/index.js';

interface ProgressCounts {
  total: number;
  finished: number;
  reading: number;
}

const pct = (part: number, total: number): number =>
  total > 0 ? Math.round((part / total) * 100) : 0;

export class DrizzleTrackedListRepository implements TrackedListRepository {
  constructor(private readonly db: Database) {}

  async findTrackableListIdBySlug(slug: string): Promise<string | null> {
    const parent = alias(lists, 'parent');
    const [row] = await this.db
      .select({ id: lists.id })
      .from(lists)
      .where(
        and(
          eq(lists.slug, slug),
          eq(lists.isPublished, true),
          // Public visibility: top-level, or a sublist whose parent is also published.
          or(
            isNull(lists.parentListId),
            exists(
              this.db
                .select({ one: sql`1` })
                .from(parent)
                .where(and(eq(parent.id, lists.parentListId), eq(parent.isPublished, true))),
            ),
          ),
        ),
      )
      .limit(1);
    return row?.id ?? null;
  }

  async track(userId: string, listId: string): Promise<void> {
    await this.db.insert(trackedLists).values({ userId, listId }).onConflictDoNothing();
  }

  async untrack(userId: string, listId: string): Promise<void> {
    await this.db
      .delete(trackedLists)
      .where(and(eq(trackedLists.userId, userId), eq(trackedLists.listId, listId)));
  }

  async isTracked(userId: string, listId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ one: sql<number>`1` })
      .from(trackedLists)
      .where(and(eq(trackedLists.userId, userId), eq(trackedLists.listId, listId)))
      .limit(1);
    return Boolean(row);
  }

  async listTracked(userId: string): Promise<TrackedListRow[]> {
    const rows = await this.db
      .select({
        listId: lists.id,
        slug: lists.slug,
        title: lists.title,
        subjectSlug: subjects.slug,
        subjectName: subjects.name,
      })
      .from(trackedLists)
      .innerJoin(lists, eq(lists.id, trackedLists.listId))
      .innerJoin(subjects, eq(subjects.id, lists.subjectId))
      .where(eq(trackedLists.userId, userId))
      .orderBy(desc(trackedLists.createdAt));

    const out: TrackedListRow[] = [];
    for (const r of rows) {
      const counts = await this.progressFor(userId, r.listId);
      out.push({
        slug: r.slug,
        title: r.title,
        subject: { slug: r.subjectSlug, name: r.subjectName },
        progress: {
          total: counts.total,
          finished: counts.finished,
          reading: counts.reading,
          pctFinished: pct(counts.finished, counts.total),
          pctReading: pct(counts.reading, counts.total),
        },
      });
    }
    return out;
  }

  /**
   * The list's full book set (docs/03 §tracked_lists): direct book items, plus every
   * book of each series item, plus the same expansion for the list's *published*
   * sublists (rolled up) — then the member's shelves counted against it. One indexed
   * query per tracked list; nothing is stored, so progress can't drift.
   */
  private async progressFor(userId: string, listId: string): Promise<ProgressCounts> {
    const result = await this.db.execute(sql`
      with target_lists as (
        select cast(${listId} as uuid) as id
        union
        select id from lists
          where parent_list_id = cast(${listId} as uuid) and is_published = true
      ),
      book_set as (
        select distinct book_id from (
          select li.book_id as book_id
            from list_items li
            join target_lists tl on tl.id = li.list_id
            where li.book_id is not null
          union all
          select b.id as book_id
            from list_items li
            join target_lists tl on tl.id = li.list_id
            join books b on b.series_id = li.series_id
            where li.series_id is not null
        ) s
      )
      select
        count(*)::int as total,
        count(*) filter (where rs.status = 'finished')::int as finished,
        count(*) filter (where rs.status = 'reading')::int as reading
      from book_set bs
      left join reading_statuses rs
        on rs.book_id = bs.book_id and rs.user_id = cast(${userId} as uuid)
    `);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return {
      total: Number(row?.total ?? 0),
      finished: Number(row?.finished ?? 0),
      reading: Number(row?.reading ?? 0),
    };
  }
}
