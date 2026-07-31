# Standards and references

Status: implementation reference set

The implementation must pin the standards and platform baselines used by each
release. A later document revision should record exact browser, operating
system, library, and runtime versions after the compatibility investigation.

## Cryptography

- [NIST SP 800-38D](https://csrc.nist.gov/pubs/sp/800/38/d/final) specifies
  AES-GCM and its security requirements.
- [RFC 5869](https://www.rfc-editor.org/rfc/rfc5869) specifies HKDF.
- [FIPS 186-5](https://csrc.nist.gov/pubs/fips/186-5/final) specifies digital
  signature requirements, including ECDSA.
- [NIST SP 800-56A Revision 3](https://csrc.nist.gov/pubs/sp/800/56/a/r3/final)
  specifies elliptic-curve key-establishment schemes.
- [RFC 8949](https://www.rfc-editor.org/rfc/rfc8949) specifies CBOR. The
  protocol must define the deterministic encoding profile it uses.
- [RFC 9106](https://www.rfc-editor.org/rfc/rfc9106) specifies Argon2 and
  recommends Argon2id. Use it only if the approved recovery design derives a
  key from a passphrase.

Independent reviewers must approve algorithm choices, parameters, nonce
limits, padding, key separation, canonical encoding, and migration behavior.

## Browser

- [Web Cryptography Level 2](https://www.w3.org/TR/WebCryptoAPI/) defines Web
  Crypto primitives and `CryptoKey` behavior.
- [Indexed Database API](https://www.w3.org/TR/IndexedDB/) defines the browser
  persistence layer used for non-exportable key records and encrypted local
  state.
- [Content Security Policy Level 3](https://www.w3.org/TR/CSP3/) defines the
  browser policy used to constrain script and resource execution.
- [Trusted Types](https://w3c.github.io/trusted-types/dist/spec/) constrains DOM
  injection sinks.
- [OWASP Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
  supplies implementation and review guidance for decrypted web content.

Web Crypto availability does not remove the malicious-release risk created by
server-delivered JavaScript. The web security review must cover the deployment
and release chain.

## Apple platforms

- [Apple CryptoKit](https://developer.apple.com/documentation/cryptokit/)
  provides native key agreement, signatures, hashing, HKDF, and AES-GCM.
- [AES.GCM](https://developer.apple.com/documentation/cryptokit/aes/gcm)
  defines CryptoKit sealed-box behavior.
- [Storing keys in the Keychain](https://developer.apple.com/documentation/security/storing-keys-in-the-keychain)
  defines native key persistence.
- [Protecting the user's privacy](https://developer.apple.com/documentation/uikit/protecting-the-user-s-privacy)
  collects Apple privacy controls relevant to local data.
- [Reducing your app's memory use](https://developer.apple.com/documentation/xcode/reducing-your-app-s-memory-use)
  informs short-lived plaintext handling and memory-pressure behavior.

The platform review must set Keychain accessibility, backup, device-only,
Secure Enclave, Data Protection, notification-extension, export, and app-group
rules.

## Application security

- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
  covers threat-led encryption design and authenticated modes.
- [OWASP Key Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html)
  covers key lifecycle and storage.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  covers sensitive-data exclusion and operational logging.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
  provides application security verification requirements.
- [OWASP MASVS](https://mas.owasp.org/MASVS/) provides mobile application
  storage, cryptography, network, and resilience controls.

## Infrastructure and retention

- [Railway Data Processing Addendum](https://railway.com/legal/dpa) describes
  Railway's infrastructure encryption and organizational controls.
- [Railway PostgreSQL documentation](https://docs.railway.com/databases/postgresql)
  describes the deployed database model.
- [Railway volume backups](https://docs.railway.com/volumes/backups) describes
  scheduled volume backups and retention.
- [Railway PostgreSQL point-in-time recovery](https://docs.railway.com/volumes/point-in-time-recovery)
  describes WAL archives, base backups, retention, and restore behavior.
- [Railway compliance documentation](https://docs.railway.com/enterprise/compliance)
  describes available audit and compliance material.

Railway infrastructure encryption protects stored media and transport. Relay
E2EE must protect content from the application, database credentials, operator
access, and restored backups.

## Privacy and claims

Privacy and legal owners must review applicable data protection, consumer
protection, breach-notification, retention, sector, and export requirements in
each launch market. Technical documentation must give them the field
inventory, processor inventory, metadata boundary, recovery model, deletion
ledger, independent review, and deployed evidence. This document does not
replace legal advice.

## Reference governance

The security owner must:

- record the exact standard revision and library version used by a release;
- reassess references after deprecation, platform changes, or reviewer
  findings;
- keep protocol fixtures stable across dependency upgrades;
- review platform cryptographic behavior rather than infer it from an API name;
  and
- record deviations and compensating controls in `DECISIONS.md`.
