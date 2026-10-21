import { index, integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import type { WidgetStatus } from '../../shared/widget'

/**
 * Drizzle table definitions. `npm run db:generate` turns changes here into SQL in
 * ./drizzle, which `npm run db:migrate` applies and the test harness replays.
 *
 * Deliberately NOT using `pgEnum` for `status`: altering a Postgres enum is a migration
 * chore, and drizzle emits schema-qualified `CREATE TYPE "public"."..."` which collides
 * when the test harness replays migrations into per-worker schemas. A varchar narrowed
 * with `$type<>()` gives the same compile-time safety, and zod guards the edge.
 */
export const widgets = pgTable(
  'widgets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull().unique(),
    status: varchar('status', { length: 16 }).$type<WidgetStatus>().notNull().default('active'),
    score: integer('score').notNull().default(0),
    /** When a background job last touched this row. Null = never refreshed. */
    lastRefreshedAt: timestamp('last_refreshed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('widgets_status_idx').on(table.status),
    // The poller will want "oldest first" — index it now, it's free.
    index('widgets_last_refreshed_at_idx').on(table.lastRefreshedAt),
  ],
)

export type WidgetRow = typeof widgets.$inferSelect
export type WidgetInsert = typeof widgets.$inferInsert
