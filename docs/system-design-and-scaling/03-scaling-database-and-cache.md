# Scaling, PostgreSQL, Redis, and caching

## The two ways to scale a backend

### Vertical scaling

Give the backend more CPU or memory.

Use it when:

- the application still fits comfortably on one instance;
- it buys meaningful headroom at acceptable cost;
- horizontal coordination would add unnecessary complexity.

Limitations:

- every plan has a ceiling;
- one instance still has a larger failure blast radius;
- it does not independently scale queues, realtime connections, or database
  work.

### Horizontal scaling

Run multiple copies of the backend and distribute traffic between them.

Railway can provide replicas and public load balancing. The application still
has to be safe when any request or connection lands on any replica.

Horizontal scaling requires:

- no authoritative state stored only in one backend process;
- shared authentication and authorization state;
- distributed rate limits;
- cross-instance realtime fan-out;
- queues and schedulers that are single-owner or idempotent;
- sensible database connection limits across all replicas.

Adding replicas multiplies possible database connections and query concurrency.
It can move the bottleneck from the backend to PostgreSQL.

## Recommended scaling order

Use the least complex step that addresses the measured bottleneck:

1. Remove accidental excess work and response size.
2. Fix slow queries and add targeted indexes.
3. Apply pagination and bounded inputs.
4. Tune connection pooling and concurrency.
5. Increase vertical capacity if cost-effective.
6. Cache a proven hot, repeatable read if freshness permits.
7. Add backend replicas after distributed-state requirements are satisfied.
8. Add database read replicas only for a proven read bottleneck.
9. Partition or shard only when one database can no longer meet measured
   storage or throughput needs.

## PostgreSQL overload

Common symptoms:

- rising query latency;
- exhausted database connections;
- increased lock waits;
- high CPU or disk input/output;
- API requests waiting on database calls;
- queue processors slowing down at the same time as the API.

The first question is not "should we add Redis?" It is "which query or
connection pattern is consuming the capacity?"

### Query and index discipline

Indexes make selected reads faster but make writes and storage more expensive.
Add them for observed access patterns:

- frequent lookup or join columns;
- common ordered/paginated paths;
- uniqueness and business constraints;
- selective filters that avoid large scans.

Do not index every column. Use query plans and production-like data volumes to
verify benefit.

### Connection pooling

Every backend process can open a pool of database connections. If one replica
uses a pool of `N`, then several replicas may attempt roughly `replicas × N`
connections, plus migrations, workers, and operational tools.

Before horizontal scaling:

- establish the database connection ceiling;
- budget connections per process and workload;
- monitor pool wait time and active/idle connections;
- ensure deploy overlap does not unexpectedly double connection demand.

### Read replicas

Read replicas can move eligible reads away from the primary, but they introduce
replication lag.

Suitable eventually consistent reads might include:

- aggregate dashboards where a short delay is acceptable;
- historical lists;
- public or shared catalogue data.

Reads that normally require current primary data include:

- authorization and entitlement decisions;
- immediately reading a user's recent write;
- approval and billing state;
- idempotency or one-time claim decisions;
- security revocation.

Relay should classify consistency requirements before routing any query to a
replica.

### Backups are not replicas

A replica copies valid writes and accidental destructive writes. It provides
availability, not historical recovery.

A backup provides a recoverable point in time. Relay needs both appropriate
availability and independently restorable backups. The current launch
checklist records backup and restore work, but live retention, access, and
recovery objectives must remain operationally verified.

## What a cache is

A cache stores a temporary copy of an answer so repeated requests do not repeat
the expensive work.

```text
request
  |
  v
cache lookup -- hit --> return cached value
  |
 miss
  v
PostgreSQL query --> store temporary value --> return value
```

Good cache candidates have all of these properties:

- many requests ask for the same result;
- computing or fetching it is meaningfully expensive;
- the answer can be slightly old, or invalidation is reliable;
- cache keys can enforce exact tenant and user scope;
- a cache miss still works correctly.

Poor cache candidates include:

- authorization, revocation, billing, or approval decisions;
- highly personalised results with little key reuse;
- rapidly changing data;
- one-off queries;
- writes and transactional decisions.

## Cache safety requirements

If Relay introduces shared application caching, document:

1. **Source of truth** — normally PostgreSQL.
2. **Cache key** — including tenant, user, permission scope, version, and query
   inputs where required.
3. **Freshness contract** — maximum tolerated staleness.
4. **Invalidation** — expiry, active deletion, versioning, or a combination.
5. **Stampede protection** — one refresh owner, jittered expiry, proactive
   refresh, or bounded stale serving.
6. **Eviction behavior** — what happens when Redis is full.
7. **Failure behavior** — whether the request falls back to PostgreSQL, fails
   closed, or returns a bounded degraded response.
8. **Metrics** — hit rate, miss rate, refresh duration, error rate, and bytes.

### Cache invalidation

Two common approaches:

- **Time to live:** automatically expire a value after a short period. Simple,
  but users may see stale data until expiry.
- **Active invalidation:** delete or version the cached value when the source
  changes. Fresher, but every write path must participate correctly.

Security-sensitive state should not depend on a long time to live.

### Cache stampede

A stampede occurs when one popular entry expires and many requests rebuild it
simultaneously, sending the original surge back to PostgreSQL.

Possible controls:

- allow one request to refresh while others wait;
- refresh hot entries before expiry;
- add random jitter to expiries;
- briefly serve an older safe value while refreshing;
- apply request coalescing or rate limits.

## Redis is also a dependency

Moving work into Redis does not make it disappear. Redis has memory, connection,
throughput, and availability limits. A cache should be disposable, while
security and coordination uses may need stricter failure behavior.

Relay currently has different Redis failure policies for different purposes.
For example, one-time security state fails closed, while distributed rate
limits have bounded local degraded enforcement. Preserve those explicit
semantics rather than treating every Redis use as interchangeable.

## Sharding

Sharding splits authoritative data across multiple database partitions. It
adds routing, rebalancing, cross-shard query, transaction, backup, and recovery
complexity.

Use it only when:

- one primary cannot meet measured storage or write throughput;
- vertical scaling, retention, partitioning, indexing, and query work are
  insufficient;
- the team can operate shard routing and recovery safely.

Early Relay Console does not need application-level sharding merely because it
is a standard system-design topic.
