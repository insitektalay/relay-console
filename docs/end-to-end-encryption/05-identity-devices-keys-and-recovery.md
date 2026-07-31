# Identity, devices, keys, and recovery

Status: proposed

## 1. Separate account login from content access

Relay authentication proves that a person controls an account. Device
enrollment proves that one device may receive content keys. Password reset,
email recovery, OAuth login, and support action must not grant content access
without an authorized device or recovery key.

## 2. Device record

Relay stores a public record for each enrolled endpoint:

| Field                                                 | Treatment                      |
| ----------------------------------------------------- | ------------------------------ |
| Device ID and account/workspace membership            | Clear control metadata         |
| Platform, app version, protocol capability            | Clear bounded metadata         |
| Encryption and signing public keys                    | Public                         |
| Human-readable device label                           | Encrypt when customer supplied |
| Enrollment approver and signed statement              | Public integrity record        |
| Created, last-seen, revoked, and key-epoch timestamps | Clear control metadata         |
| Private keys and recovery material                    | Never sent to Relay            |

Web browser profiles count as devices. Clearing site data removes that device's
private key and requires re-enrollment.

## 3. First-device setup

1. The client creates device encryption and signing keys.
2. The client creates an account root key and recovery key.
3. The client wraps the account root key to the device and recovery key.
4. The customer saves the recovery key and proves possession by confirming
   selected groups or scanning it on another device.
5. The client uploads public keys, signed enrollment state, and wrapped keys.
6. Relay marks content encryption active only after round-trip verification.

Setup must block screenshots of the recovery key where the platform supports
that control, clear clipboard content after a short interval, and never record
the key in analytics or crash reports.

## 4. Adding a device

Preferred enrollment uses an existing trusted device:

1. The new device creates keys and displays a QR code or verification phrase
   containing its public keys and a one-time enrollment session.
2. The trusted device fetches the enrollment request, compares a human-visible
   fingerprint, and obtains explicit approval.
3. The trusted device signs the new device record and wraps current authorized
   keys to it.
4. The new device verifies the approval chain and decrypts a challenge.
5. Relay closes the one-time session and rejects reuse.

Recovery-key enrollment follows the same public-key validation but unwraps the
account root key locally. Relay never receives the recovery key.

Email links, SMS codes, login success, and Relay support approval cannot enroll
a decryption device by themselves.

## 5. Workspace and conversation membership

- Personal workspace devices receive the personal workspace root key.
- Business workspaces maintain separate key state from personal workspaces.
- Conversation keys go only to devices belonging to authorized conversation
  members and assigned trusted runtimes.
- The recipient set is signed and visible to members.
- A membership change creates a new key epoch.
- Product policy decides whether a new member receives prior epochs. The
  customer must see that choice before key sharing.

For large workspaces, use a reviewed group-key scheme or sender-key design only
after the v1 recipient-wrap implementation provides a correct baseline.

## 6. Revocation

Revocation must:

1. authenticate and authorize the actor;
2. publish a signed revocation statement;
3. stop websocket and API sessions for the device;
4. rotate affected future key epochs;
5. exclude the device from new wrapped-key records;
6. reject new envelopes signed after the revocation boundary; and
7. show members the completed rotation state.

Revocation cannot erase keys or plaintext already copied by the device.

## 7. Key rotation

Rotate keys after:

- member or device removal;
- suspected device compromise;
- cryptographic suite migration;
- nonce or byte limit;
- workspace ownership transfer;
- recovery-key replacement; or
- a security incident requiring an epoch boundary.

Rotation must survive offline devices. An offline authorized device can receive
the new epoch after reconnecting; a revoked device cannot.

## 8. Recovery

The recommended recovery artifact is a random, high-entropy key encoded in a
human-recordable format with checksum and version. A user-chosen passphrase
should protect a recovery key only if Argon2id parameters meet the independent
review and the UI warns against weak phrases.

Supported recovery paths:

- approval from another trusted device;
- account recovery key; and
- customer-controlled enterprise recovery key for workspaces that enable it.

Relay support can help restore login access and identify enrolled devices.
Support cannot generate, disclose, or bypass the content key.

## 9. Enterprise recovery and escrow

An enterprise workspace may enroll a recovery principal controlled by the
customer. The workspace must show:

- who controls the recovery private key;
- which conversations and epochs it can recover;
- every recovery-key addition, use, replacement, and removal;
- whether legal hold or export uses the key; and
- the effect on the zero-access claim.

Relay must not hold the enterprise private key. A Relay-hosted escrow service
would create operator decryption capability and requires a different claim.

## 10. Platform storage

| Platform     | Private-key storage                                                                  | Local content-key storage                                |
| ------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| macOS        | Keychain; Secure Enclave-backed P-256 where lifecycle requirements permit            | Wrapped records in local DB, unwrapped only in process   |
| iPhone/iPad  | Keychain with device-only accessibility; Secure Enclave-backed keys where compatible | Wrapped records under Data Protection                    |
| Web          | Non-exportable Web Crypto keys in IndexedDB                                          | Wrapped records in IndexedDB; no raw key in localStorage |
| User runtime | OS credential store or root-owned encrypted keystore                                 | Wrapped keys scoped to runtime identity                  |

Backups must not silently clone a device identity to a second device. Native
key accessibility and backup flags need explicit tests.

## 11. Device UX requirements

Settings must show active devices, platform, enrollment date, recent activity,
approver, verification state, and revoke action. Unknown-device alerts contain
no customer content. High-risk changes require recent authentication and
confirmation on a trusted endpoint.
