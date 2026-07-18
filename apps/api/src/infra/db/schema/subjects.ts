import { pgTable, text, integer } from 'drizzle-orm/pg-core';
import { pkId, createdAt, updatedAt } from './columns.js';

/**
 * subjects (docs/03 §subjects) — the top-level browse axis (History, Science
 * Fiction, …). `position` controls homepage order; a subject groups one or more
 * lists. `slug` is the public address (`/subjects/{slug}`).
 */
export const subjects = pgTable('subjects', {
  id: pkId(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  position: integer('position').notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type SubjectRow = typeof subjects.$inferSelect;
export type NewSubjectRow = typeof subjects.$inferInsert;
