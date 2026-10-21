import { and, asc, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import type {
  CreateWidgetInput,
  ListWidgetsQuery,
  UpdateWidgetInput,
  Widget,
} from '../../shared/widget'
import type { Database } from '../db/client'
import { type WidgetRow, widgets } from '../db/schema'

/**
 * PATTERN: a repository is data access ONLY — queries in, domain objects out.
 * No business rules, no logging, no HTTP. Services depend on this *interface*, never
 * on `Database`, which is what lets `widget.service.test.ts` run without Postgres.
 *
 * Copy this file's shape for each new entity: interface, row mapper, Drizzle factory.
 */
export interface WidgetRepository {
  list(filter?: ListWidgetsQuery): Promise<Widget[]>
  findById(id: string): Promise<Widget | null>
  findByName(name: string): Promise<Widget | null>
  create(input: CreateWidgetInput): Promise<Widget>
  update(id: string, patch: UpdateWidgetInput): Promise<Widget | null>
  delete(id: string): Promise<boolean>
  /** Rows never refreshed, or refreshed before `staleBefore`. Oldest first. */
  findStale(staleBefore: Date, limit: number): Promise<Widget[]>
  /** Bulk score write — the shape a polling job needs. Returns rows updated. */
  recordRefresh(updates: Array<{ id: string; score: number }>, at: Date): Promise<number>
}

/**
 * The serialization boundary: `Date` columns become ISO strings here, so every layer
 * above this one — service, route, RPC client, React component — sees one consistent
 * `Widget` type. See the note in src/shared/widget.ts.
 */
function toWidget(row: WidgetRow): Widget {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    score: row.score,
    lastRefreshedAt: row.lastRefreshedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function createWidgetRepository(db: Database): WidgetRepository {
  return {
    async list(filter = {}) {
      const conditions = [
        filter.status ? eq(widgets.status, filter.status) : undefined,
        filter.minScore !== undefined ? gte(widgets.score, filter.minScore) : undefined,
      ].filter((c) => c !== undefined)

      const rows = await db
        .select()
        .from(widgets)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(widgets.name))

      return rows.map(toWidget)
    },

    async findById(id) {
      const [row] = await db.select().from(widgets).where(eq(widgets.id, id)).limit(1)
      return row ? toWidget(row) : null
    },

    async findByName(name) {
      const [row] = await db.select().from(widgets).where(eq(widgets.name, name)).limit(1)
      return row ? toWidget(row) : null
    },

    async create(input) {
      const [row] = await db.insert(widgets).values(input).returning()
      // `.returning()` always yields a row on a successful insert; a throw here means
      // something is badly wrong, so fail loudly rather than returning a bogus object.
      if (!row) throw new Error('insert returned no row')
      return toWidget(row)
    },

    async update(id, patch) {
      const [row] = await db
        .update(widgets)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(widgets.id, id))
        .returning()
      return row ? toWidget(row) : null
    },

    async delete(id) {
      const deleted = await db
        .delete(widgets)
        .where(eq(widgets.id, id))
        .returning({ id: widgets.id })
      return deleted.length > 0
    },

    async findStale(staleBefore, limit) {
      const rows = await db
        .select()
        .from(widgets)
        .where(
          and(
            eq(widgets.status, 'active'),
            or(isNull(widgets.lastRefreshedAt), lt(widgets.lastRefreshedAt, staleBefore)),
          ),
        )
        // NULLS FIRST: never-refreshed rows are the most urgent.
        .orderBy(sql`${widgets.lastRefreshedAt} asc nulls first`)
        .limit(limit)

      return rows.map(toWidget)
    },

    async recordRefresh(updates, at) {
      if (updates.length === 0) return 0

      // One statement for the whole batch rather than N round-trips — the pattern to
      // reach for when a job writes back results for a few hundred rows.
      //
      // Built with the query builder, NOT `db.execute(sql\`...\`)`: a raw template
      // bypasses drizzle's column type mappers, so a `Date` would reach the driver
      // unconverted and blow up with ERR_INVALID_ARG_TYPE. Going through `.update()`
      // means `lastRefreshedAt` gets the timestamptz mapper it needs.
      const scoreCase = sql.join(
        [
          sql`(case`,
          ...updates.map((u) => sql`when ${widgets.id} = ${u.id} then ${u.score}`),
          sql`else ${widgets.score} end)::integer`,
        ],
        sql` `,
      )

      const updated = await db
        .update(widgets)
        .set({ score: scoreCase, lastRefreshedAt: at, updatedAt: at })
        .where(
          inArray(
            widgets.id,
            updates.map((u) => u.id),
          ),
        )
        .returning({ id: widgets.id })

      return updated.length
    },
  }
}
