import { and, asc, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import type {
  CreateWidgetInput,
  ListWidgetsQuery,
  UpdateWidgetInput,
  Widget,
} from '../../shared/widget'
import type { Database } from '../db/client'
import { type WidgetRow, widgets } from '../db/schema'

/** Data access only — the shape to copy per entity. See src/server/README.md. */
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

/** The serialization boundary: `Date` columns become ISO strings. See src/shared/widget.ts. */
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
      // Unreachable on a successful insert; fail loudly rather than fabricate a row.
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

      // One statement for the whole batch, built with the query builder and NOT
      // `db.execute(sql\`...\`)`: a raw template bypasses drizzle's column type mappers, so
      // `lastRefreshedAt` would reach the driver as an unconverted Date and throw
      // ERR_INVALID_ARG_TYPE.
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
