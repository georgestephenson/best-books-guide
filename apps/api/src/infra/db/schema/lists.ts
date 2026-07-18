import { pgTable, text, uuid, boolean, index, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { pkId, createdAt, updatedAt } from './columns.js';
import { subjects } from './subjects.js';

/**
 * lists (docs/03 §lists) — an ordered, ranked set of items under one subject.
 * Sublists via `parent_list_id`, capped at one level (a list with a parent may not
 * itself be a parent) and same-subject-as-parent — both app-enforced, not in SQL.
 * `slug` stays globally unique so every sublist has its own page. A sublist is
 * public only when it *and* its parent are `is_published`.
 *
 * RESTRICT on both FKs: a subject can't be deleted while it has lists; a parent
 * can't be deleted while it has sublists (detach or delete them first).
 */
export const lists = pgTable(
  'lists',
  {
    id: pkId(),
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'restrict' }),
    // Self-reference needs the explicit return type so TS doesn't infer circularly.
    parentListId: uuid('parent_list_id').references((): AnyPgColumn => lists.id, {
      onDelete: 'restrict',
    }),
    intro: text('intro'),
    isPublished: boolean('is_published').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('lists_subject_idx').on(table.subjectId),
    index('lists_parent_idx').on(table.parentListId),
  ],
);

export type ListRow = typeof lists.$inferSelect;
export type NewListRow = typeof lists.$inferInsert;
