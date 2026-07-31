# Implementation tracker

Status: planning ledger; no work item is complete

Use one issue or work package per row. Replace `TBD` with owner, issue, commit,
tests, release build, deployment, reviewer, and date.

## 0. Governance and discovery

| Work                                                 | Owner | Status      | Evidence |
| ---------------------------------------------------- | ----- | ----------- | -------- |
| Approve product/privacy contract                     | TBD   | Not started | TBD      |
| Complete field-level data inventory                  | TBD   | Not started | TBD      |
| Complete processor and subprocessor inventory        | TBD   | Not started | TBD      |
| Inspect production backups and retention             | TBD   | Not started | TBD      |
| Decide all protocol-gate questions in `DECISIONS.md` | TBD   | Not started | TBD      |
| Commission architecture cryptographic review         | TBD   | Not started | TBD      |

## 1. Shared protocol

| Work                                                  | Owner | Status      | Evidence |
| ----------------------------------------------------- | ----- | ----------- | -------- |
| Canonical binary encoding package                     | TBD   | Not started | TBD      |
| AEAD and associated-data contract                     | TBD   | Not started | TBD      |
| Device key agreement and signature contract           | TBD   | Not started | TBD      |
| Key-wrap and epoch contract                           | TBD   | Not started | TBD      |
| Attachment streaming contract                         | TBD   | Not started | TBD      |
| Cross-platform fixture generator and negative vectors | TBD   | Not started | TBD      |
| Protocol version and downgrade policy                 | TBD   | Not started | TBD      |

## 2. Backend and Railway

| Work                                                     | Owner | Status      | Evidence |
| -------------------------------------------------------- | ----- | ----------- | -------- |
| Encryption account/device/key entities and migration     | TBD   | Not started | TBD      |
| Encrypted object/message schema and constraints          | TBD   | Not started | TBD      |
| Device enrollment, approval, revoke, and recovery APIs   | TBD   | Not started | TBD      |
| Wrapped-key and recipient-set APIs                       | TBD   | Not started | TBD      |
| Ciphertext message, sync, and realtime contracts         | TBD   | Not started | TBD      |
| Signed routing targets and server validation             | TBD   | Not started | TBD      |
| Ciphertext-only queues, dead letters, and object storage | TBD   | Not started | TBD      |
| Plaintext write rejection after activation               | TBD   | Not started | TBD      |
| Content-free admin, audit, support, and monitoring       | TBD   | Not started | TBD      |
| Railway deploy and migration rehearsal                   | TBD   | Not started | TBD      |

## 3. Runtime and Marketplace

| Work                                             | Owner | Status      | Evidence |
| ------------------------------------------------ | ----- | ----------- | -------- |
| Runtime device keys and secure storage           | TBD   | Not started | TBD      |
| Encrypted dispatch verification and decryption   | TBD   | Not started | TBD      |
| Local recent-context and routing behavior        | TBD   | Not started | TBD      |
| Encrypted signed agent reply                     | TBD   | Not started | TBD      |
| Runtime log, file, argument, and crash hardening | TBD   | Not started | TBD      |
| Team orchestration parity                        | TBD   | Not started | TBD      |
| Schedule and unattended-work contract            | TBD   | Not started | TBD      |
| Connector-by-connector processor classification  | TBD   | Not started | TBD      |
| Trusted-runtime Marketplace execution path       | TBD   | Not started | TBD      |
| Managed-runtime product and technical decision   | TBD   | Not started | TBD      |

## 4. Relay Console macOS

| Work                                                 | Owner | Status      | Evidence |
| ---------------------------------------------------- | ----- | ----------- | -------- |
| CryptoKit/Keychain device identity                   | TBD   | Not started | TBD      |
| Enrollment, recovery, device settings, and revoke UI | TBD   | Not started | TBD      |
| Encrypted cloud DTO and sync integration             | TBD   | Not started | TBD      |
| Local SQLite/store encryption and migration          | TBD   | Not started | TBD      |
| Encrypted outbox, drafts, previews, and search       | TBD   | Not started | TBD      |
| Attachment encryption and export                     | TBD   | Not started | TBD      |
| Runtime-host integration                             | TBD   | Not started | TBD      |
| Leakage, accessibility, and interoperability tests   | TBD   | Not started | TBD      |

## 5. Web

