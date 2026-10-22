# Tests

Three Vitest projects, so the fast ones stay fast:

| Project  | What                                | Needs Postgres  |
| -------- | ----------------------------------- | --------------- |
| `server` | Unit tests. Most tests belong here. | no              |
| `db`     | `*.db.test.ts`, real Postgres.      | `npm run db:up` |
| `web`    | Components in jsdom.                | no              |

`npm run test:unit` runs `server` + `web`, so you can work with Docker stopped.
`npm test` runs all three.

## Unit tests are the default

`src/server/services/widget.service.test.ts` is **the template** — copy it. It runs the
real service against a `mock<WidgetRepository>()` from
[vitest-mock-extended](https://www.npmjs.com/package/vitest-mock-extended), so there's no
database and it finishes in milliseconds.

Mocking the interface rather than hand-rolling a fake means adding a method to the
repository can't silently leave a gap in the stub, and tests can assert on interactions
(`expect(widgets.create).not.toHaveBeenCalled()`) as well as return values. Shared data
builders live in `factories.ts`.

## DB tests: transactional fixtures

Same pattern as Rails' transactional fixtures or Django's `TestCase`. `global-setup.ts`
creates `app_test` and pushes `schema.ts` into it once per run; then every test runs inside
a transaction that is rolled back afterwards. Nothing is ever committed, so there's no
cleanup step and no way for one test's rows to leak into another.

Use `dbTest` instead of `it`:

```ts
dbTest('does a thing', async ({ db }) => {
  const repo = createWidgetRepository(db) // db is the transaction
})
```

Workers share the one database safely, because uncommitted rows are invisible to other
connections. The one thing to know: two tests inserting the same unique value concurrently
block each other until the first rolls back. Correct, just slower.

`Database` is typed as `PgDatabase` rather than `PostgresJsDatabase` so a transaction
handle satisfies it — which is also what would let a service span several repositories in
one transaction later.

Because the harness derives its schema from `schema.ts` and never from committed SQL,
`npm run db:push` is safe as the default workflow and tests can't drift from the schema.
