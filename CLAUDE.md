# Working in this repo

A Hono API + React SPA in one repo. This file is the short list of rules; the nested
READMEs explain the _why_ at length. When they conflict, this file wins.

**The `Widget` entity is a worked example of every layer.** Before writing a new feature,
find its `Widget` equivalent and copy that file's shape. Almost nothing here needs to be
invented.

## Before you finish

Run `npm run ci` (lint + typecheck + test). `npm run test:unit` skips the tests that need
Docker. Fix what it reports — don't hand back work that fails it.

- `npm run lint:fix` fixes formatting and most lint errors. Formatting is **oxfmt**, not
  Prettier: single quotes, no semicolons.
- Linting is **type-aware**. `no-floating-promises` and `no-misused-promises` are errors,
  so `void` a promise you deliberately ignore (`onClick={() => void navigate(...)}`).
- `no-console` is an error outside tests and scripts. Use the pino logger on the server.

## Comments

Write a comment when the code genuinely can't say it itself:

- a footgun — the obvious approach here is wrong, and here's the symptom
- a constraint imposed from outside (a library's requirement, a wire format, an ordering)
- the contract of an exported interface or a non-obvious parameter

Don't restate the code, don't explain the obvious, and don't write architecture essays.
**No paragraphs.** If an explanation needs one, it belongs in the nearest README with a
one-line pointer at the code:

```ts
// State tiers; no global store. See src/web/README.md.
```

Comments describe the code as it is now — never why it changed.

### Never narrate change history

Everything here is **squash-merged**, so a comment comparing one commit to another is
wrong the moment the branch lands, and it documents work nobody will ever see.

Never write:

```ts
// previously this used a raw query
// renamed from fetchWidget
// now returns null instead of throwing
// as of the refactor, the service owns this
// kept for compatibility with the earlier commit
```

This also applies to READMEs and PR descriptions: document the end state, not the path to
it. If "why we did it this way" needs saying, put it in an **inline PR review comment**
(`gh pr review --comment`, or the Files-changed tab). It lives with the discussion and
leaves the permanent record clean.

### Nested READMEs

Longer-form prose lives here, judiciously:

- [src/server/README.md](src/server/README.md) — repository/service split, wiring, errors
- [src/server/jobs/README.md](src/server/jobs/README.md) — job shape, worker process
- [src/web/README.md](src/web/README.md) — state tiers, routes, typed RPC client
- [test/README.md](test/README.md) — the three projects, transactional DB fixtures

Add new ones sparingly. Link rather than duplicate — a fact written twice goes stale once.

## Layout

| Path                  | What belongs there                                      |
| --------------------- | ------------------------------------------------------- |
| `src/shared/`         | Zod schemas + DTO types used by **both** sides          |
| `src/server/`         | Hono API, Drizzle, pg-boss jobs                         |
| `src/web/routes/`     | One file per URL. Data fetching and mutations live here |
| `src/web/features/`   | Presentational components, grouped by feature           |
| `src/web/components/` | App-wide components. `ui/` is shadcn's — see below      |
| `src/web/lib/`        | `api.ts`, `queries.ts` (reads), `mutations.ts` (writes) |
| `src/web/hooks/`      | Shared hooks, if you write one                          |

## Server rules

1. **Repository** = data access only. **Service** = behaviour, rules, domain errors.
   Services depend on repository _interfaces_, never on `Database`.
2. Wire dependencies in `src/server/container.ts`. Nowhere else. No DI framework.
3. **Keep route handlers in one unbroken `.get().post()...` chain.** The chain is what
   builds the type `hc<AppType>()` reads on the frontend. Breaking it still works at
   runtime while the client's types silently collapse, with no error.
4. Schema changes: edit `src/server/db/schema.ts`, then `npm run db:push`. That's the
   whole loop — the DB test harness builds its template by pushing `schema.ts` too, so
   tests can't drift from the app.
5. Test template: `src/server/services/widget.service.test.ts` — the real service against
   a `mock<WidgetRepository>()`. No database, no Docker. Most tests belong here.
6. Tests that need real Postgres go in `*.db.test.ts` and use `dbTest` from
   `test/db/setup.ts` instead of `it`. Each one runs in a transaction that is rolled back,
   so there's no cleanup step — don't write one, and don't commit inside a test.

## Frontend rules

### State has exactly three tiers. There is no store.

1. **Server data → TanStack Query.** Read it through a `queryOptions` factory in
   `src/web/lib/queries.ts`; write it through a hook in `src/web/lib/mutations.ts`.
2. **Shareable UI state → the URL.** Filters, tabs, pagination, selected IDs. Use
   `validateSearch` with a zod schema — see `routes/widgets.index.tsx`.
3. **Ephemeral UI state → `useState`**, in the component that owns it.

**Do not add Redux, Zustand, Jotai, or a React context holding server data.** Nearly all
state here is a cached copy of server data and Query already handles caching, dedup,
refetching and invalidation. A second copy in a store or a context is a cache that
silently disagrees with the first one. Context is only for client-only cross-cutting
concerns, and today the app has none — if you think you need one, say so rather than
quietly adding it.

Never lift a filter out of the URL into `useState` or context. That loses reload and
shareability, which is the whole point of tier 2.

### Fetch in routes, render in components

Routes own queries, mutations and navigation. Components in `features/` take data as
props and do no fetching. That's what makes `widget-table.test.tsx` and
`widget-form.test.tsx` work with no fetch mocking and no QueryClient.

### Every mutation reports success and failure

Copy a hook from `src/web/lib/mutations.ts`. Each one calls the API through `unwrap`,
invalidates the affected queries, and toasts on both success and error. **A `useMutation`
without an `onError` fails silently** — the request 500s, the UI doesn't move, and the
next twenty minutes go into debugging the wrong layer.

Use `unwrapEmpty` instead of `unwrap` for a `204` response; `unwrap` always calls
`.json()` and an empty body throws _after_ the request succeeded.

### Forms

Copy `src/web/features/widgets/widget-form.tsx`. TanStack Form, validated with the shared
zod schema passed straight to `validators.onChange` — Zod 4 is a Standard Schema, so no
adapter is needed. Validate against the **no-defaults** base schema
(`widgetFieldsSchema`), not the `.default()`-carrying `createWidgetSchema`; a default makes
a field optional on the input side and the types won't line up.

The form takes an `onSubmit` prop; the route owns the mutation.

### Failure and loading are already handled

`main.tsx` sets `defaultErrorComponent`, `defaultPendingComponent` and
`defaultNotFoundComponent`, so every route inherits them. Don't add per-route error
handling unless a page genuinely needs something different, and **don't** wrap route
components in your own `try`/`catch` or `ErrorBoundary`.

Throw `notFound()` from a loader for a missing record. Let `unwrap`'s `ApiError`
propagate — `AppError` already renders the status and message.

### Components: shadcn + Radix

Behavioural components come from the CLI; styled elements are hand-written.

- **Anything with focus management, portals, overlays or keyboard nav** — dialog,
  dropdown-menu, popover, tooltip, tabs, command, sheet — install it:
  `npx shadcn@latest add <name>`. **Do not hand-roll it.** A hand-written modal with no
  focus trap and no scroll lock is the single most common serious bug in this category.
  Destructive confirmations already have a wrapper: `components/confirm-button.tsx`.
- **Zero-behaviour primitives** (badge, card, table) are hand-written in
  `components/ui/` in the house style — `cn()` plus `cva` when a component has variants.
- Import `cn` from `@web/lib/utils`. The CLI sometimes emits `import { cn } from "cn"`
  and installs an npm package for it; delete that and use the alias.
- The CLI also emits `"use client"`, which is meaningless in a Vite SPA. Delete it.
- **`badge.tsx` has house `success`/`warning` variants that upstream shadcn doesn't.**
  `scoreTone()` maps onto them. Re-running `shadcn add badge` would drop them.
- Tokens live in `src/web/index.css` in shadcn's two-layer shape: raw `--popover` in
  `:root`, re-exported as `--color-popover` in `@theme inline`. Generated components read
  **both** forms, so a missing token makes a component render unstyled with no error. Add
  new tokens to both blocks.
- The app is **dark-only**. There is no light palette and no `.dark` class.

### Devtools

Both panels are mounted in `routes/__root.tsx`, dev-only. The Query panel shows every
cache entry, its key and its freshness — check it before debugging "stale data" by
reading code.

## PRs and commits

PR descriptions are for a human reading quickly. Follow
[.github/pull_request_template.md](.github/pull_request_template.md), describe the diff
against the merge base, and keep it short — concise beats exhaustive. No per-commit
changelog, no file-by-file inventory.

Commit messages: one line about the change, not about the session that produced it.

## Things that are deliberately absent

Don't add these without asking:

- **Auth.** The app is assumed VPN-only. The hook point would be a middleware in
  `src/server/app.ts`.
- **Optimistic updates.** Not worth the snapshot/rollback dance on lists that refetch in
  under 100ms.
- **A light theme**, a global store, a component library other than shadcn, Prettier,
  ESLint, and a second build pipeline for the server.
