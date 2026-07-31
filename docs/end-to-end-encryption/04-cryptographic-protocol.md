# Cryptographic protocol

Status: proposed protocol `relay-e2ee-v1`; external cryptographic review required

## 1. Design rules

- Use platform cryptographic libraries or a reviewed cross-platform library.
- Do not design custom primitives.
- Use explicit binary encodings and canonical serialization.
- Bind authorization context through authenticated data.
- Version every key, envelope, signature, and serialization format.
- Reject unknown suites, malformed values, invalid signatures, duplicate
  object IDs, and context mismatches.
- Keep cryptographic agility without allowing downgrade.

## 2. Proposed suite

| Purpose                                     | Primitive                          |
| ------------------------------------------- | ---------------------------------- |
| Content encryption                          | AES-256-GCM                        |
| Device key agreement                        | P-256 ECDH                         |
| Device signatures                           | P-256 ECDSA with SHA-256           |
| Key derivation                              | HKDF-SHA-256                       |
| Recovery passphrase derivation, if approved | Argon2id with versioned parameters |
| Hashing and fingerprints                    | SHA-256                            |
| Randomness                                  | Operating-system CSPRNG            |

P-256 gives the first release a shared implementation path through CryptoKit,
Web Crypto, Secure Enclave where supported, and common runtime libraries. The
security reviewer may approve X25519 and Ed25519 after the browser support
matrix and native key-storage design pass review. The project must record any
suite change in `DECISIONS.md`.

## 3. Key hierarchy

```text
Customer recovery key
  wraps -> account root key

Device encryption public keys
  wrap -> account/workspace root key epochs

Workspace root key epoch
  derives or wraps -> conversation content key epochs
                     object-family keys
                     local sync/export keys

Conversation content key epoch
  encrypts -> message and conversation-content envelopes
```

Use random keys rather than passwords for account, workspace, conversation, and
object-family keys. Derive purpose-specific keys with HKDF labels. Never reuse
one raw key for content encryption, key wrapping, indexing, and export.

## 4. Message envelope

The canonical envelope uses a stable binary encoding such as deterministic
CBOR. JSON APIs transport base64url-encoded binary values.

```json
{
  "protocol": "relay-e2ee-v1",
  "suite": "P256_HKDF_SHA256_AES256GCM",
  "objectType": "message",
  "objectId": "opaque-id",
  "workspaceId": "opaque-id",
  "threadId": "opaque-id",
  "senderPrincipalId": "opaque-id",
  "senderDeviceId": "opaque-id",
  "keyEpoch": 4,
  "nonce": "base64url-12-bytes",
  "ciphertext": "base64url-bytes",
  "signature": "base64url-signature",
  "clientMutationId": "opaque-id",
  "createdAtClient": "RFC3339"
}
```

The encrypted plaintext contains:

```json
{
  "schema": "relay-message-content-v1",
  "content": "text or structured content",
  "contentFormat": "markdown",
  "replyToId": "opaque-id-or-null",
  "attachments": [],
  "embeddedCard": null,
  "privateMetadata": {}
}
```

Relay Cloud assigns server order and receipt time outside the encrypted
payload. Clients must display server order while retaining the signed client
time as provenance.

## 5. Associated data

Construct AEAD associated data from a canonical encoding of:

- protocol and suite;
- deployment, account, workspace, thread, and object IDs;
- object type and content schema;
- sender principal and device IDs;
- key epoch;
- client mutation ID; and
- immutable routing class.

Do not include mutable delivery, read, archive, or server-sequence state in the
content AEAD. Sign the complete immutable envelope after encryption. A server
must not alter a signed field.

## 6. Key wrapping

For each recipient device:

1. The sending device generates an ephemeral P-256 ECDH key.
2. It derives a key-encryption key with HKDF-SHA-256 using the recipient public
   key, ephemeral shared secret, protocol label, recipient device ID, key ID,
   and epoch.
3. It wraps the target key with AES-256-GCM.
4. It signs the wrap record.
5. Relay stores the ephemeral public key, wrapped key, nonce, epoch, sender
   device, recipient device, and signature.

An implementation may batch recipient wraps, but each recipient record must
remain independently verifiable and revocable.

## 7. Signatures and trust

Each device has a signing key distinct from its encryption key. A trusted
device signs:

- device enrollment approvals;
- public-key changes;
- wrapped-key recipient changes;
- message and protected-object envelopes;
- revocation and key-rotation statements; and
- signed sequence checkpoints if the transparency design uses them.

Clients verify the signing chain and current membership before accepting a
message. The backend's authentication result cannot replace the cryptographic
sender check.

## 8. Nonces and limits

- Generate a fresh 96-bit AES-GCM nonce for every encryption operation.
- Never derive a nonce from timestamps or object IDs.
- Enforce a per-key message and byte ceiling set below conservative GCM bounds.
- Rotate the conversation key before reaching the ceiling.
- Treat nonce collision detection as a fatal client error and security event.
- Prevent retry code from re-encrypting different plaintext under a reused
  nonce. Retries should resend the same envelope or create a new nonce.

## 9. Padding

The content encoder should pad text payloads into size buckets before
encryption. Suggested initial buckets are 256 B, 1 KiB, 4 KiB, 16 KiB, 64 KiB,
and exact-size streaming chunks above 64 KiB. Review bandwidth measurements
before approval. Store the true length inside the encrypted payload.

## 10. Streaming attachments

- Generate a random attachment key per attachment.
- Encrypt fixed-size chunks with unique nonce derivation approved by the
  cryptographic reviewer.
- Authenticate attachment ID, chunk index, total chunks, content-key epoch, and
  encrypted manifest hash.
- Encrypt the attachment manifest, including filename, media type, byte count,
  thumbnails, captions, and checksums.
- Verify all chunks and the manifest before exposing a completed download.
- Never serve decrypted bytes through Relay Cloud.

## 11. Canonical serialization and test vectors

The shared protocol package must publish:

- byte-level encoding rules;
- accepted and rejected base64url forms;
- canonical map ordering and integer representation;
- Unicode normalization policy;
- envelope and associated-data fixtures;
- key-wrap fixtures for each supported platform;
- empty, Unicode, large, attachment, edit, and rotation cases; and
- negative vectors for tag, signature, context, epoch, and truncation errors.

macOS, iOS, web, backend validation, and runtime implementations must consume
the same fixture files. No platform may maintain hand-copied expected values.

## 12. Algorithm lifecycle

The account record stores a minimum accepted protocol and suite. Clients may
read newer envelopes only after they support the suite. A suite migration
wraps existing content keys to new device keys where possible; it should avoid
decrypting and re-encrypting all content unless the content cipher changes.

Security owners must publish:

- supported and deprecated suites;
- minimum client releases;
- key and nonce limits;
- emergency disable procedure;
- downgrade rejection tests; and
- the retirement date and backup consequences for each suite.
