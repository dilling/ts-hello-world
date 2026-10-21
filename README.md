# ts-hello-world

A TypeScript full-stack template: Hono API + React SPA in one repo, Postgres, and a
Postgres-backed job queue. Built to be **forked** — the `Widget` entity is a deliberate
placeholder that exists only to demonstrate each layer. Delete it and copy its shape.

## Stack

| Layer      | Choice                                                 |
| ---------- | ------------------------------------------------------ |
| Server     | Hono 4 on Node 22 (`@hono/node-server`)                |
| Frontend   | React 19, Vite 8, TanStack Router (file-based) + Query |
| Styling    | Tailwind 4, shadcn/ui components                       |
| Database   | Postgres 18, Drizzle ORM, `postgres.js`                |
| Jobs       | pg-boss (queue + cron, in your existing Postgres)      |
| Validation | Zod 4, shared between server and client                |
| Tests      | Vitest 5 (three projects), Testing Library             |
| Lint       | ESLint 10 (type-aware) + Prettier 3                    |

## Getting started

```bash
cp .env.example .env
npm install
npm run db:up        # Postgres in Docker
npm run db:migrate
npm run db:seed
npm run dev          # API on :3000, web on :5173
```

Open http://localhost:5173.

## Commands

| Command                          | What it does                                               |
| -------------------------------- | ---------------------------------------------------------- |
| `npm run dev`                    | Hono (`:3000`) + Vite (`:5173`) together, both watching    |
| `npm run lint`                   | ESLint + `prettier --check` — **this is the CI lint gate** |
| `npm run lint:fix`               | Fix everything fixable                                     |
| `npm run typecheck`              | `tsc --noEmit`                                             |
| `npm test`                       | All three Vitest projects (needs Postgres)                 |
| `npm run test:unit`              | `server` + `web` projects only — **no Docker required**    |
| `npm run ci`                     | lint + typecheck + test, what CI runs                      |
| `npm run build`                  | SPA into `dist/web`, then typecheck                        |
| `npm run db:up` / `db:down`      | Postgres container                                         |
| `npm run db:generate`            | Generate migration SQL from the Drizzle schema             |
| `npm run db:migrate` / `db:seed` | Apply migrations / insert sample rows                      |
| `npm run db:reset`               | Nuke the volume and rebuild from scratch                   |
| `npm run app:up`                 | Build and run the whole app in Docker (production path)    |
| `npm run app:logs` / `app:down`  | Tail / stop it                                             |

## Where the patterns live

Read these in order — it's about 300 lines and covers every convention in the repo.

| Pattern                                  | File                                                  |
| ---------------------------------------- | ----------------------------------------------------- |
| Shared DTOs (one zod schema, both sides) | `src/shared/widget.ts`                                |
| Env parsing, fail-fast at boot           | `src/server/env.ts`                                   |
| **Repository** — data access only        | `src/server/repositories/widget.repository.ts`        |
| In-memory repository for tests           | `src/server/repositories/widget.repository.memory.ts` |
| **Service** — behaviour, domain errors   | `src/server/services/widget.service.ts`               |
| Composition root (all the wiring)        | `src/server/container.ts`                             |
| App assembly + single error boundary     | `src/server/app.ts`                                   |
| Routes, chained for RPC types            | `src/server/routes/widgets.ts`                        |
| Consistent validation errors             | `src/server/lib/validator.ts`                         |
| Background job                           | `src/server/jobs/refresh-widgets.job.ts`              |
| Typed RPC client                         | `src/web/lib/api.ts`                                  |
| **Frontend state** (Query, no Redux)     | `src/web/lib/queries.ts`                              |
| Route with typed search params + loader  | `src/web/routes/widgets.index.tsx`                    |
| Test harness: per-worker DB schemas      | `test/db/setup.ts`                                    |

### Server: repository / service split

A **repository** does data access and nothing else — queries in, domain objects out. A
**service** owns behaviour: business rules, orchestration, domain errors. Services depend
on repository _interfaces_, never on `Database`.

That split is what makes `src/server/services/widget.service.test.ts` possible: it wires
the real service to the in-memory repository and runs in milliseconds with no Docker.
**That file is the test template** — copy it.

