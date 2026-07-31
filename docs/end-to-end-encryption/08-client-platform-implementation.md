# Client platform implementation

Status: proposed

## 1. Shared protocol ownership

One canonical specification and fixture package owns envelope encoding,
associated data, fingerprints, protocol errors, and interoperability vectors.
Each platform may use native cryptographic APIs, but it must pass the same
fixtures.

Shared contracts must model ciphertext separately from decrypted presentation
models. UI code should not receive raw keys.

## 2. Relay Console macOS

Primary work:

- add device encryption and signing keys through CryptoKit and Keychain;
- add first-device, approval, recovery, revoke, and rotation workflows;
- replace plaintext cloud-sync DTOs with encrypted envelopes;
- add a crypto boundary that decrypts only after authorization;
- migrate SQLite content, previews, outbox entries, attachments, and indexes;
- encrypt the local database at field level or with a reviewed database
  encryption layer and protect its key in Keychain;
- update local/runtime dispatch so plaintext stays inside the trusted host;
- encrypt agent replies before Railway postback;
- keep local-only workspaces functional under a separate local data contract;
  and
- add device, encryption-state, processor, and recovery settings.

macOS must prevent decrypted content from entering Spotlight, state
restoration, pasteboard history where controllable, crash reports, logs,
temporary files, and unprotected exports.

## 3. iPhone and iPad

Primary work:

- generate device keys and store them with device-only Keychain accessibility;
- use CryptoKit for protocol operations;
- support QR approval, fingerprint comparison, recovery, revocation, and
  rotation;
- replace SwiftData plaintext `CachedMessage.content` and encoded plaintext
  blobs with encrypted records;
- apply iOS Data Protection to databases, attachments, indexes, and exports;
- decrypt into short-lived view models;
- make notification payloads generic or decrypt through a reviewed
  notification service extension;
- clear protected data after sign-out, remote device revocation, and account
  removal according to policy; and
- test device backup, restore, migration, background refresh, and locked-device
  behavior.

iPhone and iPad share the protocol and persistence behavior. Platform layout
may differ.

## 4. Browser application

Primary work:

- use Web Crypto for device keys, key agreement, signing, AES-GCM, and HKDF;
- store non-exportable private keys and wrapped content keys in IndexedDB;
- never place keys or decrypted content in localStorage, URLs, service-worker
  logs, error telemetry, or server-rendered HTML;
- decrypt after hydration in a client-only content boundary;
- keep protected pages out of shared caches and pre-rendering;
- encrypt offline data, search indexes, drafts, and outbox entries;
- add device enrollment, recovery, rotation, revoke, and untrusted-browser
  states;
- apply strict CSP, Trusted Types, dependency pinning, release integrity, and
  production source-map controls;
- minimize plaintext lifetime in JavaScript objects; and
- clear IndexedDB and in-memory keys on sign-out or device revocation.

The web client must never send protected content through Next.js server
components, server actions, edge logs, analytics events, or error pages.

## 5. Browser trust disclosure

Relay serves the web application's JavaScript, so a compromised deployment
could use an enrolled browser key to read future content. Release controls must
reduce this risk:

- separate deployment authority from production data authority;
- require reviewed, reproducible, signed web releases;
- publish build identifiers and asset hashes;
- monitor production assets from an independent account;
- enforce CSP without broad inline or dynamic-code exceptions; and
- document that native clients provide a stronger endpoint boundary.

## 6. Presentation model

Each client should use:

```text
Encrypted transport model
  -> verified envelope
  -> decrypted domain model
  -> redacted presentation model
```

The decrypted model must not conform to broad logging or diagnostic protocols.
Errors carry safe codes and object IDs rather than content.

## 7. Platform parity requirements

All clients must support:

- the active protocol and key epochs;
- device list, verification, enrollment, and revoke;
- recovery-key setup and recovery;
- encrypted messages, titles, attachments, edits, reactions, and tombstones;
- offline encrypted outbox and retry;
- key rotation and revoked-device behavior;
- processor disclosures;
- migration progress and blocking errors; and
- export and account deletion under the encrypted contract.

One platform may not ship a plaintext fallback to preserve a missing feature.

## 8. Accessibility and localization

Encryption status cannot rely on color or an icon. Screen readers need concise
labels for verified, pending, revoked, recovery required, and cloud-processed
states. Recovery instructions, warnings, and verification phrases require
localization review that preserves exact security meaning.
