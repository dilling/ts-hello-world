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
| Lint       | oxlint 1.89 (type-aware via tsgolint) + oxfmt          |

## Getting started

### Just run it

```bash
docker compose up
```

Open **http://localhost:3000**. That's the whole thing — Postgres, migrations, seed data,
the API, the background worker and the built frontend. Nothing needs to be installed on
your machine except Docker, and there's no `.env` to copy (compose supplies the config).
Takes about 10 seconds from a clean checkout.

### Develop on it

For actual work you want hot reload, so run Postgres in Docker and the app on the host:

```bash
npm install
npm run db:up        # Postgres ONLY — does not start the app container
npm run db:push        # apply schema.ts to the database
npm run db:seed
npm run dev          # API on :3000, web on :5173 (proxying /api to the API)
```

No `.env` needed: `DATABASE_URL` defaults to the local compose database, and `PORT` and
`LOG_LEVEL` have defaults too. Copy `.env.example` to `.env` only if you want to override
something — it's loaded when present and ignored when absent.

Open **http://localhost:5173** for this one — that's the Vite dev server, which is what
gives you HMR.

> Both use port 3000 for the API, so stop one before starting the other:
> `docker compose down` or `npm run db:down`.

## Commands

| Command                          | What it does                                                 |
| -------------------------------- | ------------------------------------------------------------ |
| `npm run dev`                    | Hono (`:3000`) + Vite (`:5173`) together, both watching      |
| `npm run lint`                   | oxlint + `oxfmt --check` — **this is the CI lint gate**      |
| `npm run lint:fix`               | Fix everything fixable                                       |
| `npm run typecheck`              | `tsc --noEmit`                                               |
| `npm test`                       | All three Vitest projects (needs Postgres)                   |
| `npm run test:unit`              | `server` + `web` projects only — **no Docker required**      |
| `npm run ci`                     | lint + typecheck + test, what CI runs                        |
| `npm run build`                  | SPA into `dist/web`, then typecheck                          |
| `npm run db:up` / `db:down`      | Postgres container only (never starts the app)               |
| `npm run db:push`                | Apply `schema.ts` to the database — **the default workflow** |
| `npm run db:generate`            | Emit migration SQL into `drizzle/` — only needed to deploy   |
| `npm run db:migrate` / `db:seed` | Apply committed migrations / insert sample rows              |
| `npm run db:reset`               | Nuke the volume and rebuild from scratch                     |
| `npm run app:up`                 | `docker compose up` with a rebuild, detached + health-waited |
| `npm run app:logs` / `app:down`  | Tail / stop it                                               |

## Where the patterns live

Read these in order — it's about 300 lines and covers every convention in the repo.

| Pattern                                  | File                                           |
| ---------------------------------------- | ---------------------------------------------- |
| Shared DTOs (one zod schema, both sides) | `src/shared/widget.ts`                         |
| Env parsing, fail-fast at boot           | `src/server/env.ts`                            |
| **Repository** — data access only        | `src/server/repositories/widget.repository.ts` |
| **Service** — behaviour, domain errors   | `src/server/services/widget.service.ts`        |
| Composition root (all the wiring)        | `src/server/container.ts`                      |
| App assembly + single error boundary     | `src/server/app.ts`                            |
| Routes, chained for RPC types            | `src/server/routes/widgets.ts`                 |
| Consistent validation errors             | `src/server/lib/validator.ts`                  |
| Background job                           | `src/server/jobs/refresh-widgets.job.ts`       |
| Typed RPC client                         | `src/web/lib/api.ts`                           |
| **Frontend reads** (Query, no Redux)     | `src/web/lib/queries.ts`                       |
| **Frontend writes** (mutations + toasts) | `src/web/lib/mutations.ts`                     |
| Route with typed search params + loader  | `src/web/routes/widgets.index.tsx`             |
| **Form** (TanStack Form + shared zod)    | `src/web/features/widgets/widget-form.tsx`     |
| Error / loading / 404 surfaces           | `src/web/main.tsx`, `src/web/components/app-*` |
| Destructive action confirmation          | `src/web/components/confirm-button.tsx`        |
| Design tokens (shadcn two-layer)         | `src/web/index.css`                            |
| Test harness: transactional DB fixtures  | `test/db/setup.ts`                             |

Agent-facing rules are in `CLAUDE.md` — a shorter, imperative version of the same
conventions.

### Server: repository / service split

A **repository** does data access and nothing else — queries in, domain objects out. A
**service** owns behaviour: business rules, orchestration, domain errors. Services depend
on repository _interfaces_, never on `Database`.

