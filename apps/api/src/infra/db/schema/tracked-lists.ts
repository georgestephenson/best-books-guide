import { pgTable, uuid, primaryKey } from 'drizzle-orm/pg-core';
import { createdAt } from './columns.js';
import { users } from './users.js';
import { lists } from './lists.js';

/**
 * tracked_lists (docs/03 §tracked_lists) — a member pins a published list to their
 * home with computed progress (F7). Composite PK `(user_id, list_id)`; both FKs
 * CASCADE. Nothing but the subscription is stored — progress is derived at render
 * time from the member's shelves against the list's book set, so it can never drift.
 */
export const trackedLists = pgTable(
  'tracked_lists',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    listId: uuid('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.listId] })],
);

export type TrackedListRow = typeof trackedLists.$inferSelect;
export type NewTrackedListRow = typeof trackedLists.$inferInsert;
