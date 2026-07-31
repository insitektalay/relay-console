# Content features and local storage

Status: proposed

## 1. Search

The current backend searches plaintext. E2EE search runs on trusted endpoints.

Recommended first release:

- clients fetch encrypted pages and decrypt them locally;
- native clients maintain an encrypted full-text index protected by a device
  storage key;
- the web client keeps an encrypted IndexedDB index or builds an in-memory
  index for the selected workspace;
- index records use opaque object IDs and contain no plaintext outside the
  encrypted local store; and
- device revocation removes local keys and cached index access.

Server-side blind indexes leak repeated terms and access patterns. Do not add
them to v1 without a separate threat model and customer disclosure.

## 2. Thread lists and previews

Encrypt thread titles and last-message previews. Clients decrypt them after
loading the encrypted thread summary. Relay may retain opaque thread type,
archive state, unread counters, and update time for routing and sync.

Push and email notifications should use generic text such as "New Relay
message" unless a trusted endpoint decrypts the preview.

## 3. Attachments and artifacts

- Encrypt bytes before upload.
- Use random object-store paths.
- Encrypt filename, media type detail, caption, thumbnail, extracted text, and
  content hash.
- Keep only size bucket, upload status, opaque owner, and chunk count clear.
- Decrypt downloads in the client or authorized runtime.
- Generate previews and text extraction on a trusted endpoint.
- Encrypt generated artifacts before Relay stores them.
- Include temporary files, resumable upload state, and quarantined files in
  the encrypted lifecycle.

Malware scanning on ciphertext cannot inspect file content. Product owners
must choose trusted-endpoint scanning, a disclosed cloud scanning processor, or
blocked file categories.

## 4. Drafts, offline queues, and caches

- Encrypt drafts before durable storage.
- Encrypt outbox payloads before persistence.
- Encrypt native message caches and indexes with a separate device storage key.
- Keep web query caches in memory unless the persistent layer encrypts them.
- Store no protected content in localStorage.
- Set OS file-protection attributes on native stores and exports.
- Clear decrypted objects when the account locks, device revokes, or memory
  pressure removes the view.

## 5. Analytics, summaries, and reports

Relay Cloud may calculate counts, latency, delivery, token usage, byte size,
error codes, and other content-free operational metrics. Semantic analytics,
summaries, repeated-message detection, intent classification, and wrap-ups run
on an authorized client or runtime.

The trusted processor encrypts any retained result. Relay must not keep the
prompt, model response, excerpt, or diagnostic sample.

## 6. Notifications

| Channel  | Default                                                 |
| -------- | ------------------------------------------------------- |
| Web push | Generic event with opaque object ID                     |
| APNs     | Generic event; reviewed extension may decrypt on device |
| Email    | Generic sign-in link to Relay, no message body or title |
| In-app   | Client decrypts content after authorization             |

Notification preferences cannot re-enable plaintext server previews.

## 7. Exports and sharing

Exports decrypt on a trusted endpoint after recent authentication and explicit
scope selection. The user can choose:

- plaintext export with a clear storage warning; or
- encrypted Relay archive protected by a new export passphrase or recipient
  public key.

Relay Cloud must not build plaintext exports. Public links and unauthenticated
sharing require a separate capability-key design and are outside v1.

## 8. Clipboard, screenshots, and rendering

Clients should mark sensitive fields, clear app-owned clipboard writes after a
short interval where the platform permits, and exclude content from task
switcher snapshots. Customers can still copy or capture content from an
authorized endpoint.

HTML and Markdown rendering must preserve existing sanitization. Encryption
does not make decrypted active content safe.

## 9. Support and diagnostics

Diagnostics contain IDs, protocol versions, counts, hashes, and safe error
codes. A customer may attach selected decrypted content to a support request
only through a separate, visible consent flow with stated retention and
deletion. Routine support bundles must remain content-free.

## 10. Feature acceptance matrix

Each feature owner must record:

| Feature | Plaintext processor | Encrypted stores | Offline behavior | Revocation behavior | Tests | Customer disclosure |
| ------- | ------------------- | ---------------- | ---------------- | ------------------- | ----- | ------------------- |

Release blocks if any production feature lacks an entry.
