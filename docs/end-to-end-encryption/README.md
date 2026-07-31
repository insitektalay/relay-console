# Relay end-to-end encryption implementation specification

Date: 2026-07-29

Status: implementation specification. No part of this document set records a
completed implementation, migration, security audit, or customer-facing
encryption claim.

## Purpose

Relay will encrypt customer content before it leaves a trusted customer
endpoint. Railway will store and route ciphertext without possessing the keys
needed to recover that content. Relay Console for macOS, the browser
application, the iPhone and iPad application, and user-owned runtime hosts will
use one versioned protocol.

This project changes the trust model. The current Railway backend reads message
content for search, previews, routing, context assembly, summaries, analytics,
and automation. Implementation must move each content-dependent operation to a
trusted client or runtime, remove it, or ask the customer to authorize a named
processor.

## Scope

The default end-to-end encrypted content boundary covers:

- conversation messages, edits, reactions with private text, and drafts;
- thread titles, previews, summaries, wrap-up reports, and meeting transcripts;
- attachments, filenames, captions, generated artifacts, and embedded cards;
- agent instructions, memory, managed documents, and synchronized content;
- task descriptions, work logs, handovers, notes, reports, and comments;
- customer-provided connector inputs and retained connector results;
- private approval context, schedules, notification bodies, and exports; and
- local replicas, search indexes, queued mutations, and support bundles that
  contain any item above.

Relay must retain a small control-plane record to authenticate accounts, apply
authorization, route ciphertext, bill accounts, detect abuse, and operate the
service. [01-product-and-privacy-contract.md](./01-product-and-privacy-contract.md)
defines that record and the claims Relay may make.

## Documents

- [01-product-and-privacy-contract.md](./01-product-and-privacy-contract.md)
  defines the customer promise, scope, terminology, and non-negotiable product
  behavior.
- [02-current-state-and-data-inventory.md](./02-current-state-and-data-inventory.md)
  maps the current plaintext paths and classifies stored data.
- [03-threat-model.md](./03-threat-model.md) defines protected assets,
  adversaries, trust boundaries, threats, and residual risks.
- [04-cryptographic-protocol.md](./04-cryptographic-protocol.md) specifies
  algorithms, envelopes, associated data, signing, versioning, and test
  vectors.
- [05-identity-devices-keys-and-recovery.md](./05-identity-devices-keys-and-recovery.md)
  specifies device trust, key hierarchy, enrollment, membership, revocation,
  rotation, and recovery.
- [06-data-model-api-sync-and-realtime.md](./06-data-model-api-sync-and-realtime.md)
  defines the backend entities, DTOs, APIs, websocket events, ordering, and
  compatibility rules.
- [07-runtime-processing-and-marketplace.md](./07-runtime-processing-and-marketplace.md)
  moves plaintext processing to trusted runtimes and defines the boundary for
  managed runtimes and third-party applications.
- [08-client-platform-implementation.md](./08-client-platform-implementation.md)
  assigns work to macOS, web, iPhone, iPad, and shared contracts.
- [09-content-features-and-local-storage.md](./09-content-features-and-local-storage.md)
  covers search, previews, notifications, attachments, analytics, offline
  behavior, exports, and local encrypted caches.
- [10-migration-backups-deletion-and-rollback.md](./10-migration-backups-deletion-and-rollback.md)
  defines the existing-data migration, plaintext eradication, backup expiry,
  rollback boundary, and proof of deletion.
- [11-operations-support-and-incident-response.md](./11-operations-support-and-incident-response.md)
  defines key-independent operations, support access, telemetry, incident
  handling, and disaster recovery.
- [12-test-security-review-and-acceptance.md](./12-test-security-review-and-acceptance.md)
  defines automated tests, interoperability fixtures, hostile tests,
  independent review, and release evidence.
- [13-rollout-compatibility-and-release.md](./13-rollout-compatibility-and-release.md)
  defines sequencing, client gates, deployment order, customer transition, and
  launch criteria.
- [14-requirements-traceability.md](./14-requirements-traceability.md) maps the
  requirements to owners, implementation surfaces, and required evidence.
- [15-customer-communications-and-claims.md](./15-customer-communications-and-claims.md)
  defines accurate product language, disclosures, recovery warnings, and
  verification material.
- [16-standards-and-references.md](./16-standards-and-references.md) records the
  standards, platform documentation, infrastructure controls, and review
  sources that constrain the implementation.
- [DECISIONS.md](./DECISIONS.md) records approved decisions and open questions.
- [IMPLEMENTATION_TRACKER.md](./IMPLEMENTATION_TRACKER.md) provides the work
  breakdown and release ledger.

## Governing rules

1. Relay cannot claim that it cannot read customer content while a Relay-held
   key, backend endpoint, worker, search index, log, backup, or support tool can
   recover it.
2. New encrypted clients must never send a plaintext fallback after account
   encryption activation.
3. The backend must reject unsupported encrypted envelopes rather than store
   content outside the encrypted contract.
4. Every content category must have an owner, encrypted representation,
   migration plan, deletion plan, and test before launch.
5. The team must commission an independent cryptographic architecture and
   implementation review before enabling the customer claim.
6. Backend schema and API changes require a Railway deployment from `backend/`.
   Client behavior becomes usable only after release-bound macOS, web, iPhone,
   iPad, and runtime builds pass the compatibility gates.

## Definition of done

The project finishes after all traceability rows have passing evidence, all
supported accounts use encrypted writes, the plaintext migration and backup
retention window have closed, independent reviewers have accepted the
implementation, and production monitoring proves that Relay processes no
customer plaintext. A code merge or backend deployment alone does not meet
this definition.
