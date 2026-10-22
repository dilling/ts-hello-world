# Web

React 19 + Vite, TanStack Router (file-based) and Query, Tailwind + shadcn/ui.

## State: two tiers, and that's the policy

1. **Server-derived data → TanStack Query**, via the `queryOptions` factories in
   `lib/queries.ts`.
2. **Ephemeral UI state → `useState`** in the component that owns it.

Filters and anything shareable go in the **URL** as typed search params, not `useState`.

There is deliberately **no Redux or Zustand**. Nearly all state in a dashboard like this
is a cached copy of server data, and Query already handles caching, refetching, dedup and
invalidation. If you genuinely need cross-route client state (a wizard, say), reach for a
React context and raise it with the team first.

`queryOptions` keeps the key and the fetcher in one object, so a key can't drift from its
query, and the same object works in a route loader, a `useQuery`, and an
`invalidateQueries` call.

## Routes

`routes/widgets.index.tsx` is the data-driven route template:

- `validateSearch` with a zod schema gives typed, validated URL state that survives reload
  and is shareable.
- `loader` prefetches through the same `queryOptions` the component consumes, so
  navigation doesn't flash a spinner.
- `useSuspenseQuery` then reads from cache and never returns `undefined`, which removes
  the usual `if (!data) return null` noise.

`routeTree.gen.ts` is generated but committed — `tsc --noEmit` needs it, so a fresh clone
can't typecheck without it. Don't hand-edit it.

## Typed RPC client

`lib/api.ts` is `hc<AppType>()` against the server's own route type: no codegen, no
OpenAPI spec, no duplicated interfaces. Rename a field in a route handler and
`npm run typecheck` fails here. See [src/server/README.md](../server/README.md) for the
two things on the server side that keep that type honest.

Hono's client doesn't throw on 4xx, and a route that can fail has a **union** response
type, so `(await res.json()).widgets` doesn't typecheck — the error variant has no
`widgets`. `unwrap()` narrows to the success body and throws on errors, which is what
makes Query's `isError` and React error boundaries work.
