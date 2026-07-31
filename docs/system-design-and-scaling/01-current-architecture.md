# Current Relay Console architecture

## Plain-English map

```text
Browser
  |
  | page and static assets
  v
Vercel web application
  |
  | /api/v1 rewrite and configured Railway WebSocket origin
  v
Railway backend (NestJS API + WebSockets)
  |              |                 |
  v              v                 v
PostgreSQL      Redis       paired customer runtimes
                                  |
                         Claude/OpenClaw/Hermes work

macOS and iPhone/iPad clients also communicate with the Railway backend.
```

The production boundary is documented in the repository
[`README.md`](../../README.md). The browser API target stays on `/api/v1` and is
rewritten to Railway. Realtime traffic uses the configured Railway WebSocket
origin.

## What each component does

### Vercel

Vercel hosts the Next.js web application. It sends the interface to a browser
and forwards the supported API path to Railway. Vercel is a server platform,
but it is not the authority for Relay workspace, message, runtime, or billing
data.

### Railway backend

Railway runs the shared backend application. It handles responsibilities such
as:

- authentication and authorization;
- workspace, thread, message, agent, Marketplace, and billing APIs;
- WebSocket authentication and realtime subscriptions;
- runtime dispatch and bridge coordination;
- background and scheduled work;
- health and readiness reporting.

Railway can run one or more replicas of the same backend image and can load
balance public traffic between them. Replica count and regional placement are
deployment settings; the checked-in
[`backend/railway.json`](../../backend/railway.json) defines the build, start
command, and health check but does not prove the live replica count.

### PostgreSQL

PostgreSQL is the durable shared data store. Backend replicas can be replaced
without losing authoritative data because they all use the same database.

PostgreSQL pressure normally comes from:

- too many simultaneous connections;
- too many queries per request;
- slow queries or missing indexes;
- large scans, sorts, or joins;
- write contention;
- storage or input/output limits.

A database being "overloaded" usually means it is too busy, not that its disk is
full.

### Redis

Redis is fast shared memory, but its current role is broader than "cache."
Relay uses it for:

- Bull-backed queued work;
- distributed HTTP and WebSocket rate-limit counters;
- one-time WebSocket ticket replay protection;
- bridge/runtime cross-instance presence and request routing.

Relay does not currently place a general Redis cache in front of normal
PostgreSQL reads. Small specialised in-process caches exist for narrow purposes,
such as some provider token or verification objects, but those are not a shared
application query cache.

### Client applications

The maintained clients are:

- the Vercel-hosted browser application;
- the native macOS Relay Console application;
- the native iPhone and iPad application.

They are user interfaces, not replacements for the Railway control plane.

### Paired customer runtimes

The current product model uses customer-operated runtime hosts. A paired
runtime on the customer's machine makes an outbound authenticated connection
to Railway and performs compatible agent work.

This distributes some expensive execution across customer machines, but it
does not remove central load. Railway still handles coordination,
authentication, persistence, realtime events, and dispatch state.

If one customer's host is offline, that customer's agent execution may be
unavailable. It should not make the shared Relay service unavailable to other
customers.

## Request examples

### Browser page load

1. A browser requests the Relay website from Vercel.
2. Vercel returns the interface.
3. The interface requests authenticated data through `/api/v1`.
4. Vercel rewrites the request to the Railway backend.
5. The backend reads or writes PostgreSQL and may coordinate through Redis.
6. The response returns to the browser.

### Native application request

1. The native client authenticates with the Railway backend.
2. The backend authorizes the requested workspace or resource.
3. The backend reads or writes PostgreSQL.
4. Realtime changes arrive through the Railway WebSocket endpoint.

### Agent dispatch

1. A client creates work through Railway.
2. Railway persists and authorizes the dispatch.
3. Railway routes it to an eligible paired runtime.
4. Runtime events return through Railway.
5. Railway persists authoritative results and broadcasts relevant updates.

## Current known scaling boundary

HTTP state is largely externalized to PostgreSQL and Redis, which is a useful
foundation for multiple backend replicas.

Ordinary WebSocket connection and subscription maps are currently stored
inside each backend process in
[`backend/src/gateways/events.gateway.ts`](../../backend/src/gateways/events.gateway.ts).
The bridge/runtime path has a Redis cross-instance bus, but normal user,
workspace, and thread broadcasts require explicit multi-instance validation.

Therefore, increasing the backend replica count is not a purely
infrastructure-only change. Cross-replica realtime delivery must be proven
first.

## What is not known from source code

The repository alone does not establish:

- the live Railway backend replica count or regions;
- live CPU and memory ceilings;
- PostgreSQL plan size, failover tier, connection ceiling, or read replicas;
- Redis plan size and eviction policy;
- observed peak requests, connections, queries, or queue latency;
- proven maximum concurrent users.

These facts must come from provider configuration and monitored production
evidence. Do not infer them from architecture diagrams.
