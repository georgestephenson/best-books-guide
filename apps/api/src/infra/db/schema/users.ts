import { sql } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, check } from 'drizzle-orm/pg-core';
import { citext, uuidv7Default } from './columns.js';

/**
 * users (docs/03 §users). The only table in migration 0000; the catalogue and
 * member-feature tables live in later migrations.
 *
 * No password_hash/email leak risk from the ORM: responses are serialised from
 * TypeBox response schemas (docs/04), never from a row spread.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id')
      .primaryKey()
      .default(uuidv7Default()),
    email: citext('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    role: text('role').notNull().default('member'),
    // null until the verification link is followed; the MV write gate reads this.
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      // App-maintained on every update (docs/03) — no trigger.
      .$onUpdate(() => sql`now()`),
  },
  (table) => [check('users_role_check', sql`${table.role} in ('member', 'admin')`)],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
