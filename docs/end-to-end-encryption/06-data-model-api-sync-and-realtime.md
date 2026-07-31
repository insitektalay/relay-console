# Data model, API, sync, and realtime contracts

Status: proposed

## 1. Backend responsibility

The backend validates envelope shape, authorization, recipient eligibility,
size, rate, ordering, idempotency, and signatures that use registered public
keys. It stores and routes ciphertext. It does not decrypt protected content.

## 2. Core entities

The implementation requires versioned equivalents of:

- `encryption_accounts`: activation state, minimum suite, migration state;
- `encryption_devices`: public keys, capabilities, trust and revocation;
- `device_approval_statements`: signed enrollment and key-change records;
- `workspace_key_epochs`: epoch status without raw key material;
- `wrapped_keys`: target key ID, epoch, recipient, ephemeral public key,
  ciphertext, nonce, signature;
- `encrypted_objects`: object identity, envelope, sequence, tombstone, routing
  class, and timestamps;
- `recipient_set_statements`: signed authorized-recipient changes;
- `encryption_migrations`: checkpoints, counts, errors, and proof state; and
- `encryption_security_events`: content-free protocol and integrity failures.

Messages may remain in a dedicated table for query and relationship behavior,
but protected fields must use the common envelope contract.

## 3. Message schema transition

During migration, message rows need:

- encrypted protocol, suite, key ID, and key epoch;
- nonce, ciphertext, signature, and sender device;
- client mutation ID and server sequence;
- encryption state: `plaintext_legacy`, `encrypted`, `migration_verified`, or
  `tombstoned`;
- no plaintext preview for encrypted rows; and
- a check constraint that prevents encrypted rows from carrying plaintext
  protected fields.

After migration and backup expiry, remove plaintext columns and legacy DTOs.

## 4. APIs

Minimum endpoint families:

- account encryption bootstrap and status;
- device enrollment request, approval, verification, list, and revoke;
- public device-key lookup with signed trust state;
- wrapped-key upload, fetch, acknowledge, rotate, and recipient reconciliation;
- encrypted object create, page, update, delete, and sync;
- migration manifest, batch claim, encrypted replacement, verify, and finalize;
- recovery-key replacement and recovery challenge;
- protocol capability and minimum-version discovery; and
- content-free security event reporting.

All endpoints remain under `/api/v1` and use the Railway backend. No client may
introduce a local backend fallback.

## 5. DTO rules

- Use names such as `ciphertext` and `encryptedPayload`, never reuse `content`
  for ciphertext.
- Apply decoded-byte limits before allocation and after decoding.
- Reject unknown fields on cryptographic DTOs.
- Validate fixed nonce, key, signature, and identifier lengths.
- Reject unregistered sender devices and revoked epochs.
- Bind all IDs to the authenticated deployment, account, and workspace.
- Return generic errors that expose no protected values.
- Do not echo malformed ciphertext in error responses.

## 6. Realtime

Websocket events carry the same immutable encrypted envelope returned by REST.
Realtime subscriptions still require workspace and conversation authorization.

Required events include:

- encrypted object created, replaced, or tombstoned;
- wrapped key available;
- device enrollment requested, approved, or revoked;
- key epoch advanced;
- recipient set changed;
- migration state changed; and
- minimum protocol changed.

Clients deduplicate events by object ID, client mutation ID, and server
sequence. Missing sequence ranges trigger a REST sync before display.

## 7. Sync and offline writes

- Clients generate stable object IDs and mutation IDs before encryption.
- The exact encrypted envelope enters the outbox. Retries resend it.
- Relay assigns an ordered workspace or thread sequence after authorization.
- Conflict responses contain ciphertext and version metadata, not plaintext.
- Clients decrypt both versions and present a local merge workflow.
- Tombstones remain long enough for supported offline clients to observe them.
- An outbox must encrypt content before durable storage.

## 8. Routing

The sender supplies signed opaque routing targets, such as agent IDs or team
member IDs. The backend validates that each target is authorized for the thread
and routes the ciphertext. It must not parse encrypted content for mentions.

Team-relay decisions that depend on message meaning move to a trusted runtime.
State-only rules may remain on the backend if they consume clear status and
membership metadata.

## 9. Read state and reactions

Read receipts and generic emoji reactions may remain clear when product owners
classify them as control metadata. Custom reaction text, private annotations,
and reaction context require encryption. Customers must be able to disable
read receipts without affecting content encryption.

## 10. Compatibility

The backend publishes:

- minimum write protocol;
- readable protocol range;
- migration requirement;
- minimum client versions by platform; and
- blocked features for a client version.

After account activation, the backend rejects plaintext protected fields even
if an older authenticated client submits them. A server feature flag cannot
restore plaintext writes for selected users.

## 11. Database and queue controls

- PostgreSQL constraints enforce envelope exclusivity.
- Redis jobs carry ciphertext and opaque IDs.
- Outbox events and dead-letter records contain no protected plaintext.
- Object-store keys use random identifiers and no customer filenames.
- Database indexes cover tenant, object type, sequence, status, and recipient;
  they do not index content.
- Production logs record protocol error codes, sizes, and hashed correlation
  IDs without ciphertext samples.
