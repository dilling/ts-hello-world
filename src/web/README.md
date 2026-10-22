# Web

React 19 + Vite, TanStack Router (file-based) and Query, Tailwind + shadcn/ui on Radix.

## State: three tiers, and that's the policy

1. **Server data → TanStack Query.** Reads through the `queryOptions` factories in
   `lib/queries.ts`, writes through a hook in `lib/mutations.ts`.
2. **Shareable UI state → the URL**, as typed search params validated by a zod schema.
   Filters, tabs, pagination, selected IDs.
3. **Ephemeral UI state → `useState`** in the component that owns it.

There is deliberately **no Redux or Zustand, and no context holding server data**. Nearly
all state in a dashboard like this is a cached copy of the server's, which Query already
handles — a second copy is a cache that disagrees with the first.

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

Routes own queries, mutations and navigation; components in `features/` take data as props
and do no fetching. That's what lets `widget-table.test.tsx` and `widget-form.test.tsx`
run with no fetch mocking and no QueryClient.

`routeTree.gen.ts` is generated but committed — `tsc --noEmit` needs it, so a fresh clone
can't typecheck without it. Don't hand-edit it.

## Writes

Every hook in `lib/mutations.ts` unwraps the response, invalidates what it changed, and
toasts both outcomes. A `useMutation` with no `onError` fails silently, which is the most
expensive kind of bug to chase: the request fails, the UI doesn't move, and nothing points
at the network.

## Forms

`features/widgets/widget-form.tsx` is the template. TanStack Form, with the shared zod
schema handed straight to `validators.onChange` — Zod 4 implements Standard Schema, so
there's no adapter package and no second copy of the validation rules.

Validate against `widgetFieldsSchema`, the no-defaults base, rather than
`createWidgetSchema`: a `.default()` makes a field optional on the schema's _input_ side,
while a form always holds a concrete value for every control.

The form takes an `onSubmit` prop and the route owns the mutation, which is why the form
tests need no QueryClient and no router.

## Failure and loading

`main.tsx` registers `defaultErrorComponent`, `defaultPendingComponent` and
`defaultNotFoundComponent` on the router, so every route — including ones added later —
gets them for free.

This matters more than it looks. Every route fetches with `useSuspenseQuery`, which
_throws_ on error by design. With no error component the throw unmounts the page and
TanStack falls back to its own minimal renderer, so a failed API call reads as "the app
died" and sends you debugging the wrong layer.

## Components

Behavioural components (dialog, select, dropdown, popover, tooltip) come from
`npx shadcn@latest add <name>` — hand-rolling them means hand-rolling focus traps, scroll
locking and `aria` wiring, and getting it wrong invisibly. Zero-behaviour primitives like
`badge.tsx` and `card.tsx` stay hand-written.

Design tokens in `index.css` use shadcn's two-layer shape: the raw token in `:root`
(`--popover`), re-exported as a Tailwind token in `@theme inline` (`--color-popover`).
Generated components read both forms, so declare new tokens in both blocks — a missing one
renders a component unstyled with no error. The app is dark-only; there is no light
palette.

## Typed RPC client

`lib/api.ts` is `hc<AppType>()` against the server's own route type: no codegen, no
OpenAPI spec, no duplicated interfaces. Rename a field in a route handler and
`npm run typecheck` fails here. See [src/server/README.md](../server/README.md) for the
two things on the server side that keep that type honest.

Hono's client doesn't throw on 4xx, and a route that can fail has a **union** response
type, so `(await res.json()).widgets` doesn't typecheck — the error variant has no
`widgets`. `unwrap()` narrows to the success body and throws on errors, which is what
makes Query's `isError` and the router's error component work. Use `unwrapEmpty` for a
`204`: `unwrap` always calls `.json()`, and an empty body throws _after_ the request
succeeded.
