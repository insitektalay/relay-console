# Launch and growth playbook

## Guiding answer

Most advanced scale architecture can wait until Relay has real usage. Basic
capacity and recovery evidence cannot wait until an incident.

The correct split is:

```text
Before launch: prove safe minimums and know the limits.
After launch: observe real behavior and scale the measured bottleneck.
```

## Before launch: minimum responsible work

These items are justified even for a small launch:

- [ ] Complete the canonical production-limit load-test row for HTTP,
      WebSockets, dispatch, queues, scanner, and reconciliation.
- [ ] Record the actual Railway backend replica count, regions, CPU/memory
      ceilings, restart behavior, and deployment draining behavior.
- [ ] Record PostgreSQL storage, connection, backup, retention, and failover
      configuration without exposing credentials.
- [ ] Record Redis capacity and availability expectations.
- [ ] Confirm live and ready health checks and public uptime monitoring.
- [ ] Assign an owner for alerts, incidents, provider configuration, and status
      updates.
- [ ] Confirm restore evidence and acceptable recovery objectives.
- [ ] Establish a baseline for API latency, error rate, database latency,
      connections, Redis, queue age, and WebSocket connections.
- [ ] Document that multiple backend replicas require distributed ordinary
      realtime fan-out and scheduler review.
- [ ] Keep rate limits, input bounds, and safe retry behavior enabled.

This is not a demand to support ten thousand simultaneous active users before
the first launch. It is a demand to understand what the initial deployment can
support and how it fails.

## Do not build before launch without evidence

- [ ] Do not introduce microservices solely for future scale.
- [ ] Do not add a general PostgreSQL query cache solely for future scale.
- [ ] Do not add database read replicas without a measured read bottleneck and
      consistency classification.
- [ ] Do not shard the application database.
- [ ] Do not add multi-region state merely for an architecture diagram.
- [ ] Do not increase backend replicas without validating realtime and
      scheduled-work behavior.

## Immediately after launch

### First 24 hours

- Watch authentication, HTTP errors, WebSocket disconnects, database
  connections, Redis errors, queue age, and runtime dispatch failures.
- Compare traffic and cost against the tested baseline.
- Investigate sustained degradation rather than isolated short spikes.
- Record the first real peak-hour baseline.

### First week

- Review the slowest and most frequent database queries.
- Review rate-limit events and determine whether they represent abuse,
  client retry bugs, or legitimate demand.
- Review reconnect patterns and client versions.
- Review customer-runtime offline rates separately from platform availability.
- Review provider throttling and retry behavior.
- Forecast storage and compute cost using active-customer behavior.

### First month

- Update capacity assumptions with real percentiles and peak concurrency.
- Repeat a production-like load test with the observed request mix.
- Decide whether the next bottleneck is code, PostgreSQL, Redis, WebSockets,
  runtime capacity, or an external provider.
- Make one targeted change and remeasure.

## Trigger-based decisions

These are decision signals, not universal automatic thresholds.

| Evidence | Likely next investigation |
| --- | --- |
| Backend CPU is sustained while database and Redis remain healthy | Expensive application work, concurrency tuning, vertical capacity, then replicas |
| Backend memory grows with active WebSockets | Per-connection state, buffers, leaks, connection limits, replica planning |
| API latency follows database latency | Slow queries, indexes, pool waits, database capacity |
| Database connections approach the service ceiling | Pool budgets, replica count, deploy overlap, connection proxying |
| A small set of identical safe reads dominates database work | Carefully scoped cache candidate |
| Queue oldest-job age continually rises | Consumer capacity, job cost, retries, backpressure |
| Redis latency or memory pressure rises | Key/cardinality review, queue volume, plan capacity, eviction policy |
| Reconnects cause short authentication spikes | Client backoff/jitter and ticket/session capacity |
| One backend workload dominates all others | Consider separating that worker or service |
| Read traffic exceeds primary database capacity | Classify consistency, then evaluate read replicas |
| One primary cannot meet measured storage/write needs | Partitioning and retention first; sharding last |

## Suggested decision records

When a scale change is approved, record:

- the observed metric and time range;
- the user-visible symptom;
- the tested bottleneck;
- alternatives considered;
- expected benefit and cost;
- new failure modes introduced;
- rollback plan;
- post-change validation result.

This prevents infrastructure from accumulating without a reason.

## Incident sequence

When Relay slows down:

1. Confirm whether the public web application and Railway live endpoint respond.
2. Check Railway readiness for PostgreSQL, Redis, and queues.
3. Separate platform, customer-runtime, and external-provider failures.
4. Inspect latency, error, saturation, connection, and queue metrics.
5. Apply the safest bounded mitigation: reject excess work, reduce concurrency,
   pause nonessential work, or increase already-validated capacity.
6. Avoid deploying an untested architectural rewrite during the incident.
7. Preserve a timeline and perform a short post-incident review.

## When to revisit this handbook

Review it:

- before public launch;
- before enabling multiple Railway backend replicas;
- after the first meaningful traffic spike;
- when p95 latency or error rate materially changes;
- before adding a shared cache, read replica, new worker service, or region;
- during each capacity and recovery review.
