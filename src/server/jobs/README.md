# Jobs

pg-boss, running in the same process as the HTTP server. Queue tables live in a separate
`pgboss` schema in the same Postgres.

## The shape of a job

`refresh-widgets.job.ts` is the template. Three parts, and keeping them separate is the
point:

1. `QUEUE_NAME` and the payload type — the contract.
2. `register()` — creates the queue, attaches the handler, declares the schedule.
3. The handler — a **thin trigger that calls a service**. It must not hold business logic,
   or that logic becomes untestable without a running queue.

A real poller is this file with a different service call.

Handlers receive a **batch** of jobs. With `batchSize: 1` that's an array of one, but
writing the loop now means raising it later is a config change rather than a rewrite.

## Registering one

Add a line to `JOB_REGISTRATIONS` in `worker.ts`. That's the whole step.

## Splitting the worker out

It runs in-process so there's one thing to deploy. To separate it: add a
`src/server/worker-entry.ts` that builds the container and calls `startWorker`, then drop
the `startWorker` call from `index.ts`. Nothing else changes.
