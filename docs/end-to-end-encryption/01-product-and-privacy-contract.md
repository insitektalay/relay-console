# Product and privacy contract

Status: proposed

## 1. Customer promise

Relay encrypts protected customer content on a trusted customer device or
runtime before sending it to Relay Cloud. Relay Cloud stores and routes
ciphertext. Relay does not hold the private device keys, recovery key, or
conversation keys required to decrypt that content.

The promise applies to all supported customers after migration. Relay must not
offer a hidden plaintext compatibility mode.

## 2. Terms

| Term                         | Meaning                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| End-to-end encrypted content | Content encrypted on an authorized endpoint and decrypted only on an authorized endpoint.                                |
| Trusted endpoint             | An enrolled native client, enrolled web-client key, or authorized customer runtime that holds a private key.             |
| Relay Cloud                  | Railway-hosted API, websocket, workers, PostgreSQL, Redis, object storage, backups, logs, and support systems.           |
| Control metadata             | The bounded values Relay Cloud needs for authentication, authorization, routing, ordering, billing, and abuse controls.  |
| Content processor            | A runtime, model provider, or connected application that receives plaintext after the customer authorizes the operation. |
| Recovery key                 | A customer-held secret that restores the encrypted account when trusted devices are unavailable.                         |
| Managed runtime              | Compute operated by Relay or hosted in Relay's Railway estate.                                                           |

## 3. Protected content

Relay must encrypt every field that can reveal what the customer said, wrote,
uploaded, generated, planned, approved, searched for, or asked an agent to do.
The encrypted object may contain structured JSON, text, or bytes. Splitting
private text into a nominal metadata field does not remove it from scope.

Protected content includes names supplied for private threads, private agent
instructions, document titles, attachment filenames, URL query strings,
connector search terms, tool arguments, tool results, errors containing
customer values, and notification excerpts.

## 4. Permitted control metadata

Relay Cloud may process these fields when the implementation documents a
service need:

- opaque account, workspace, thread, device, runtime, message, and object IDs;
- membership roles and encrypted-key recipient IDs;
- object type, schema version, encryption suite, key epoch, and byte length;
- server sequence, client mutation ID, creation time, deletion tombstone, and
  delivery state;
- routing targets expressed as opaque authorized principal IDs;
- generic status such as queued, delivered, failed, read, archived, or revoked;
- subscription, invoice, quota, fraud, and rate-limit data; and
- security audit events that contain identifiers and outcomes without content.

Relay must document any additional cleartext field in `DECISIONS.md`, explain
why the service needs it, set a retention period, and add a metadata leakage
test.

## 5. Claims Relay cannot make

Relay cannot say that all data is invisible to Relay. Account email,
subscription state, workspace membership, routing identifiers, timestamps,
sizes, IP-derived security signals, and service health remain visible.

Relay cannot say that content stays private from a processor the customer asks
to use. An agent runtime, model provider, or connected application receives the
plaintext needed for the requested operation.

Relay cannot make the same zero-access claim for a managed runtime that Relay
can inspect. The product must either:

1. exclude Relay-managed runtimes from the zero-access mode and require a clear
   customer choice; or
2. add independently attested confidential compute whose keys remain
   unavailable to Relay operators.

The first release should use customer-owned runtimes for the zero-access
promise. `DECISIONS.md` keeps the managed-runtime choice open until product and
security owners approve it.

## 6. Default behavior

- New accounts create encrypted account state during setup.
- Existing accounts must complete device and recovery setup before migration.
- New conversations use encryption without a per-thread opt-in.
- The UI shows encryption state and verified devices without asking customers
  to understand algorithms.
- A client that cannot satisfy the encryption contract blocks content access
  and asks for an upgrade or device approval.
- Relay support cannot bypass encryption or reset the recovery key.

## 7. Business workspace behavior

Workspace administrators control membership but do not gain an invisible
master decryption key. Adding a member requires an authorized current member
or approved enterprise recovery role to wrap the current workspace or
conversation keys to the new member's device.

Removing a member prevents access to future key epochs. A removed member may
retain content and keys that the member had permission to access before
removal. Product and legal copy must state this limit.

Enterprise escrow, legal hold, discovery, and administrator recovery conflict
with the zero-access promise unless the customer controls the escrow key.
Relay must offer those features only through customer-controlled keys and
visible workspace policy.

## 8. Availability and recovery

Relay cannot recover encrypted content when the customer loses all authorized
devices and the recovery key. Setup must explain this outcome, require a
recovery-key confirmation, and offer device-to-device recovery before data
loss occurs.

The service must distinguish:

- account authentication recovery, which Relay may provide; and
- content-key recovery, which Relay cannot provide without a customer-held
  recovery secret or authorized device.

## 9. Success measures

- Production database queries, backups, logs, queues, and support exports
  contain no protected plaintext.
- A production operator with database and application secrets cannot decrypt a
  customer fixture.
- All supported clients decrypt the same interoperability fixture.
- Revoked devices cannot receive new key epochs.
- Customers can identify devices and processors that may read their content.
- Customer-facing claims match the verified technical boundary.
