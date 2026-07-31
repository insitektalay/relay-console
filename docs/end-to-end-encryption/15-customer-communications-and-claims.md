# Customer communications and claims

Status: proposed; legal and independent security review required

## 1. Approved claim after every launch gate passes

Suggested core language:

> Relay encrypts your protected content on your authorized device or runtime
> before it reaches Relay Cloud. Relay stores and routes encrypted data without
> holding the keys needed to read it.

Use this language only after the technical, migration, backup, audit, and
release gates pass.

## 2. Required explanation

Customer documentation must explain:

- which content Relay end-to-end encrypts;
- which account, membership, routing, timestamp, size, billing, and security
  metadata Relay can see;
- which authorized devices and runtimes hold content keys;
- when an agent model or connected application receives plaintext;
- the difference between user-owned and Relay-managed runtimes;
- how device enrollment and revocation work;
- how customers recover access;
- that Relay cannot recover content after loss of all devices and recovery
  routes; and
- that removed members may retain content they accessed before removal.

## 3. Encryption state labels

| State                            | Customer wording                                                           |
| -------------------------------- | -------------------------------------------------------------------------- |
| Active, user-owned runtime       | End-to-end encrypted                                                       |
| Active, no processor used        | Only your authorized devices can read this content                         |
| Trusted runtime processing       | Shared with your selected runtime for this agent                           |
| Third-party model/app processing | Shared with the named provider for this request                            |
| Relay-managed standard runtime   | Cloud processed by Relay; encrypted in storage and transit                 |
| Migration pending                | New content is encrypted; older history is still being protected           |
| Backup retirement pending        | Active content is encrypted; older Relay backups are awaiting expiry       |
| Recovery unavailable             | Relay cannot recover this content without a trusted device or recovery key |
| Integrity failure                | Relay could not verify this encrypted item; it was not opened              |

Do not display an end-to-end encryption badge on a path that gives a
Relay-operated standard runtime plaintext.

## 4. Settings and onboarding

Onboarding must:

- explain recovery before generating the recovery key;
- require proof that the customer saved it;
- identify the first trusted device;
- explain browser-device behavior and site-data loss;
- state that support cannot restore content keys; and
- link to the protocol and security explanation.

Settings must show devices, runtimes, recovery status, encryption protocol,
processors, migration state, and revoke actions.

## 5. Business workspace communications

Workspace administrators need documentation for:

- member history-sharing policy;
- device approval policy;
- customer-controlled enterprise recovery;
- member removal and future key rotation;
- legal hold and export behavior;
- processor policy; and
- records Relay retains as control metadata.

Members must see a signed-recipient change in product language such as
"Jordan's iPhone can now read this conversation." Administrative activity
cannot add silent recipients.

## 6. Security documentation

Publish:

- protocol version and algorithm suite;
- architecture and trust boundaries;
- key storage and recovery model;
- metadata and processor disclosures;
- supported client/runtime versions;
- independent review summary and remediation status;
- vulnerability reporting channel;
- key and protocol deprecation policy; and
- an explanation of the web-client trust limit.

Do not publish private operational details that create an attack path.

## 7. Incident communications

Incident notices must distinguish:

- ciphertext exposure;
- metadata exposure;
- endpoint or key exposure;
- processor exposure; and
- confirmed plaintext exposure.

Do not imply that encryption prevented harm until the incident team verifies
key separation, affected epochs, endpoint state, and logs.

## 8. Prohibited language

Do not say:

- "Relay can never access any data";
- "military-grade encryption";
- "100% secure";
- "anonymous" when metadata identifies an account;
- "zero knowledge" without defining the server-visible metadata and processor
  paths;
- "only you can read it" for shared conversations or authorized runtimes; or
- "end-to-end encrypted" before legacy plaintext backups retire.

## 9. Claim approval

Product, engineering, security, privacy/legal, support, and the independent
reviewer must approve the final copy against the deployed system. Any later
feature that introduces a new plaintext processor reopens claim review.
