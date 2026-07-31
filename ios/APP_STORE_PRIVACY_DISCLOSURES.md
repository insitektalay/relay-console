# Relay Console App Store privacy disclosures

Status: **published in App Store Connect**. Last source audit and publication:
20 July 2026.

This is the repository source of truth for the iPhone/iPad App Store privacy
answers. Alex Kerss published this answer set for App Store Connect app
`6792827461` on 20 July 2026. The machine-readable answer set is
`ios/AppStore/app-privacy-disclosures.json` and the shipping declaration is
`ios/ClawChat/App/PrivacyInfo.xcprivacy`.

Apple requires disclosure of data retained off-device by Relay or an integrated
third party, including data used only for app functionality. Apple also says
private in-app messages should be declared as **Emails or Text Messages**, and
that data tied to an account or other identity is linked to the user. These
answers follow Apple's current [App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)
definitions.

## Exact answer set

Select **Yes, data is collected** and declare every row below as **linked to the
user**, **not used for tracking**:

| Apple data type | Purpose | Product evidence |
| --- | --- | --- |
| Name | App Functionality | Relay profile |
| Email Address | App Functionality | Authentication and account email |
| Emails or Text Messages | App Functionality | Relay account conversations and connected-provider messages |
| Photos or Videos | App Functionality | Attachments and agent avatars |
| Audio Data | App Functionality | Voice input and audio attachments |
| Other User Content | App Functionality | Prompts, agent output, files, application data and approval notes |
| User ID | App Functionality; Analytics | Relay/provider identifiers and Sentry correlation |
| Purchase History | App Functionality | Verified subscription transaction and entitlement state |
| Product Interaction | App Functionality; Analytics | Allowlisted PostHog navigation and feature events; Sentry operational breadcrumbs |
| Device ID | Analytics | PostHog pseudonymous installation identifier created after opt-in |
| Crash Data | App Functionality | Sentry crash reporting |
| Performance Data | App Functionality | Sentry app hangs and watchdog terminations |
| Other Diagnostic Data | App Functionality | Bounded errors, internal identifiers and security/access logs |

Select **No, not used for tracking**. There are no advertising SDKs or data
broker integrations in the audited target.

## Explicit exclusions

- Do not declare Payment Info: Apple receives card/payment details; Relay gets a
  signed transaction and entitlement record.
- Do not declare Search History while search text is used only to service the
  request and is not retained as a separate search-history record.
- Do not declare Contacts for the current zero-provider frozen cohort. Re-audit
  this answer before any Marketplace provider that reads address books becomes
  Connect eligible.
- OAuth access and refresh tokens are credentials, not an Apple privacy-label
  category of their own. The policy must still disclose their encrypted Relay
  control-plane storage, access boundary, revocation and deletion.

## PostHog and Sentry boundary

The iOS target links PostHog and Sentry Cocoa. Both choices start off and a
required first-launch screen records an explicit decision before either SDK can
initialize. PostHog receives allowlisted product events with pseudonymous
account and installation identifiers. Sentry receives sanitized crashes, hangs,
errors, release/device context and safe action breadcrumbs. The app does not
attach the user's name or email. Diagnostic context uses a strict scalar-key
allowlist; file/folder paths, URLs, message/prompt/content fields, credentials,
authorization material, provider errors and unknown strings are redacted.
Captured errors retain only a bounded domain and numeric code. Both choices can
be withdrawn independently in Settings.

Before submission, inspect Sentry's privacy report from the exact archive,
confirm production SDK options and retention, and compare the server-side event
scrubbing result with the published policy. Any newly linked SDK or production
service reopens this inventory.

## Publication evidence and continuing gate

App Store Connect confirmed a 12-type answer set as published by Alex Kerss on
20 July 2026. Adding opt-in PostHog introduces the Device ID analytics row in
this 13-type source inventory, so the published answer set is now stale and the
privacy-disclosure checklist is reopened. Before submission, publish the Device
ID row and any adjusted purpose answers, then compare the exact processed-build
privacy report, production PostHog/Sentry configuration and final Marketplace
cohort with the public policy. Every declared type remains linked, none is used
for tracking, and User ID, Product Interaction and Device ID carry Analytics.
