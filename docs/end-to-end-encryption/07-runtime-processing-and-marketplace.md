# Runtime processing and Marketplace

Status: proposed

## 1. Trusted runtime role

Agents need plaintext to answer a customer. A user-owned runtime becomes an
authorized endpoint:

1. The runtime enrolls a device encryption and signing identity.
2. Conversation members approve that runtime for specific agents or threads.
3. The sender encrypts or wraps the conversation key to the runtime.
4. Relay routes encrypted dispatch envelopes.
5. The runtime verifies, decrypts, assembles bounded context, and invokes the
   agent or model.
6. The runtime encrypts and signs the reply before postback.

Relay Cloud records dispatch state and metering without message text.

## 2. Work moving out of the backend

The trusted runtime must take ownership of:

- mention and intent parsing needed for agent selection;
- recent-message context assembly and character budgets;
- team catch-up context and agent-to-agent relay decisions that inspect text;
- message condensing, wrap-up generation, and semantic analytics;
- artifact-contract insertion that contains or derives from customer content;
- response presentation normalization;
- content moderation or safety classification chosen by the customer; and
- private task, meeting, schedule, and connector automation inputs.

The backend may continue state-only routing, idempotency, timeout, presence,
authorization, and quota enforcement.

## 3. Runtime key protection

- Bind the runtime private key to one enrolled installation.
- Store it in the operating-system credential store or a root-owned encrypted
  keystore with restrictive permissions.
- Keep worker processes from reading the enrollment credential when they need
  only a scoped content key.
- Give a worker the minimum conversation key and context for one dispatch.
- Clear temporary plaintext files and avoid command-line arguments containing
  plaintext.
- Disable core dumps and redact stdout, stderr, traces, and crash records.
- Rotate runtime keys during re-enrollment or suspected compromise.

## 4. Model providers

The runtime may send plaintext to a model provider after the customer chooses
that model. The product must display the provider, account authority, retention
mode where known, and whether Relay or the customer owns the provider account.

Relay's E2EE claim covers transport and storage within Relay. It does not claim
that a selected model provider cannot process the submitted prompt.

## 5. Relay-managed runtimes

A standard Railway-hosted runtime exposes plaintext to Relay-operated compute.
The first zero-access release must label that path `cloud_processed` and
require explicit customer consent, or disable it for protected conversations.

Confidential compute may support a stronger future path only if:

- remote attestation binds an approved measured image;
- clients release keys only to the approved measurement;
- Relay operators cannot alter the image after attestation;
- the runtime disables debug, shell, memory snapshot, and plaintext logging;
- key release and attestation failures fail closed;
- an external reviewer verifies the full supply chain; and
- customer claims name the remaining model-provider and metadata exposure.

## 6. Marketplace connections

Marketplace actions have three execution models:

| Model                      | Content handling                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| Customer runtime connector | Runtime decrypts task-scoped input, calls provider, encrypts retained result.                             |
| Direct client connector    | Client decrypts and calls provider; Relay receives ciphertext status only where practical.                |
| Railway connector          | Railway receives plaintext needed for the call; customer must authorize a disclosed cloud processor path. |

Implementation should move customer-owned connector credentials and operations
to trusted runtimes where provider rules permit. OAuth callbacks and token
refresh may still require Relay Cloud. Server-held tokens do not grant Relay a
conversation key, but a Railway connector can receive plaintext action input
when the customer invokes it.

## 7. Tool requests and approvals

- Encrypt tool arguments, previews, selected resources, provider responses, and
  private error details.
- Keep action type, target connector ID, approval status, actor ID, timing, and
  idempotency key as bounded control metadata.
- Render approval details after client decryption.
- Send the approved encrypted payload to the authorized executor.
- Bind the approval signature to the exact encrypted request hash.
- Reject a modified payload after approval.

## 8. Schedules and unattended work

Relay can store an encrypted scheduled payload and wake an authorized runtime
at the due time. The runtime decrypts and executes it. A schedule that must run
while every trusted runtime is offline requires a disclosed managed processor
or cannot run.

## 9. Runtime acceptance

- Database, websocket, and dispatch queues contain ciphertext.
- A bridge receives no content key for an unauthorized thread.
- A revoked runtime cannot decrypt a new epoch or post a valid reply.
- Agent replies enter Railway already encrypted.
- Runtime logs and command histories contain no fixture plaintext.
- Team and direct conversations preserve behavior under offline, retry,
  reconnect, and multi-agent conditions.
