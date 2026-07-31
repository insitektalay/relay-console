# Decisions and open questions

Status: proposed decision register

No open row may pass the design-approval gate without an owner, decision,
reason, and date.

## Accepted for implementation planning

| ID         | Decision                                                                                                        | Reason                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| E2EE-D-001 | Relay will target end-to-end encryption rather than server-readable message encryption.                         | A Relay-held server key does not support the customer promise.                |
| E2EE-D-002 | All supported clients and user-owned runtimes will use one versioned protocol.                                  | Separate protocols create drift and migration risk.                           |
| E2EE-D-003 | Relay will separate login recovery from content recovery.                                                       | Password reset must not become key escrow.                                    |
| E2EE-D-004 | Relay will treat user-owned runtimes as authorized decrypting endpoints.                                        | Agents need plaintext to process requests without exposing it to Relay Cloud. |
| E2EE-D-005 | Relay will move plaintext search, previews, context, summaries, and semantic analytics to trusted endpoints.    | The Railway backend cannot inspect E2EE content.                              |
| E2EE-D-006 | Relay will encrypt attachments and private metadata in the first complete release.                              | Message-only encryption would leave major customer content exposed.           |
| E2EE-D-007 | Activated accounts will have no plaintext fallback.                                                             | A fallback defeats the default privacy contract.                              |
| E2EE-D-008 | Relay will wait for controlled plaintext backup retirement before making the full historical zero-access claim. | Deleted columns can remain recoverable in backups.                            |
| E2EE-D-009 | Independent cryptographic review is a release gate.                                                             | Protocol and multi-platform key code require specialist review.               |

## Open product and security decisions

| ID         | Question                                                                        | Options                                                                                   | Owner                    | Gate               |
| ---------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------ | ------------------ |
| E2EE-Q-001 | Which v1 public-key suite will ship?                                            | P-256 ECDH/ECDSA baseline; X25519/Ed25519 after support review                            | Security architecture    | Protocol           |
| E2EE-Q-002 | How will recovery material be encoded?                                          | Random recovery key; mnemonic; random key protected by Argon2id passphrase                | Security/product         | Device setup       |
| E2EE-Q-003 | Can a new workspace member read earlier epochs?                                 | No history; selected history; all history                                                 | Product/privacy          | Membership         |
| E2EE-Q-004 | Will v1 pad message sizes?                                                      | No padding; fixed buckets; adaptive buckets                                               | Security/performance     | Protocol           |
| E2EE-Q-005 | How will large workspaces distribute keys?                                      | Per-device wraps; reviewed sender/group-key protocol                                      | Security/backend         | Scale              |
| E2EE-Q-006 | Which metadata fields remain clear?                                             | Approve final field inventory                                                             | Privacy/backend          | Schema             |
| E2EE-Q-007 | What happens to standard Relay-managed runtimes?                                | Explicit cloud-processing path; disable for protected threads; confidential compute later | Product/runtime/security | Runtime            |
| E2EE-Q-008 | Where will Marketplace actions execute?                                         | User runtime; client; disclosed Railway processor by provider                             | Marketplace/product      | Feature parity     |
| E2EE-Q-009 | How will attachment malware scanning work?                                      | Endpoint scan; disclosed cloud scan; restricted types                                     | Security/product         | Attachments        |
| E2EE-Q-010 | How will browser release integrity work?                                        | Reproducible signed assets and transparency; native-only strongest claim                  | Web/security             | Web launch         |
| E2EE-Q-011 | Will enterprise recovery exist in v1?                                           | Customer-held enterprise key; defer                                                       | Enterprise/product       | Business migration |
| E2EE-Q-012 | Which semantic analytics remain in the product?                                 | Trusted runtime processing; client processing; removal                                    | Product/analytics        | Feature parity     |
| E2EE-Q-013 | How long will encrypted tombstones and control metadata remain?                 | Set per object and legal need                                                             | Privacy/operations       | Retention          |
| E2EE-Q-014 | Which Railway backup products and retention schedules hold plaintext today?     | Production inspection required                                                            | Operations               | Migration          |
| E2EE-Q-015 | Will clients encrypt the whole local database or protected fields?              | SQLCipher/reviewed database layer; field encryption                                       | Client security          | Local storage      |
| E2EE-Q-016 | Which third-party crash and analytics SDKs remain enabled on protected screens? | Content-free configuration; remove unsupported SDK                                        | Privacy/clients          | Client launch      |

## Decision record template

```markdown
### E2EE-Q-NNN: Title

- Date:
- Owner:
- Reviewers:
- Decision:
- Alternatives:
- Security effect:
- Product effect:
- Migration effect:
- Evidence:
- Reassessment trigger:
```