Dependencies are passed as arguments and wired in exactly one place,
`src/server/container.ts`. No DI framework, no decorators.

### End-to-end types

`src/web/lib/api.ts` does `hc<AppType>()` against the server's own route type. No codegen
and no duplicated interfaces — rename a response field and `npm run typecheck` fails in
the frontend.

This depends on routes being defined as **one unbroken method chain**
(`new Hono().get(...).post(...)`). Break the chain and it still works at runtime while the
client's types silently degrade, with no error. There's a comment saying so in
`src/server/routes/widgets.ts`; please leave it there.

Hono's client doesn't throw on 4xx, and routes that can fail have a _union_ response type.
`unwrap()` in `api.ts` narrows to the success body and throws on errors.

### Frontend state

Two tiers, and that's the whole policy:

1. **Server-derived data → TanStack Query**, with `queryOptions` factories in
   `src/web/lib/queries.ts` so a key can never drift from its fetcher.
2. **Ephemeral UI state → `useState`** in the component that owns it.

Filters and anything shareable go in the URL as typed search params (see
`widgets.index.tsx`). There is deliberately **no Redux or Zustand** — in a dashboard,
nearly all state is a cached copy of server data, which Query already handles.

### Jobs

pg-boss runs in the same process as the HTTP server (one thing to deploy) and keeps its
tables in a separate `pgboss` schema. A job handler is a **thin trigger that calls a
service** — the work itself lives in the service so it's testable without a queue.
`src/server/jobs/worker.ts` explains how to split the worker into its own process when
you need to.

## Testing

Three Vitest projects:

- **`server`** — unit tests, no database. Most tests belong here.
- **`db`** — `*.db.test.ts`, real Postgres. Needs `npm run db:up`.
- **`web`** — components in jsdom.

Each Vitest worker gets **its own Postgres schema** (`test_1`, `test_2`, …) inside the
same `app` database, created by replaying `drizzle/*.sql` and dropped afterwards. DB tests
run in parallel without interfering, and there's no second database or container.

### ⚠️ Use `db:generate`, never `drizzle-kit push`

The test harness builds its schema from the committed SQL in `drizzle/`. `push` mutates
the database _without_ writing those files, so using it makes the tests silently drift
from the app schema.

```bash
# edit src/server/db/schema.ts, then:
npm run db:generate   # writes drizzle/NNNN_*.sql — commit it
npm run db:migrate
```

This is the one place the template picks rigor over speed: it costs one extra command per
schema change and it's what keeps several people on a shared database honest.

## Deployment shape

`npm run build` emits the SPA to `dist/web`; in production Hono serves it with an SPA
fallback, so deep links work and there's a single artifact on a single port. `npm start`
runs the server through `tsx` rather than compiling it — there's no second build pipeline
to maintain.

`npm run app:up` runs that exact path in Docker. It's behind a compose profile so the
normal `db:up` + `dev` loop never rebuilds an image.

## Notes for whoever forks this

- Delete `Widget` end to end — schema, repository (both impls), service, routes, jobs,
  `src/shared/widget.ts`, `src/web/features/widgets/`, and the tests. Use it as the
  worked example, not as a base class.
- `score` is a 0–100 metric purely so there's something to chart; it maps onto coverage %.
- `status` is a `varchar` narrowed with `$type<>()`, not a `pgEnum`, on purpose — see the
  comment in `src/server/db/schema.ts`.
- There is **no auth**. The app is assumed to be VPN-only. If that changes, the hook point
  is a middleware in `src/server/app.ts`.
- **TypeScript is pinned to 5.9, not 7.** This is forced: no published version of
  `typescript-eslint` supports TS 7 yet (its peer range is `<6.1.0`), and type-aware
  linting was judged worth more than the native compiler's speed. Revisit once
  `typescript-eslint` ships TS 7 support — the only blocker is that peer range.
- `eslint-plugin-jsx-a11y` is deliberately absent: it doesn't support ESLint 10 yet. Add
  it when it does if accessibility linting matters to you.
- Linting is **type-aware** (`recommendedTypeChecked`), which is the whole reason for
  ESLint over a faster syntax-only linter: it catches unhandled promises in a codebase
  that is async end to end. Two rules are switched off on purpose in `eslint.config.js`,
  each with a comment explaining why — read those before adding a third.
