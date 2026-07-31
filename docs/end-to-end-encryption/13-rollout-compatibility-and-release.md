# Rollout, compatibility, and release

Status: proposed

## 1. Release phases

### Phase 0: design approval

- Approve privacy contract, threat model, algorithms, metadata boundary,
  recovery, managed-runtime policy, and browser disclosure.
- Complete field and processor inventories.
- Obtain external protocol review.

### Phase 1: protocol foundation

- Build canonical encoding, fixtures, and platform crypto wrappers.
- Add device public-key and capability records.
- Add content-free monitoring.
- Keep production behavior unchanged.

### Phase 2: device and recovery foundation

- Release device keys, enrollment, recovery, settings, revocation, and rotation
  across macOS, web, iPhone, and iPad.
- Enroll runtime identities.
- Require recovery confirmation without encrypting history yet.

### Phase 3: ciphertext backend and runtime

- Deploy encrypted DTOs, entities, websocket events, queues, and constraints to
  Railway from `backend/`.
- Release runtime encrypted dispatch and reply.
- Verify synthetic tenants without customer migration.

### Phase 4: new encrypted writes

- Require minimum client and runtime versions.
- Enable encrypted writes for internal and invited test accounts.
- Block plaintext writes for activated accounts.
- Run direct, team, attachment, offline, schedule, approval, and connector
  acceptance.

### Phase 5: existing customer migration

- Offer a scheduled migration window.
- Require device and recovery readiness.
- Encrypt history and all protected object families.
- Provide progress, safe retry, and customer-visible blockers.

### Phase 6: plaintext destruction

- Verify migrations and processor behavior.
- Remove plaintext columns, queues, indexes, local stores, and exports.
- Start the final backup-retirement clock.
- Remove legacy code and compatibility DTOs.

### Phase 7: public claim

- Close independent-review findings.
- Complete backup retirement and operator zero-access exercise.
- Publish protocol, security explanation, limitations, and build support.
- Enable approved customer language.

## 2. Compatibility gates

An encryption-activated account requires:

- backend support for the account minimum protocol;
- a client that can read and write the current suite;
- a runtime that can decrypt assigned dispatches and encrypt replies;
- recipient devices with valid public keys; and
- no pending mandatory rotation.

Older clients may show an upgrade screen and safe metadata. They cannot read
content, send plaintext, or lower the account minimum.

## 3. Cross-platform release order

1. Backend read-compatible schema and device APIs.
2. Runtime support.
3. macOS, iPhone/iPad, and web device/recovery support.
4. Backend ciphertext write path and realtime events.
5. All clients with encrypted content support.
6. Account activation.
7. History migration and plaintext removal.

The team may reorder release publication, but account activation waits until
every customer workflow has a supported endpoint.

## 4. Feature flags

Permitted flags:

- show device setup;
- enable synthetic test tenant;
- enable encrypted writes for an allowlisted test account;
- enable migration by cohort; and
- require a higher minimum protocol.

Forbidden flags:

- decrypt on the server for selected users;
- allow plaintext fallback;
- skip signature or tag verification;
- retain a hidden support key;
- send plaintext to analytics; or
- bypass recovery confirmation.

## 5. Customer transition

Customers need:

- an explanation of the new trust and recovery model;
- a list of devices and runtimes that will gain access;
- a required recovery-key setup;
- migration duration and device-power/network expectations;
- clear behavior for old clients and offline runtimes;
- disclosure of cloud-processed features;
- progress by content category; and
- a completion state that distinguishes active encryption from expired
  plaintext backups.

Business administrators need a member, recovery, legal-hold, and device policy
review before migration.

## 6. Failure handling

- Key setup failure leaves the account in its current state and creates no
  partial trust record.
- Encrypted-write failure queues ciphertext on the endpoint.
- Migration failure resumes from a verified checkpoint.
- Undecryptable content shows an integrity or key-availability error without
  overwriting the object.
- Runtime incompatibility blocks dispatch and identifies the required upgrade.
- Backend rollback preserves ciphertext and never asks for plaintext.

## 7. Launch gates

- All `E2EE-*` requirements have evidence.
- Supported platform and runtime versions pass interoperability.
- Production accepts no plaintext protected writes for activated accounts.
- Field and processor inventories have no unowned rows.
- Independent reviewers approve the protocol and implementation.
- Security owners close critical and high findings.
- Production operator exercise cannot recover fixture content.
- Plaintext backups and historical Relay-controlled copies have expired or
  been destroyed.
- Incident and recovery exercises pass.
- Customer language matches `15-customer-communications-and-claims.md`.

## 8. Post-launch

Track undecryptable-object rates, revocation lag, recovery failures, old-client
attempts, migration remnants, processor disclosures, and web release
integrity. Review the threat model after material architecture changes and at
least once per year.
