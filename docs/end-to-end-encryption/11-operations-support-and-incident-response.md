# Operations, support, and incident response

Status: proposed

## 1. Operational model

Relay operators manage availability, authorization, routing, quotas, schema,
delivery, and ciphertext storage. Operator tools show identifiers, counts,
versions, sizes, states, and content-free errors.

No production dashboard, SQL workflow, admin endpoint, impersonation feature,
or support tool may reveal protected plaintext.

## 2. Access control

- Enforce least-privilege Railway, database, object-store, and deployment
  access.
- Require MFA and separate production roles.
- Audit database proxy, shell, backup restore, variable read, and deployment
  actions.
- Separate release authority from data-plane authority where practical.
- Use time-bound break-glass access with approval and post-event review.
- Keep E2EE keys outside Relay secrets, KMS, database, and support systems.

## 3. Logging and telemetry

Use allowlisted structured events. Permitted fields include safe error code,
protocol version, object type, byte bucket, latency, result, and hashed
correlation ID.

Prohibit:

- message, title, filename, tool argument, provider result, and decrypted error;
- ciphertext samples, private keys, wrapped-key plaintext, or recovery data;
- authorization headers, cookies, tokens, and raw URLs with query values; and
- device labels or customer-entered names unless encrypted.

Run synthetic secret canaries through API, websocket, runtime, client,
notification, support, analytics, and crash pipelines.

## 4. Monitoring

Monitor:

- encryption activation and migration completion by count;
- rejected plaintext writes;
- signature, tag, context, and protocol failures;
- unexpected recipient-set changes;
- key rotation and revocation lag;
- clients below the minimum version;
- undecryptable-object rate by platform and protocol;
- backup plaintext-retirement deadlines; and
- production asset integrity for the web client.

Metrics must not include content or stable customer values when aggregation
does not require them.

## 5. Support

Support can:

- confirm account login, subscription, device IDs, protocol versions,
  migration state, delivery state, and safe error codes;
- guide device approval and recovery-key use; and
- receive a customer-created diagnostic bundle after explicit review.

Support cannot:

- reset or disclose a recovery key;
- enroll a content device through an admin override;
- decrypt messages, attachments, or exports;
- add a hidden workspace recovery recipient; or
- ask customers to paste private content into routine tickets.

## 6. Backups and disaster recovery

Backups contain ciphertext, wrapped keys, public device records, and control
metadata after migration. Recovery must preserve object order, signatures,
recipient sets, epochs, tombstones, and revocations.

A restore test must prove:

- clients can decrypt restored ciphertext;
- revoked devices remain revoked;
- the restore does not resurrect deleted wrapped keys past policy;
- no rollback lowers the account minimum protocol; and
- operators still cannot decrypt a fixture.

## 7. Incident classes

| Incident                      | Response                                                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Database or backup exposure   | Revoke infrastructure credentials, assess metadata exposure, verify ciphertext/key separation, notify under policy.          |
| Device private-key compromise | Revoke device, rotate affected future epochs, warn authorized members, preserve prior-access limitation.                     |
| Recovery-key compromise       | Replace recovery key from trusted device, rewrap account root key, review device and export activity.                        |
| Signing-key compromise        | Revoke device, reject post-boundary signatures, rotate recipient state, investigate forged envelopes.                        |
| Web release compromise        | Stop deployment, revoke affected browser devices where needed, publish build range, rotate keys after clean-client approval. |
| Cryptographic flaw            | Freeze affected operations, raise minimum protocol, ship reviewed migration, preserve ciphertext and evidence.               |
| Plaintext logging             | Stop source and sink, restrict access, delete under retention/legal review, trace affected accounts, add regression canary.  |

## 8. Security event handling

Cryptographic verification failures fail closed. Clients show a safe integrity
error and preserve the ciphertext for bounded investigation. They must not
offer "open anyway."

Security teams need a content-free evidence format containing hashes,
signatures, public keys, IDs, versions, and timestamps. A customer can choose
to decrypt and share a specific object through a separate consent flow.

## 9. Key-independent maintenance

Schema migrations, retention jobs, pagination, compaction, indexing, and
backups operate on ciphertext and metadata. A maintenance task that asks for a
content key violates the architecture and requires security review.

## 10. Operational acceptance

- Restore, failover, queue replay, and region recovery preserve encrypted
  behavior.
- Break-glass operators cannot decrypt the test tenant.
- Logs and support bundles pass synthetic-secret scans.
- Device revocation and key rotation meet the approved service target.
- Incident runbooks have named owners and completed exercises.
