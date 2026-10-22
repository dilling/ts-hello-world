import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * Three projects so the fast tests stay fast:
 *
 *   server — pure unit tests. No Docker. This is where most tests should live.
 *   db     — hits real Postgres. Needs `npm run db:up`.
 *   web    — components in jsdom.
 *
 * `npm run test:unit` runs server + web only, so you can work with Docker stopped.
 */
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          include: ['src/server/**/*.test.ts'],
          // *.db.test.ts belongs to the `db` project.
          exclude: ['**/*.db.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'db',
          environment: 'node',
          include: ['src/server/**/*.db.test.ts'],
          // globalSetup builds the template database once; setupFiles clones it per worker.
          globalSetup: ['./test/db/global-setup.ts'],
          setupFiles: ['./test/db/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['src/web/**/*.test.{ts,tsx}'],
          setupFiles: ['./test/setup.dom.ts'],
        },
      },
    ],
  },
})
