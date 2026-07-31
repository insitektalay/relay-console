# Relay Console system design and scaling handbook

Last reviewed: 2026-07-29

This handbook explains, in plain language, how Relay Console is hosted, what can
fail as usage grows, which protections already exist, and when additional
infrastructure is justified.

It is a learning and operations guide for self-hosters. Use
[`../BETA_OPERATIONS.md`](../BETA_OPERATIONS.md) for deployment and incident
procedures. Maintainers keep production launch records outside the public
source snapshot.

## The short version

Relay Console is not one server:

- Vercel serves the browser application.
- Railway runs the shared NestJS backend and WebSocket endpoint.
- PostgreSQL is the durable source of truth.
- Redis supports queues, rate limiting, one-time realtime credentials, and
  cross-instance runtime coordination.
- The macOS, iPhone, iPad, and browser applications are clients.
- Customer-operated paired runtimes perform agent work on customer machines and
  connect outbound to Railway.

Most advanced scaling work should wait until measurements justify it. Relay
should not add a general query cache, microservices, database read replicas, or
sharding merely because those components appear in a system-design course.

Some reliability work belongs before launch:

1. Establish a measured initial capacity with a production-like load test.
2. Confirm monitoring, alert ownership, backups, and restore procedures.
3. Know the deployed Railway topology and resource limits.
4. Do not enable multiple backend replicas until ordinary client realtime
   fan-out has been validated across instances.
5. Preserve rate limits, bounded queues, and graceful failure messages.

After launch, actual usage should determine the next change.

## Reading order

1. [`01-current-architecture.md`](01-current-architecture.md) — what runs where.
2. [`02-failure-modes-and-risk-register.md`](02-failure-modes-and-risk-register.md) — what can break and how likely it is.
3. [`03-scaling-database-and-cache.md`](03-scaling-database-and-cache.md) — servers, PostgreSQL, Redis, indexes, caches, replicas, and sharding.
4. [`04-realtime-queues-and-runtimes.md`](04-realtime-queues-and-runtimes.md) — WebSockets and paired runtime implications.
5. [`05-launch-and-growth-playbook.md`](05-launch-and-growth-playbook.md) — what to do before launch and after launch.
6. [`06-load-testing-and-observability.md`](06-load-testing-and-observability.md) — how to measure capacity safely.
7. [`07-glossary.md`](07-glossary.md) — beginner-friendly definitions.

## Governing principle

Choose infrastructure from evidence:

```text
measure → identify the bottleneck → make the smallest safe change → measure again
```

User count alone is not a capacity measurement. Ten thousand people viewing a
public page is a different workload from ten thousand authenticated people
opening WebSockets or dispatching agent work at the same moment.

## Provider references

These provider documents describe capabilities, not Relay's currently enabled
deployment settings:

- [Railway scaling](https://docs.railway.com/deployments/scaling)
- [Railway WebSocket scaling guidance](https://docs.railway.com/guides/socketio)
- [Railway health checks](https://docs.railway.com/deployments/healthchecks)
- [Vercel rewrites](https://vercel.com/docs/project-configuration#rewrites)
