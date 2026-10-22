export const MAINTENANCE_DB = 'postgres'
export const TEST_DB = 'app_test'

/** Swaps the database name in a connection URL, keeping credentials and options. */
export function withDatabase(url: string, database: string): string {
  const parsed = new URL(url)
  parsed.pathname = `/${database}`
  return parsed.toString()
}
