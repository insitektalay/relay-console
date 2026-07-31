# Requirements traceability

Status: initial release ledger

Implementation must replace planned evidence with exact code, test, build, and
deployment references.

## Product and privacy

| ID          | Requirement                                                                      | Owner                  | Required evidence                    |
| ----------- | -------------------------------------------------------------------------------- | ---------------------- | ------------------------------------ |
| E2EE-PR-001 | Relay stores and routes protected content without a Relay-held decryption route. | Security/backend       | Operator zero-access exercise        |
| E2EE-PR-002 | Encryption applies by default to new accounts and migrated accounts.             | Product/clients        | New and existing account acceptance  |
| E2EE-PR-003 | Relay separates account recovery from content recovery.                          | Auth/clients           | Password-reset and lost-device tests |
| E2EE-PR-004 | Product identifies every endpoint and processor that can receive plaintext.      | Product/security       | Device and processor UI review       |
| E2EE-PR-005 | Managed cloud processing uses a distinct, explicit disclosure.                   | Product/runtime        | Consent and runtime-path tests       |
| E2EE-PR-006 | Customer claims state metadata, endpoint, processor, and recovery limits.        | Legal/product/security | Approved published copy              |

## Protocol and keys

| ID          | Requirement                                                                            | Owner               | Required evidence                |
| ----------- | -------------------------------------------------------------------------------------- | ------------------- | -------------------------------- |
| E2EE-CR-001 | All platforms use one canonical versioned protocol and fixture set.                    | Shared contracts    | Full producer/consumer matrix    |
| E2EE-CR-002 | AEAD binds deployment, workspace, thread, object, sender, epoch, and mutation context. | Crypto owners       | Context-substitution tests       |
| E2EE-CR-003 | Device signatures authenticate envelopes and trust changes.                            | Crypto owners       | Forgery and key-change tests     |
| E2EE-CR-004 | Relay never receives device private keys, content keys, or recovery secrets.           | All components      | Storage, network, log inspection |
| E2EE-CR-005 | Nonce, key-use, and rotation limits fail closed.                                       | Crypto owners       | Limit and collision tests        |
| E2EE-CR-006 | Clients reject downgrade, unknown suite, bad tag, bad signature, and revoked epoch.    | All clients/runtime | Negative fixture suite           |

## Devices, membership, and recovery

| ID          | Requirement                                                               | Owner               | Required evidence             |
| ----------- | ------------------------------------------------------------------------- | ------------------- | ----------------------------- |
| E2EE-DV-001 | Existing trusted device or recovery key approves a new decryption device. | Auth/clients        | Enrollment MITM matrix        |
| E2EE-DV-002 | Device revocation removes future access and rotates affected epochs.      | Backend/clients     | Online/offline race tests     |
| E2EE-DV-003 | Membership changes update signed recipients and key epochs.               | Workspace/clients   | Add/remove/history matrix     |
| E2EE-DV-004 | Recovery works across all supported clients without Relay escrow.         | Clients             | Cross-platform recovery drill |
| E2EE-DV-005 | Enterprise recovery remains customer controlled and visible.              | Enterprise/security | Escrow-boundary review        |

## Data and backend

| ID          | Requirement                                                                                 | Owner           | Required evidence                   |
| ----------- | ------------------------------------------------------------------------------------------- | --------------- | ----------------------------------- |
| E2EE-BE-001 | Protected entity fields use encrypted envelopes with no plaintext companion.                | Backend/data    | Schema inventory and constraints    |
| E2EE-BE-002 | REST, websocket, sync, queues, dead letters, and object storage carry ciphertext.           | Backend         | Synthetic-secret pipeline scan      |
| E2EE-BE-003 | Backend validates authorization, signatures, recipient eligibility, order, and idempotency. | Backend         | IDOR, replay, and sequencing suites |
| E2EE-BE-004 | Activated accounts cannot submit plaintext protected fields.                                | Backend         | Legacy-client and DTO rejection     |
| E2EE-BE-005 | Control metadata follows the approved allowlist and retention.                              | Privacy/backend | Metadata inventory review           |

