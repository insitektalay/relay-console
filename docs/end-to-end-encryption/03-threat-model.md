# Threat model

Status: proposed; independent reviewer approval required

## 1. Security goals

Relay must protect the confidentiality and integrity of customer content
against:

- a read-only PostgreSQL, Redis, object-store, volume, or backup compromise;
- a Relay operator or support user with production infrastructure access;
- exposure of Railway environment variables and server encryption keys;
- cross-workspace API and websocket authorization failures;
- a stolen encrypted local database without the device storage key;
- message modification, substitution, replay, truncation, and reordering;
- unauthorized device enrollment or retained access after revocation; and
- logs, crash reports, analytics, notifications, and exports leaking content.

Relay must preserve availability and give customers a usable recovery path
without creating a Relay-held decryption route.

## 2. Assets

- account recovery key and workspace root keys;
- device private encryption and signing keys;
- conversation content keys and key epochs;
- plaintext customer content during authorized use;
- ciphertext integrity, authorship, order, and deletion state;
- membership, device trust, processor authorization, and revocation records;
- local encrypted stores and search indexes; and
- cryptographic version, downgrade, and migration state.

## 3. Trust boundaries

| Principal                       | Trust                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Native macOS/iOS/iPadOS app     | Trusted after release signature and device enrollment; plaintext exists in process memory.               |
| Browser app                     | Trusted for the active approved origin and release; server-delivered JavaScript remains a material risk. |
| User-owned runtime              | Trusted content processor for conversations assigned to it.                                              |
| Relay Cloud                     | Authenticates, authorizes, stores, orders, and routes ciphertext; untrusted with plaintext.              |
| Relay-managed runtime           | Relay-observable processor unless confidential-compute requirements pass.                                |
| Model provider or connected app | External processor chosen by the customer; receives task-scoped plaintext.                               |
| Other workspace member          | Authorized only for conversations and epochs shared with that member.                                    |
| Removed member or device        | May retain old plaintext and keys; receives no new epochs.                                               |

## 4. Threats and controls

| Threat                                   | Required control                                                                                   | Required evidence                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Database reader decrypts content         | Relay stores no customer content key or recovery secret                                            | Operator-compromise exercise              |
| Backend substitutes a device key         | Existing trusted device verifies a device fingerprint before wrapping keys                         | Enrollment MITM tests                     |
| Backend adds a hidden recipient          | Clients display signed recipient-set changes and reject unauthorized sets                          | Recipient transparency tests              |
| Ciphertext moves to another thread       | AEAD associated data binds account, workspace, thread, object, sender, version, and epoch          | Cross-context substitution tests          |
| Nonce reuse breaks AES-GCM               | CSPRNG 96-bit nonce plus per-key uniqueness tests; rotate after implementation limits              | Collision and deterministic-fixture tests |
| Backend downgrades protocol              | Account minimum suite and signed capability state; fail closed                                     | Downgrade matrix                          |
| Attacker replays a message               | Client mutation ID, object ID, sequence checks, signed envelope, idempotency constraint            | Replay tests                              |
| Server omits messages                    | Signed sequence checkpoints or transparency records detect gaps                                    | Truncation and fork tests                 |
| Removed device reads future content      | Rotate affected conversation/workspace epochs and exclude device                                   | Revocation race tests                     |
| New member reads old content             | Product policy chooses history sharing; clients wrap only approved epochs                          | Membership matrix                         |
| Lost devices cause permanent loss        | Confirmed recovery key and multi-device enrollment                                                 | Recovery drills                           |
| Recovery service becomes escrow          | Recovery secret remains customer-held and client-side KDF runs locally                             | Server-inspection test                    |
| XSS uses browser keys                    | Strict CSP, trusted-types policy, dependency control, release integrity, short plaintext lifetime  | Browser security review                   |
| Malicious web release captures plaintext | Signed release transparency, deployment separation, independent monitoring; disclose residual risk | Release tamper exercise                   |
| Local malware reads process memory       | OS hardening, least lifetime, no swap/dumps where controllable; disclose endpoint limit            | Platform assessment                       |
| Push notification leaks text             | Generic notification or client notification extension with protected key access                    | APNs payload inspection                   |
| Search index leaks terms                 | Encrypt persistent index with device storage key; avoid server blind indexes by default            | Disk inspection                           |
| Attachment metadata leaks                | Encrypt bytes, filename, MIME detail, caption, and thumbnails                                      | Object-store inspection                   |
| Logs retain tool arguments               | Structured allowlist logging and synthetic secret canaries                                         | Log pipeline scan                         |
| Support requests content                 | Customer-generated, visibly scoped diagnostic bundle with separate consent                         | Support workflow test                     |
| Processor receives excess context        | Runtime composes bounded context and records visible processor disclosure                          | Processor contract tests                  |

## 5. Out-of-scope protections

E2EE cannot protect plaintext after:

- an authorized recipient copies, exports, screenshots, or forwards it;
- malware controls an authorized endpoint;
- the customer sends it to an agent model or connected application;
- a removed member retained content from an authorized period; or
- the customer loses every recovery route.

Relay must state these limits without weakening the default encryption promise.

## 6. Metadata exposure

Relay can observe account relationships, device and runtime presence,
ciphertext sizes, timing, traffic volume, routing targets, status, and
subscription data. Padding can reduce size leakage but increases storage and
bandwidth. The first release should pad small text envelopes to documented size
buckets and record the final choice in `DECISIONS.md`.

## 7. Reassessment triggers

Review this model before adding:

- managed runtime zero-access claims or confidential compute;
- enterprise key escrow, legal hold, or compliance export;
- server-side encrypted search or searchable-encryption indexes;
- public sharing, guest access, bots, email ingestion, or webhook ingestion;
- background server automation that needs customer content;
- a new browser cryptographic baseline;
- a new encryption suite or key-recovery method; or
- any support or moderation workflow that accesses content.