| Work                                                    | Owner | Status      | Evidence |
| ------------------------------------------------------- | ----- | ----------- | -------- |
| Web Crypto device identity and IndexedDB storage        | TBD   | Not started | TBD      |
| Enrollment, recovery, device settings, and revoke UI    | TBD   | Not started | TBD      |
| Client-only decryption boundary                         | TBD   | Not started | TBD      |
| Encrypted query persistence, outbox, drafts, and search | TBD   | Not started | TBD      |
| Attachment encryption and export                        | TBD   | Not started | TBD      |
| CSP, Trusted Types, dependency and asset integrity      | TBD   | Not started | TBD      |
| Server-rendering and telemetry plaintext exclusions     | TBD   | Not started | TBD      |
| Leakage, accessibility, and interoperability tests      | TBD   | Not started | TBD      |

## 6. iPhone and iPad

| Work                                                   | Owner | Status      | Evidence |
| ------------------------------------------------------ | ----- | ----------- | -------- |
| CryptoKit/Keychain device identity                     | TBD   | Not started | TBD      |
| Enrollment, recovery, device settings, and revoke UI   | TBD   | Not started | TBD      |
| Encrypted API, sync, and realtime integration          | TBD   | Not started | TBD      |
| SwiftData/store encryption and migration               | TBD   | Not started | TBD      |
| Encrypted outbox, drafts, previews, and search         | TBD   | Not started | TBD      |
| Attachment encryption, notifications, and export       | TBD   | Not started | TBD      |
| Backup, locked-device, background, and revoke behavior | TBD   | Not started | TBD      |
| Leakage, accessibility, and interoperability tests     | TBD   | Not started | TBD      |

## 7. Feature migrations

| Work                                                   | Owner | Status      | Evidence |
| ------------------------------------------------------ | ----- | ----------- | -------- |
| Messages, titles, previews, edits, and reactions       | TBD   | Not started | TBD      |
| Search                                                 | TBD   | Not started | TBD      |
| Attachments, artifacts, thumbnails, and extracted text | TBD   | Not started | TBD      |
| Tasks, approvals, schedules, meetings, and reports     | TBD   | Not started | TBD      |
| Agent documents, memory, and synchronized content      | TBD   | Not started | TBD      |
| Summaries, wrap-ups, and semantic analytics            | TBD   | Not started | TBD      |
| Notifications and email                                | TBD   | Not started | TBD      |
| Exports, account deletion, and support bundles         | TBD   | Not started | TBD      |

## 8. Existing data and plaintext retirement

| Work                                              | Owner | Status      | Evidence |
| ------------------------------------------------- | ----- | ----------- | -------- |
| Migration manifest and leases                     | TBD   | Not started | TBD      |
| Client-side batch encryption and verification     | TBD   | Not started | TBD      |
| Local-store migrations                            | TBD   | Not started | TBD      |
| Attachment and object-store migration             | TBD   | Not started | TBD      |
| Database plaintext removal                        | TBD   | Not started | TBD      |
| Queue, log, export, and support plaintext removal | TBD   | Not started | TBD      |
| Backup and PITR retirement ledger                 | TBD   | Not started | TBD      |
| Production zero-access exercise                   | TBD   | Not started | TBD      |

## 9. Review and release

| Work                                          | Owner | Status      | Evidence |
| --------------------------------------------- | ----- | ----------- | -------- |
| Independent implementation review             | TBD   | Not started | TBD      |
| Critical/high finding closure                 | TBD   | Not started | TBD      |
| Full interoperability and hostile test matrix | TBD   | Not started | TBD      |
| Disaster recovery and incident exercises      | TBD   | Not started | TBD      |
| Release-bound backend/runtime/client builds   | TBD   | Not started | TBD      |
| Customer migration cohort acceptance          | TBD   | Not started | TBD      |
| Legal/privacy/security claim approval         | TBD   | Not started | TBD      |
| Public protocol and security documentation    | TBD   | Not started | TBD      |

## Release summary

| Gate                             | Status      | Approver | Evidence |
| -------------------------------- | ----------- | -------- | -------- |
| Design approved                  | Not started | TBD      | TBD      |
| Protocol reviewed                | Not started | TBD      | TBD      |
| Platform implementation complete | Not started | TBD      | TBD      |
| Railway deployed                 | Not started | TBD      | TBD      |
| Existing data migrated           | Not started | TBD      | TBD      |
| Plaintext copies retired         | Not started | TBD      | TBD      |
| Independent review accepted      | Not started | TBD      | TBD      |
| Customer claim approved          | Not started | TBD      | TBD      |
