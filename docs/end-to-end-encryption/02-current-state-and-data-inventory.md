# Current state and data inventory

Status: audited design input

## 1. Current message path

Relay currently sends message text to Railway, stores it in PostgreSQL, reads
it in backend services, and sends it to clients and runtimes.

| Current behavior                                          | Evidence                                                          | Encryption impact                                                   |
| --------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| PostgreSQL stores `messages.content` as `text`            | `backend/src/entities/message.entity.ts`                          | Replace protected columns with a versioned encrypted envelope.      |
| Message creation saves the supplied content               | `backend/src/modules/message/message.service.ts`                  | Clients or trusted runtimes must encrypt before the API call.       |
| Thread records store a plaintext last-message preview     | `backend/src/modules/message/message.service.ts`                  | Store an encrypted preview or let clients derive it.                |
| Backend search reads `m.content`                          | `backend/src/modules/message/message.service.ts`                  | Move search to trusted endpoints.                                   |
| Backend routing parses message mentions                   | `backend/src/modules/message/message.service.ts`                  | Send signed opaque routing targets.                                 |
| Backend builds recent-message context                     | `backend/src/modules/message/message.service.ts`                  | Trusted runtime decrypts and assembles context.                     |
| Web renders and caches plaintext message objects          | `web/lib/message-cache.ts`                                        | Decrypt at the presentation boundary and protect persistent caches. |
| iOS SwiftData stores `content` and encoded message data   | `ios/ClawChat/Infrastructure/Persistence/ClawDataModels.swift`    | Encrypt local records with a device storage key.                    |
| macOS SQLite stores message content as `TEXT`             | `RelayConsoleSwift/Sources/RelayConsoleCore/Migrations.swift`     | Migrate local content and previews to encrypted blobs.              |
| Cloud sync materializes message plaintext in local SQLite | `RelayConsoleSwift/Sources/RelayConsoleCore/CloudRelaySync.swift` | Sync ciphertext and decrypt after authorization.                    |

The backend already uses AES-256-GCM for server-readable secrets in
`backend/src/modules/security/encryption.service.ts`. That service cannot meet
the zero-access goal because Railway holds its key.

## 2. Data classification

| Class                          | Examples                                                                  | Required treatment                                                                   |
| ------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| E2EE content                   | Messages, titles, documents, tool inputs/results, notes, attachment bytes | Encrypt on endpoint; Relay has no decryption key.                                    |
| Sensitive local state          | Decrypted cache, local search index, drafts, recovery material            | Encrypt with a device storage key; exclude from logs and backups without protection. |
| Clear control metadata         | Opaque IDs, membership, sequence, routing IDs, ciphertext size            | Minimize, authorize, retain for a documented period.                                 |
| Server secrets                 | JWT keys, OAuth client secrets, connector credentials owned by Relay      | KMS or server envelope encryption; separate from E2EE keys.                          |
| Customer processor credentials | Customer connector token used by a trusted runtime                        | Keep on the customer runtime where the execution model permits.                      |
| Account and commerce data      | Email, subscription, invoice references, entitlement                      | Server-readable under privacy and retention policy.                                  |
| Security audit data            | Actor ID, event type, outcome, timestamp                                  | Content-free, immutable, retention-limited.                                          |

## 3. Repository entities requiring field review

Implementation must inspect every persisted entity, DTO, event, queue payload,
cache, export, and log. The initial field-review list includes:

- messages, message reactions, scheduled messages, threads, thread sessions,
  read state, wrap-up reports, and condensed summaries;
- tasks, approvals, tool requests, runs, run events, work logs, reviews,
  incidents, alerts, reports, and handover notes;
- meeting sessions, meeting notes, meeting rule snapshots, coaching notes, and
  team memory;
- agent documents, documentation versions, proposals, generated packs, and
  workspace artifacts;
- relay sync batches, runtime dispatch payloads, bridge events, runtime
  structured jobs, and queued worker data;
- marketplace operation inputs, retained provider results, connector errors,
  audit context, and linked-application descriptions;
- mobile and web caches, offline outboxes, local SQLite, SwiftData, IndexedDB,
  downloads, notification payloads, clipboard operations, and exports; and
- volume backups, PostgreSQL backups, Redis persistence, object storage,
  telemetry, crash reports, diagnostics, and support bundles.

The field inventory must record:

| Field | Owner | Classification | Current stores | Retention | Encrypted form | Processor | Migration | Deletion proof |
| ----- | ----- | -------------- | -------------- | --------- | -------------- | --------- | --------- | -------------- |

No owner may mark a category complete by encrypting its primary database row
while leaving plaintext in a preview, queue, cache, log, attachment, or backup.

## 4. Current controls worth preserving

- JWT authentication and workspace access checks protect message APIs.
- Bridge message postback checks workspace and dispatch ownership.
- Production TypeORM logging suppresses SQL and query parameters.
- Production PostgreSQL connections verify TLS certificates.
- Railway encrypts databases at rest under its infrastructure controls.
- Existing telemetry tests reject private message content.

These controls remain necessary after E2EE. Encryption does not replace
authorization, transport security, tenant isolation, secure logging, or
retention.

## 5. Required discovery work before implementation

1. Generate a machine-readable inventory of protected fields from TypeORM,
   shared contracts, SQLite migrations, SwiftData models, and event schemas.
2. Trace each field through REST, websocket, bridge, queues, logs, metrics,
   exports, notifications, and backups.
3. Classify third-party processors and determine whether each receives
   plaintext.
4. Measure message and attachment sizes to set envelope and batching limits.
5. Record supported browser and OS cryptographic capabilities.
6. Inspect Railway backup, volume, Redis, and object-store retention in the
   production environment without reading customer content.
7. Record every content-dependent backend feature in
   `09-content-features-and-local-storage.md`.
