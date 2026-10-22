export const MAINTENANCE_DB = 'postgres'
export const TEMPLATE_DB = 'app_test_template'
export const WORKER_DB_PREFIX = 'app_test_worker_'

/** Swaps the database name in a connection URL, keeping credentials and options. */
export function withDatabase(url: string, database: string): string {
  const parsed = new URL(url)
  parsed.pathname = `/${database}`
  return parsed.toString()
}

export function workerDatabase(workerId: string): string {
  return `${WORKER_DB_PREFIX}${workerId}`
}