That split is what makes `src/server/services/widget.service.test.ts` possible: it runs
the real service against a `mock<WidgetRepository>()` from
[vitest-mock-extended](https://www.npmjs.com/package/vitest-mock-extended), so there's no
database and no Docker and it finishes in milliseconds. **That file is the test
template** — copy it.

Mocking the interface rather than hand-rolling a fake means adding a method to
`WidgetRepository` can't silently leave a gap in the stub, and tests can assert on
interactions (`expect(widgets.create).not.toHaveBeenCalled()`) as well as return values.
Shared test data builders live in `test/factories.ts`.

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

Three tiers, and that's the whole policy:

1. **Server data → TanStack Query.** Reads go through `queryOptions` factories in
   `src/web/lib/queries.ts` so a key can never drift from its fetcher; writes go through
   a hook in `src/web/lib/mutations.ts`.
2. **Shareable UI state → the URL**, as typed search params validated by a zod schema
   (see `widgets.index.tsx`). Filters, tabs, pagination.
3. **Ephemeral UI state → `useState`** in the component that owns it.

There is deliberately **no Redux or Zustand, and no context holding server data** — in a
dashboard nearly all state is a cached copy of the server's, which Query already handles.
A second copy is a cache that disagrees with the first.

Every mutation invalidates what it changed and reports both outcomes as a toast. A
`useMutation` with no `onError` fails silently, which is the most expensive kind of bug to
chase: the request fails, the UI doesn't move, and nothing points at the network.

### Forms

`src/web/features/widgets/widget-form.tsx` is the template. TanStack Form, with the
shared zod schema handed straight to `validators.onChange` — Zod 4 implements Standard
Schema, so there's no adapter package and no second copy of the validation rules.

Validate against `widgetFieldsSchema`, the no-defaults base, rather than
`createWidgetSchema`: a `.default()` makes a field optional on the schema's _input_ side,
while a form always holds a concrete value for every control.

The form takes an `onSubmit` prop and the route owns the mutation, which is why the form
tests need no QueryClient and no router.

### Failure and loading

`main.tsx` registers `defaultErrorComponent`, `defaultPendingComponent` and
`defaultNotFoundComponent` on the router, so every route — including ones added later —
gets them for free.

This matters more than it looks. Every route fetches with `useSuspenseQuery`, which
_throws_ on error by design. With no error component the throw unmounts the page and
TanStack falls back to its own minimal renderer, so a failed API call reads as "the app
died" and sends you debugging the wrong layer.

### Components

shadcn/ui on Radix. Behavioural components (dialog, select, dropdown, popover, tooltip)
come from `npx shadcn@latest add <name>` — hand-rolling them means hand-rolling focus
traps, scroll locking and `aria` wiring, and getting it wrong invisibly. Zero-behaviour
primitives like `badge.tsx` and `card.tsx` stay hand-written.

Design tokens in `src/web/index.css` use shadcn's two-layer shape: the raw token in
`:root` (`--popover`), re-exported as a Tailwind token in `@theme inline`
(`--color-popover`). Generated components read both forms, so declare new tokens in both
blocks — a missing one renders a component unstyled with no error. The app is dark-only;
there is no light palette.

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

DB tests use **transactional fixtures** — the same pattern as Rails or Django. A global
setup creates `app_test` and pushes `schema.ts` into it once per run; then every test runs
inside a transaction that is rolled back afterwards. Nothing is ever committed, so there's
no cleanup step and no way for one test's rows to leak into another.

Use `dbTest` instead of `it`:

```ts
dbTest('does a thing', async ({ db }) => {
  const repo = createWidgetRepository(db) // db is the transaction
})
```

Workers share the one database safely, because uncommitted rows are invisible to other
connections. `Database` is typed as `PgDatabase` rather than `PostgresJsDatabase` so a
transaction handle satisfies it — which is also what would let a service span several
repositories in one transaction later.

This is what makes `db:push` safe as the default: the harness derives its schema from
`schema.ts`, never from committed SQL.

### Schema changes: `db:push`

```bash
# edit src/server/db/schema.ts, then:
npm run db:push
```

That's it. The test harness builds its template database by pushing `schema.ts` too, so
tests can't drift from the schema — nothing reads `drizzle/`.

`npm run db:generate` still exists and emits migration SQL into `drizzle/`. You need it
before deploying to a real environment, because `push` keeps no record of what's been
applied and gives you nothing to review. Treat it as "produce a deploy artifact", not as
part of the edit loop.

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
- **TypeScript 7** (the native Go compiler) does the typechecking. That's only possible
  because oxlint's type-aware linting runs on `oxlint-tsgolint`, which is built on
  typescript-go as well. `typescript-eslint` still caps its peer range at `<6.1.0`, so an
  ESLint-based setup would force TypeScript 5.9 — which is why this repo doesn't use one.
- Linting is **type-aware** (`oxlint --type-aware`), and that's the point: it catches
  unhandled promises and misused async callbacks in a codebase that's async end to end.
  A syntax-only linter cannot.
- The two **TanStack ESLint plugins run inside oxlint** through its `jsPlugins` bridge, so
  Query's `exhaustive-deps` and Router's rules still apply. That bridge is alpha and not
  covered by semver — if it breaks, delete the `jsPlugins` line in `.oxlintrc.json`; you
  lose those rules and nothing else.
- Some rules are switched off in `.oxlintrc.json` — `react-in-jsx-scope` is wrong for
  React 19's automatic JSX runtime, `import/no-unassigned-import` is wrong for CSS
  side-effect imports, and so on. Confirm a rule is genuinely wrong for this stack before
  adding to that list.