## Runtime and Marketplace

| ID          | Requirement                                                                   | Owner               | Required evidence               |
| ----------- | ----------------------------------------------------------------------------- | ------------------- | ------------------------------- |
| E2EE-RT-001 | User-owned runtimes decrypt dispatches and encrypt replies at the endpoint.   | Runtime/bridge      | Direct and team live acceptance |
| E2EE-RT-002 | Backend content-dependent routing and analysis move to trusted processing.    | Backend/runtime     | Feature parity matrix           |
| E2EE-RT-003 | Runtime logs, arguments, files, and crashes contain no protected plaintext.   | Runtime/security    | Host leakage scan               |
| E2EE-RT-004 | Connector and model processors receive bounded content under visible consent. | Marketplace/product | Processor contract tests        |
| E2EE-RT-005 | Scheduled unattended work blocks or uses an authorized disclosed processor.   | Schedule/runtime    | Offline runtime matrix          |

## Clients and features

| ID          | Requirement                                                                            | Owner               | Required evidence                         |
| ----------- | -------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------- |
| E2EE-CL-001 | macOS protects keys and local content, syncs ciphertext, and hosts trusted processing. | macOS               | Keychain, SQLite, sync, runtime tests     |
| E2EE-CL-002 | Web protects keys and persistent content and never server-renders plaintext.           | Web                 | Storage, CSP, hydration, deployment tests |
| E2EE-CL-003 | iPhone and iPad protect keys, SwiftData, notifications, backups, and background state. | iOS                 | Device and simulator security tests       |
| E2EE-CL-004 | Search, previews, drafts, offline state, exports, and notifications preserve E2EE.     | Feature owners      | Feature acceptance matrix                 |
| E2EE-CL-005 | Attachments encrypt bytes and private metadata before upload.                          | All clients/storage | Chunk and object-store tests              |
| E2EE-CL-006 | All clients expose device, recovery, processor, and integrity states accessibly.       | Design/clients      | Accessibility and localization review     |

## Migration and operations

| ID          | Requirement                                                                                    | Owner              | Required evidence                         |
| ----------- | ---------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------- |
| E2EE-MG-001 | Trusted endpoints migrate existing plaintext through resumable verified batches.               | Migration/clients  | Snapshot rehearsal and interruption suite |
| E2EE-MG-002 | Migration covers every inventory row, local copy, attachment, queue, and export.               | Program owners     | Zero unowned inventory rows               |
| E2EE-MG-003 | Relay removes plaintext stores and waits for controlled backup expiry before full claim.       | Data/operations    | Destruction and retention ledger          |
| E2EE-OP-001 | Operator and support workflows remain content-free.                                            | Operations/support | Role and support acceptance               |
| E2EE-OP-002 | Logs, telemetry, crashes, and diagnostics reject synthetic plaintext.                          | Observability      | Canary scan                               |
| E2EE-OP-003 | Backup restore preserves keys, epochs, revocation, and ciphertext usability.                   | Operations         | Restore drill                             |
| E2EE-OP-004 | Incident runbooks cover device, recovery, web release, crypto, infrastructure, and log events. | Security           | Tabletop and technical exercises          |

## Release

| ID          | Requirement                                                                                    | Owner                  | Required evidence                    |
| ----------- | ---------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------ |
| E2EE-RL-001 | Independent reviewers approve architecture and implementation; no open critical/high findings. | Security leadership    | Signed review record                 |
| E2EE-RL-002 | Release-bound macOS, web, iPhone/iPad, backend, and runtime builds pass.                       | Release owners         | Build IDs and exact tests            |
| E2EE-RL-003 | Railway deployment and migrations complete from `backend/`.                                    | Backend operations     | Deployment ID and migration evidence |
| E2EE-RL-004 | Customer migration, recovery, and old-client experiences pass.                                 | Product/release        | Cohort and failure-path evidence     |
| E2EE-RL-005 | Public claims remain disabled until backup retirement and zero-access proof complete.          | Product/legal/security | Launch approval                      |
