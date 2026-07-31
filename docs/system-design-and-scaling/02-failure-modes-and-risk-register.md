# Failure modes and risk register

## How to read the ratings

The likelihood labels are qualitative planning judgements, not measured
probabilities:

- **Current low** — unlikely at present usage, but still possible.
- **Growth-dependent** — becomes plausible only as observed load rises.
- **Conditional** — introduced by a future architecture choice.
- **Unknown** — provider configuration or load evidence is required.

Impact and likelihood are different. A database loss may be unlikely but still
deserves backups because its impact would be severe.

## Risk register

| Failure mode | Can Relay experience it? | Rough likelihood | Current protection or limitation | Required posture |
| --- | --- | --- | --- | --- |
| Backend CPU or RAM saturation | Yes | Growth-dependent; higher during a sudden active-user surge | Railway provides resource limits and can run replicas | Establish baseline capacity; scale only from measurements |
| Too many backend requests | Yes | Growth-dependent | Distributed rate limiting, request bounds, health reporting | Monitor throughput, latency, rejection rate, and errors |
| PostgreSQL overload | Yes | Growth-dependent | Indexed relational database and bounded API inputs | Measure query latency/connections; optimise before caching |
| PostgreSQL storage exhaustion | Yes | Current low | Large arbitrary files and unbounded binaries are kept out of the control-plane database | Monitor storage growth and forecast exhaustion |
| Redis overload or outage | Yes | Current low but operationally important | Readiness checks; bounded local degradation for rate limits; security tickets fail closed | Alert on dependency degradation and recovery |
| Queue backlog | Yes | Growth-dependent | Bull queue and readiness checks | Monitor oldest-job age, failures, and retry volume |
| Backend instance crash | Yes | Current low | Railway process supervision and health checks | Confirm restart behavior and desired replica topology |
| Railway regional/platform outage | Yes | Current low, high impact | Managed hosting; multi-region replicas are possible | Accept initially or plan multi-region only when business requirements justify it |
| Vercel outage | Yes | Current low | Managed frontend platform | Monitor public web availability; avoid inventing a second frontend stack prematurely |
| Database instance failure | Yes | Unknown without live topology evidence | Backups and restore rehearsals are recorded; managed database behavior depends on the selected service tier | Verify live failover and backup configuration |
| Accidental destructive database change | Yes | Current low, severe impact | Migration controls, production safety gates, backups, restore rehearsal | Keep independent backups and rehearse restore; replicas alone are insufficient |
| Ordinary WebSocket event misses across backend replicas | Yes | Conditional on horizontal scaling | Subscriptions are process-local; bridge routing has a Redis bus | Fix or prove distributed client fan-out before multiple replicas |
| WebSocket connection surge | Yes | Growth-dependent | Authentication deadlines, frame bounds, distributed rate limits | Load-test connection establishment, sustained sockets, reconnect storms, and memory |
| Paired runtime offline | Yes | Expected customer-level event | Availability is reported separately from platform health | Show clear offline state; do not classify one host as a platform outage |
| Runtime dispatch surge | Yes | Growth-dependent | Durable dispatch state, bounded inputs, coordination | Monitor dispatch age, stuck work, and per-host capacity |
| External AI or Marketplace provider throttling | Yes | Growth-dependent and provider-specific | Provider error mapping, action bounds, rate limits, approvals | Back off safely and expose a clear retry state |
| Stale general application cache | Not broadly today | Conditional on adding a query cache | No general Redis query cache currently exists | Design invalidation and tenant-safe keys before introducing one |
| Cache stampede | Not broadly today | Conditional on adding hot-data caching | No general hot-data cache currently exists | Use single-flight refresh, jittered expiry, or stale-while-refresh if later needed |
| Read-replica lag | Not established today | Conditional on adding database read replicas | No checked-in evidence of application read-replica routing | Define which reads may be eventually consistent before adding replicas |
| Missing or ineffective database indexes | Yes | Growth-dependent | Existing schema contains indexes, but access patterns evolve | Use slow-query evidence; do not index every column |
| Monolith scales inefficiently | Yes | Growth-dependent | One backend deployment contains many modules and some workers | Keep the monolith until one workload has a measured independent-scaling reason |
| Duplicate scheduled work across replicas | Possibly | Conditional on horizontal scaling | Scheduled work is hosted in the backend; individual ownership/idempotency varies | Audit every scheduler before increasing replicas |
| Database becomes too large for one primary | Yes in theory | Very low at early product scale | PostgreSQL vertical growth and data-retention controls come first | Consider partitioning/sharding only after measured limits |
| Hot database shard | Not currently applicable | Conditional on future sharding | The database is not application-sharded | Avoid sharding until necessary; select a measured shard key if ever required |
| Security failure caused by shared cache keys | Conditional | Conditional on caching user data | Authorization remains in the backend | Cache keys must include exact tenant/user scope; never cache authorization decisions casually |
| Cost spike | Yes | Growth-dependent | Usage-based hosting, rate and input bounds | Monitor cost per active customer and set provider budgets/alerts |

## Highest-priority risks around launch

These are more relevant than speculative sharding:

1. Unknown real capacity because the production-limit load test is still open.
2. Monitoring and operational ownership not fully evidenced in the canonical
   launch checklist.
3. Cross-replica ordinary WebSocket fan-out if backend replicas are increased.
4. PostgreSQL and Redis dependency behavior under active-user bursts.
5. Reconnect storms during deploys or transient network failures.
6. External provider throttling and customer runtime unavailability.

## Problems that should not trigger pre-emptive redesign

Do not implement these without evidence:

- microservices merely to make the architecture look mature;
- a general Redis cache for all database responses;
- database read replicas before read load requires them;
- multi-region writes before availability requirements justify the complexity;
- database sharding for hypothetical millions of customers;
- a second hosting provider solely because one provider could theoretically
  fail.
