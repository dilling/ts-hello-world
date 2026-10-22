# Server

Hono on Node, layered repository → service → route, wired in one place.

## Repository / service split

A **repository** is data access only — queries in, domain objects out. No business rules,
no logging, no HTTP. `widget.repository.ts` is the shape to copy for a new entity:
interface, row mapper, Drizzle factory.

A **service** owns behaviour: business rules, orchestration across repositories, domain
errors. It depends on repository _interfaces_, never on `Database`. That's what lets
`widget.service.test.ts` run the real service against a `mock<WidgetRepository>()` with no
Postgres and no Docker — see [test/README.md](../../test/README.md).

Services deliberately expose both shapes of lookup: `findById` returns `null`, `getById`
throws `NotFoundError`. Routes want the throwing one and let the error boundary do the
rest; callers that can cope with absence want the nullable one. Being explicit avoids a
lot of `if (!x) return c.json(...)`.

The repository is also the **serialization boundary**: `Date` columns become ISO strings
there, so every layer above it sees one consistent `Widget`. See `src/shared/widget.ts`.

## Wiring

`container.ts` is the only place dependencies are constructed. Everything else takes them
as arguments — no DI framework, no decorators. `buildApp()` takes its deps as an argument
rather than importing the container, so a test can hand it fakes and exercise real routing
with no database (`routes/widgets.test.ts`).

## Errors

`app.ts` has a single `onError` boundary: `AppError` subclasses become their declared
status, anything else is a 500 whose detail is logged rather than leaked. Request
validation never reaches it — `lib/validator.ts` responds directly, using the same body
shape.

## End-to-end types

`AppType` is exported from `app.ts` and is the one source the frontend's RPC client builds
from ([src/web/README.md](../web/README.md)). Two things keep it honest, and both are easy
to break silently:

- Routes must be **one unbroken method chain**. Break it and the client's types quietly
  degrade with no error.
- Conditional middleware (the SPA static handler) is mounted as **statements**, not
  chained onto the app, because chaining would widen the inferred type.

## Environment

`env.ts` parses once at boot and fails loudly. It takes `source` as an argument instead of
reading `process.env` at module scope, so tests can pass a fixture — and so the production
guard can tell a defaulted value from a supplied one, which is indistinguishable after
parsing.

`DATABASE_URL` defaults to the local compose database so a fresh clone runs with no `.env`.
That default is a footgun in production, hence the guard.
