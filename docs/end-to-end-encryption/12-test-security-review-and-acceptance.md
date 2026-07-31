# Test, security review, and acceptance plan

Status: proposed

## 1. Test layers

| Layer              | Scope                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------- |
| Primitive wrappers | Key generation, import/export rules, AEAD, HKDF, signing, verification                |
| Protocol fixtures  | Canonical encoding, associated data, envelopes, wraps, padding                        |
| Domain contracts   | Device state, membership, epochs, revocation, recovery, migration                     |
| Backend            | Authorization, schema constraints, ciphertext-only queues/events, downgrade rejection |
| macOS              | Keychain, local DB, sync, runtime dispatch, export                                    |
| iPhone/iPad        | Keychain, Data Protection, SwiftData migration, background and notification behavior  |
| Web                | Web Crypto, IndexedDB, hydration boundary, CSP, XSS and persistence                   |
| Runtime            | Encrypted dispatch, context, reply, logs, processor boundaries                        |
| Cross-platform     | Every producer/consumer pair and version combination                                  |
| Production         | Synthetic encrypted tenant, operator-access test, backup and log inspection           |

## 2. Interoperability matrix

Every platform must encrypt and decrypt fixtures produced by every other
platform:

- macOS to web, iPhone/iPad, and runtime;
- web to macOS, iPhone/iPad, and runtime;
- iPhone/iPad to macOS, web, and runtime; and
- runtime replies to each client.

Include message edits, reactions, titles, attachments, rotations, new members,
removed members, offline outboxes, and recovery.

## 3. Negative tests

Reject:

- modified ciphertext, tag, nonce, signature, associated data, and key epoch;
- wrong workspace, thread, object, sender, recipient, or protocol;
- replayed mutation and duplicate object;
- unknown, deprecated, or downgraded suite;
- revoked sender or recipient;
- hidden recipient addition and unsigned recipient-set change;
- malformed sizes, oversized decoded values, and allocation attacks;
- reordered, missing, forked, or stale sequence state;
- attachment chunk substitution, omission, duplication, and truncation; and
- plaintext protected fields after encryption activation.

## 4. Authorization and tenant isolation

Test every new entity and endpoint for:

- cross-account and cross-workspace reads and writes;
- conversation membership;
- device ownership;
- runtime assignment;
- recipient eligibility;
- administrator limits;
- stale membership and revocation races; and
- websocket subscription and replay authorization.

Cryptography cannot compensate for an authorization failure that sends wrapped
keys to the wrong principal.

## 5. Recovery tests

- trusted-device approval with fingerprint match;
- enrollment MITM and one-time-session replay;
- recovery-key success and wrong-key failure;
- all-devices-lost flow;
- account password reset without content access;
- enterprise recovery under customer-controlled policy;
- recovery-key replacement;
- offline device return after key rotation; and
- revoked device after backup restore.

## 6. Local leakage tests

Search files, databases, swap/crash artifacts where testable, browser storage,
logs, clipboard fixtures, task-switcher snapshots, notification payloads,
exports, and temporary directories for synthetic plaintext.

Inspect:

- macOS SQLite and Keychain accessibility;
- iOS SwiftData, app container, device backup, and Data Protection class;
- browser localStorage, IndexedDB, Cache Storage, service-worker records, URLs,
  server-rendered HTML, and source maps; and
- runtime command history, process arguments, files, stdout, stderr, and traces.

## 7. Backend zero-access tests

Using a synthetic production-like tenant:

1. Grant the reviewer application, database, Redis, object-store, backup,
   environment-variable, and support-tool access equivalent to an operator.
2. Confirm that the reviewer can observe control metadata.
3. Require recovery of a known fixture phrase without an endpoint key.
4. Pass only if the reviewer cannot recover it from any Relay-controlled
   system.

Record methodology and evidence without publishing real secrets.

## 8. Migration tests

- full production-snapshot rehearsal with synthetic data;
- interruption after each checkpoint;
- concurrent edits, membership changes, and device revocation;
- object-count and hash reconciliation;
- local-store atomic switch and crash recovery;
- plaintext column removal and constraint enforcement;
- backup restore before and after destruction boundary; and
- legacy-client rejection.

## 9. Performance and reliability

Measure encryption/decryption latency, startup key loading, message list
rendering, local search, attachment streaming, battery, memory, browser main
thread, sync bandwidth, key-wrap growth, and large-workspace rotation.

Set release budgets after baseline measurement. Security checks may not fail
open to meet latency targets.

## 10. Independent review

Commission reviewers with applied cryptography, web security, Apple platform
security, and distributed-system experience. Provide:

- this documentation pack;
- protocol and fixture package;
- key and recovery implementation;
- backend validation and schema;
- each client and runtime integration;
- migration and operations code; and
- customer claims.

Resolve critical and high findings before rollout. Product and security owners
must accept remaining medium findings in writing with remediation dates.

## 11. Release evidence

Each requirement needs:

- code owner and reviewer;
- commit and pull request;
- entity, DTO, event, and protocol references;
- exact automated test identifiers;
- manual platform evidence;
- independent-review finding status;
- Railway deployment and migration result;
- released client and runtime build identifiers; and
- pass/fail, date, and approver.

The release gate fails if evidence is missing or refers only to compilation.
