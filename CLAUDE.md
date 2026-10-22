# Working in this repo

Run `npm run ci` (lint + typecheck + test) before you call anything done. `npm run test:unit`
needs no Docker; the `db` project needs `npm run db:up`.

## Comments

Write a comment when the code genuinely can't say it itself:

- a footgun — the obvious approach here is wrong, and here's the symptom
- a constraint imposed from outside (a library's requirement, a wire format, an ordering)
- the contract of an exported interface or a non-obvious parameter

Don't restate the code, don't explain the obvious, and don't write architecture essays.
**No paragraphs.** If an explanation needs one, it belongs in the nearest README with a
one-line pointer at the code:

```ts
// Two-tier state; no global store. See src/web/README.md.
```

Comments describe the code as it is now — never why it changed.

## Never narrate change history

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

## Nested READMEs

Longer-form prose lives here, judiciously:

- [src/server/README.md](src/server/README.md) — repository/service split, wiring, errors
- [src/server/jobs/README.md](src/server/jobs/README.md) — job shape, worker process
- [src/web/README.md](src/web/README.md) — frontend state, typed RPC client
- [test/README.md](test/README.md) — the three projects, transactional DB fixtures

Add new ones sparingly. Link rather than duplicate — a fact written twice goes stale once.

## PRs and commits

PR descriptions are for a human reading quickly. Follow
[.github/pull_request_template.md](.github/pull_request_template.md), describe the diff
against the merge base, and keep it short — concise beats exhaustive. No per-commit
changelog, no file-by-file inventory.

Commit messages: one line about the change, not about the session that produced it.

---

The comments left in `src/` are load-bearing gotchas, not a length to imitate.
