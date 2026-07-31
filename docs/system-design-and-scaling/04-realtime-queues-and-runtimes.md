# Realtime, queues, and paired runtimes

## Why WebSockets scale differently

An HTTP request is short-lived. A load balancer can send each new request to
any healthy backend replica.

A WebSocket is a long-lived connection attached to one specific backend
process. If ten thousand users keep a socket open, the backend must retain ten
thousand live connections, authentication scopes, subscription records, and
inbound/outbound buffers.

Important capacity dimensions include:

- simultaneous connections;
- connection rate;
- messages per connection per second;
- bytes per frame and per second;
- subscription count;
- reconnect rate after a deployment or outage;
- memory and file descriptors per connection;
- slow consumers that cannot receive events quickly.

## Current Relay realtime posture

The Relay gateway currently keeps client sockets and ordinary user, workspace,
and thread subscriptions in process-local maps.

That is valid for one backend instance. With multiple replicas:

1. A user's WebSocket may be connected to replica A.
2. An API request that changes their data may be handled by replica B.
3. Replica B cannot directly see replica A's in-memory socket.
4. Without distributed fan-out, the durable data may be correct while the live
   notification is missed.

The bridge/runtime control path already includes Redis cross-instance routing.
That design does not automatically cover every ordinary client event.

## Requirements before horizontal backend scaling

Before multiple backend replicas are treated as production-ready:

1. Inventory every outbound event and its intended audience.
2. Publish relevant event envelopes through a shared bus.
3. Deliver locally only to sockets owned by the receiving instance.
4. Preserve tenant, user, workspace, thread, device, and runtime authorization.
5. Deduplicate events where redelivery is possible.
6. Define ordering requirements.
7. Prove reconnect and missed-event recovery.
8. Load-test several backend replicas without relying on sticky sessions.

PostgreSQL remains authoritative. Realtime delivery should improve freshness,
not become the only place important state exists.

## Reconnect storms

Deploys, provider interruptions, or network failures can disconnect many users
at once. Immediate reconnects can overload:

- authentication and ticket issuance;
- Redis single-use ticket operations;
- database session validation;
- WebSocket handshake CPU;
- logs and audit pipelines.

Clients should use bounded exponential backoff with jitter. Tests should cover
mass disconnect and reconnect, not only stable open connections.

## Queue behavior

Queues protect interactive requests from slow background work and smooth short
bursts.

They do not create infinite capacity. During sustained overload, queue depth
and oldest-job age continue rising.

Monitor:

- queued, active, completed, retried, and failed counts;
- oldest waiting-job age;
- processing duration;
- dead-letter or terminal failure volume;
- Redis availability;
- database work performed by each job.

The service should apply backpressure before accepting more work than it can
finish within the product's promised time.

## Multiple queue consumers

Bull can coordinate job claims through Redis, but safe horizontal processing
still requires:

- idempotent business operations;
- durable conditional claims where duplicate effects matter;
- bounded retries;
- safe handling after a worker dies mid-job;
- connection and concurrency budgets;
- no assumption that completion events are process-local.

## Scheduled work

When a scheduler is embedded in an application that gains multiple replicas,
each replica may attempt to run the same schedule unless the job has explicit
ownership or a distributed claim.

Before adding replicas, classify every scheduled path as one of:

- safely idempotent;
- protected by a database or Redis claim;
- assigned to one dedicated worker;
- unsafe and requiring remediation.

## Paired customer runtimes

Customer-operated runtimes alter the capacity model:

- agent execution capacity is partly distributed across customer machines;
- each customer's host can have different CPU, memory, network, and provider
  constraints;
- a host can be offline while Relay itself remains healthy;
- Railway still bears dispatch, persistence, authentication, WebSocket, and
  event load.

The product should distinguish:

- **platform unavailable** — Relay infrastructure cannot serve customers;
- **runtime unavailable** — one customer's paired host is offline;
- **provider unavailable** — an external AI or Marketplace service is
  throttled or down;
- **queued** — Relay accepted work but execution capacity is temporarily busy.

## Backpressure and graceful degradation

During overload, a controlled response is better than a cascade:

- reject excess work with an explicit retryable status;
- cap concurrent dispatches;
- queue only within bounded age and size;
- preserve reads while pausing nonessential background work where safe;
- avoid retry loops without backoff;
- show users whether a failure belongs to Relay, their runtime, or a provider.
