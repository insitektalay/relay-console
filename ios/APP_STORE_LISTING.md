# Relay Console App Store listing

Status: **copy prepared with external gates; not ready for submission**.

The exact en-GB values live in
`ios/AppStore/app-store-metadata.en-GB.json`. Apple currently limits the app name
and subtitle to 30 characters, promotional text to 170 characters, description
to 4,000 characters, keywords to 100 bytes and review notes to 4,000 bytes. See
Apple's [app information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/)
and [platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/).

## Prepared metadata

- Name: **Relay Console**
- Subtitle: **Your AI agents, everywhere**
- Primary category: **Productivity**
- Secondary category: **Utilities**
- Marketing URL: `https://relayconsole.work`
- Support URL: `https://relayconsole.work/support`
- Privacy URL: `https://relayconsole.work/privacy`
- Privacy choices URL: `https://relayconsole.work/data-deletion`
- Terms URL: `https://relayconsole.work/terms`
- Subscription: **Relay Monthly** (legacy StoreKit product identifier retained), one month, US reference price $9.99,
  no introductory trial; StoreKit shows the customer's local, tax-inclusive
  storefront price before purchase.

The prepared description says plainly that Relay Console is an interface, not
an AI runtime or model provider. Users install, authenticate, update and keep
Hermes Agent or OpenClaw online on their own Mac, PC, Mac mini or VPS.

## Age rating

Do not submit a guessed numeric rating. Apple calculates the rating from the
current questionnaire, which must be answered against the frozen binary. The
launch product is not Made for Kids, has no advertising, social feed, gambling
or unrestricted browser, and does not launch human-to-human team messaging.
Agent output and the final provider cohort still require a content-policy review
before the content-frequency answers are attested. Apple documents the current
capability definitions in [Age ratings values and definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions).

## Export compliance

The audited app uses HTTPS/WSS, Keychain and CryptoKit Curve25519 signature
verification, with no proprietary cryptographic algorithm found. Apple requires
an export-compliance determination even for apps using cryptography supplied by
the operating system. The responsible owner must complete Apple's question flow
before setting `ITSAppUsesNonExemptEncryption` or attaching documentation. See
Apple's [export compliance overview](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance).

## Screenshots and App Review

No screenshots were captured during repository work. Capture the current
App Store Connect iPhone and iPad requirements only from the frozen signed
release candidate, using synthetic data and the six-shot list in the metadata
JSON.

The review path is not yet functional. Create a dedicated synthetic review
account, Relay subscription/entitlement, workspace, online user-managed
runtime and test agent. Put credentials only in App Store Connect. Verify that
the account can purchase/restore, chat, observe runtime offline/online state,
inspect the truthfully gated Marketplace and delete its account. Record the
review contact and complete journey evidence before checking the listing item.
The exact setup and headless acceptance command are in
`ios/APP_STORE_REVIEW_PATH.md`.

The final legal owner must choose the standard Apple EULA or approve a custom
EULA/terms relationship; the repository does not make that legal election.
