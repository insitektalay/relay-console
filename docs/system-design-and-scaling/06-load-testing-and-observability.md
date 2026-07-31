# Load testing and observability

## Purpose

A load test answers a bounded question such as:

> Can the current production-shaped deployment support the expected launch
> workload with acceptable latency, errors, queue age, and dependency
> headroom?

It does not prove unlimited scale.

The canonical launch checklist currently requires production-limit testing of
HTTP, WebSocket, dispatch, queue, scanner, and reconciliation paths. This
handbook describes the planning model; the canonical checklist owns launch
acceptance.

## Define workloads before choosing a user count

Model separate scenarios:

1. Public website browsing.
2. Authentication and account creation.
3. Authenticated dashboard reads.
4. Thread and message reads/writes.
5. Sustained idle WebSockets.
6. Active WebSocket messages and subscriptions.
7. WebSocket disconnect and reconnect storm.
8. Agent/runtime dispatches.
9. Background queue processing.
10. Marketplace/provider operations with safe fakes or approved test accounts.
11. Relay sync, scanner, and reconciliation work.

For each scenario define:

- requests or events per second;
- concurrent users or sockets;
- payload sizes;
- read/write ratio;
- test duration;
- acceptable p50, p95, and p99 latency;
- acceptable error and throttling rates;
- maximum queue age;
- expected database and Redis headroom.

## Safe test progression

1. Test one path at low concurrency to validate the test itself.
2. Run a representative mixed workload.
3. Increase gradually while monitoring every dependency.
4. Hold expected peak long enough to expose pool and queue behavior.
5. Introduce a short controlled spike.
6. Test recovery after load returns to normal.
7. Test reconnect behavior separately.
8. Stop before causing customer impact or unsafe provider actions.

Use a hosted production-like Railway environment with production-shaped
configuration and non-customer test data. Do not treat a developer-only
backend process as production capacity evidence.

## Measurements to collect

### Vercel

- page and function latency where applicable;
- HTTP errors;
- rewrite failures;
- deployment and origin errors.

### Railway backend

- CPU and memory;
- instance restarts;
- request throughput and latency;
- response status distribution;
- event-loop delay if instrumented;
- active WebSockets and connection rate;
- inbound/outbound WebSocket frames and bytes;
- disconnect reasons.

### PostgreSQL

- active, idle, and waiting connections;
- pool wait time;
- transaction and query latency;
- slow-query fingerprints;
- lock waits and deadlocks;
- CPU, memory, disk input/output, and storage growth.

### Redis

- command latency;
- connections;
- memory and key count;
- evictions;
- queue depth and oldest-job age;
- publish/subscribe errors;
- reconnects.

### Runtimes and external providers

- connected/stale/offline host count;
- dispatch acceptance and completion latency;
- stuck and failed dispatches;
- provider `429` and `5xx` responses;
- retry count and backoff behavior.

## Pass/fail model

Approve a tested capacity only when:

- latency objectives hold for the full test window;
- errors and throttling remain within the declared budget;
- no dependency approaches an unexplained hard ceiling;
- queues recover after the spike;
- WebSocket subscriptions and events remain correct;
- no cross-tenant or authorization behavior changes under load;
- costs are recorded;
- the system returns to its baseline after the test.

Record the result as a capacity envelope:

```text
deployment shape + workload mix + duration + observed result + date
```

Do not summarize it merely as "supports 10,000 users."

## Starter operational signals

Every important service should expose or provide:

- **Latency:** how long successful work takes.
- **Traffic:** how much work arrives.
- **Errors:** what proportion fails or is rejected.
- **Saturation:** how close CPU, memory, connections, queues, or storage are to
  their limits.

Alerts should be actionable. An alert needs:

- an owner;
- a user-impact statement;
- a threshold and duration;
- a safe first diagnostic;
- a runbook link;
- an escalation path.

## Capacity record template

```markdown
# Capacity run YYYY-MM-DD

## Deployment shape

- Backend replicas and regions:
- Backend CPU/memory limits:
- PostgreSQL tier and connection ceiling:
- Redis tier:
- Client/test build:

## Workload

- Scenario mix:
- Duration:
- Concurrent HTTP users:
- Concurrent WebSockets:
- Requests/events per second:
- Dispatches per minute:

## Objectives

- p95 API latency:
- Error budget:
- Maximum queue age:
- Recovery time:

## Results

- First bottleneck:
- Maximum safe tested load:
- Resource headroom:
- Correctness observations:
- Cost:

## Decision

- Accepted envelope:
- Required remediation:
- Next retest trigger:
```
