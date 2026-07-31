# Migration, backups, deletion, and rollback

Status: proposed

## 1. Migration principles

- A trusted endpoint performs plaintext-to-ciphertext conversion.
- Relay does not add a server-held migration key.
- Migration is resumable, idempotent, measured, and reversible only before the
  plaintext destruction boundary.
- New encrypted writes start before old data migration.
- The system never creates new plaintext copies to speed migration.
- The launch claim waits for database, queue, object-store, log, and backup
  plaintext retirement.

## 2. Preconditions

- Account has a confirmed recovery route.
- At least one trusted device supports the write protocol.
- Required user-owned runtimes support encrypted dispatch and reply.
- Field inventory and processor inventory have owner approval.
- Database and object-store backups exist for operational recovery, with their
  plaintext status and expiry recorded.
- Migration and rollback code has passed production-snapshot rehearsal using
  synthetic content.
- Old clients are blocked from plaintext writes.

## 3. Account migration state

```text
not_started
  -> key_setup_required
  -> encrypted_writes_enabled
  -> inventory_ready
  -> encrypting
  -> verification_required
  -> plaintext_delete_committed
  -> backup_expiry_pending
  -> complete
```

Failures enter a recoverable state with a safe code and checkpoint. No state
may silently return to plaintext writes.

## 4. Existing message migration

1. Client requests a bounded migration manifest containing object IDs, types,
   versions, sizes, and hashes without message content in logs.
2. Client claims a batch through an expiring lease.
3. Client downloads authorized legacy plaintext over verified TLS.
4. Client encrypts each object under the correct workspace and conversation
   epoch.
5. Client uploads the encrypted replacement with the legacy object ID,
   immutable metadata, and plaintext hash inside the encrypted payload.
6. Backend validates authorization, envelope, signature, and idempotency.
7. Client reads and decrypts the stored replacement and verifies equality.
8. Backend marks the object `migration_verified`.
9. A separate finalization transaction nulls or deletes plaintext fields after
   all required clients and processors use encrypted data.

Do not dual-write plaintext after `encrypted_writes_enabled`.

## 5. Related data migration

Run the same manifest and verification process for:

- titles, previews, summaries, schedules, tasks, notes, and reports;
- attachments, manifests, thumbnails, extracted text, and artifacts;
- agent documents, memory, and synchronized customer content;
- drafts, outboxes, native caches, search indexes, and web persistence;
- retained connector inputs/results and private approval context; and
- queued jobs, dead letters, exports, and support artifacts.

## 6. Local stores

macOS and iOS migrations create a new encrypted store or encrypted fields,
verify counts and hashes, switch atomically, and securely remove the legacy
store as far as each filesystem permits. Browser migration encrypts supported
IndexedDB state or discards and resynchronizes it.

Rollback before local plaintext deletion may reopen the old store under a
release gate. Rollback after deletion uses the encrypted store only.

## 7. Backups and historical copies

Plaintext can remain in:

- PostgreSQL volume backups and point-in-time recovery archives;
- object-store versions and deleted-object recovery;
- Redis persistence and queue snapshots;
- Railway deployment or volume snapshots;
- native device backups;
- logs, crash systems, analytics exports, and support tickets; and
- customer-created exports.

The migration ledger records provider, scope, oldest recoverable timestamp,
retention, deletion method, owner, and evidence. Railway's PITR and scheduled
backup settings require production inspection.

Relay may say "new content is end-to-end encrypted" after encrypted writes
activate and pass verification. Relay may say "Relay cannot read your stored
conversation history" only after plaintext production copies and recoverable
Relay-controlled backups have expired or been destroyed.

## 8. Deletion

Account and object deletion must:

- authorize the actor;
- publish an encrypted tombstone or clear control-plane tombstone;
- remove wrapped keys and ciphertext under retention policy;
- revoke device and runtime access;
- remove local caches on active devices;
- expire object-store and backup copies;
- retain only content-free legal or billing records; and
- provide a deletion receipt with scopes and final backup-expiry date.

Cryptographic erasure by deleting the final wrapped content key can make
ciphertext inaccessible. Physical deletion still follows retention policy.

## 9. Rollback boundary

Before plaintext deletion, the team may roll back application behavior while
keeping encrypted writes blocked or queued. After plaintext deletion, no
rollback may require server plaintext. Older clients remain blocked.

The release plan must define:

- the last release that can read legacy plaintext;
- the first release that writes ciphertext;
- the point of no plaintext rollback;
- database migration reversal behavior;
- runtime compatibility behavior; and
- customer-visible failure handling.

## 10. Migration acceptance

- Object counts and encrypted verification hashes reconcile by workspace and
  type.
- Synthetic secrets do not appear in database plaintext queries, object
  metadata, logs, queues, or backups created after the boundary.
- Random samples decrypt on every client platform.
- Interrupted batches resume without duplicate objects or nonce reuse.
- Membership changes during migration preserve correct recipient epochs.
- No backend worker can decrypt a migrated fixture.
- The migration ledger names every remaining historical plaintext copy and its
  expiry.
