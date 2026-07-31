# Beginner-friendly glossary

## Application server / backend

The program that receives requests, applies business rules, checks permissions,
reads or writes data, and returns responses. Relay's shared backend is the
NestJS service hosted on Railway.

## Availability

The proportion of time a service can perform its intended work.

## Backpressure

Deliberately slowing, queueing, or rejecting new work when downstream capacity
is full so the whole system does not collapse.

## Backup

A recoverable historical copy of data. A backup protects against accidental
deletion or corruption in ways a live replica may not.

## Cache

A temporary copy of an answer kept in faster storage. It can reduce repeated
work but introduces freshness and invalidation problems.

## Cache invalidation

Removing or versioning a cached value after the authoritative data changes.

## Cache stampede

Many requests simultaneously miss or expire the same popular cache entry and
overload the original data source while rebuilding it.

## CDN

A distributed network that serves static or cacheable content near users.
Vercel provides edge delivery capabilities for the Relay web application.

## Client

Software used by a person to communicate with a backend. Relay's browser,
macOS, iPhone, and iPad applications are clients.

## Connection pool

A bounded set of reusable database connections held by an application process.

## Database

The durable structured data store. Relay uses PostgreSQL as its production
source of truth.

## Eventual consistency

A read may briefly return an older value, but replicas or caches converge on
the current value later.

## Failover

Moving traffic or database responsibility from a failed component to a healthy
replacement.

## Horizontal scaling

Adding more instances of a service and distributing work between them.

## Idempotency

The property that safely repeating an operation does not create an unintended
duplicate effect.

## Index

A database structure that makes selected lookups faster at the cost of storage
and additional write maintenance.

## Latency

The time between starting an operation and receiving its result.

## Load balancer

A traffic router that distributes requests between healthy service replicas.
Railway provides public load balancing for configured replicas.

## Monolith

An application in which many business capabilities are deployed together.
Relay's NestJS backend is broadly a modular monolith.

## Microservice

A separately deployed service with a narrow responsibility. It can scale
independently but adds network, deployment, consistency, and operational
complexity.

## Object storage

Storage designed for large binary objects such as attachments, images, or
exports. It is different from a relational database.

## p50, p95, and p99

Latency percentiles. A p95 of 500 milliseconds means 95 percent of measured
operations completed within 500 milliseconds and 5 percent took longer.

## Queue

A shared waiting line for work that can be processed asynchronously. Relay uses
Bull with Redis for queued work.

## Rate limit

A cap on how much work one identity, client, or network source can request in a
time window.

## Read replica

A database copy that can answer eligible reads. It may briefly lag behind the
primary.

## Redis

A fast in-memory data system. Relay uses Redis for queues, distributed limits,
one-time realtime state, and runtime coordination. Redis is not synonymous
with "cache."

## Replica

Another running copy of a service or database. Backend replicas add compute
capacity; database replicas add data availability or read capacity.

## Replication lag

The delay between a primary database accepting a write and a replica receiving
it.

## Shard

One partition of an authoritative dataset. Sharding distributes different data
across different database partitions.

## Single point of failure

One component whose failure makes the whole relevant service unavailable.

## Source of truth

The authoritative location whose value wins when copies disagree. PostgreSQL
is the production data source of truth for Relay's control plane.

## Stateful service

A service that keeps important state inside one process or machine, making
replacement or load distribution harder.

## Stateless service

A service whose authoritative state lives in shared external systems, allowing
another instance to handle the next request.

## Throughput

The amount of work completed per unit of time, such as requests per second.

## Time to live (TTL)

An expiry duration after which a cached or temporary value is removed.

## Vertical scaling

Giving one service instance more CPU, memory, storage, or input/output
capacity.

## WebSocket

A long-lived two-way connection used for realtime communication. Each live
connection remains attached to one backend instance until it disconnects.
