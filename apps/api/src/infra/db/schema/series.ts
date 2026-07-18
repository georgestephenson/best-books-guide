import { pgTable, text } from 'drizzle-orm/pg-core';
import { pkId, createdAt, updatedAt } from './columns.js';

/**
 * series (docs/03 §series) — a curation device (docs/01 F1): it can occupy a list
 * slot and has its own page (`/series/{slug}`), but member actions stay book-level,
 * so no rating aggregates live here. Created and ordered manually by admins; Open
 * Library's series data is too patchy to import (books point back via `series_id`).
 */
export const series = pgTable('series', {
  id: pkId(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type SeriesRow = typeof series.$inferSelect;
export type NewSeriesRow = typeof series.$inferInsert;
