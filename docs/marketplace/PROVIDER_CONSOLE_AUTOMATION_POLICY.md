# Provider-console automation policy

Status: launch policy, 2026-07-14

This policy applies when a Relay operator or an assisting coding/browser agent
uses a third-party provider console while preparing a Marketplace integration.
It does not authorize access to a customer's provider account.

## Allowed assistance

Automation may inspect public provider documentation and may help an authorized
human navigate, type, or review ordinary configuration fields in an existing
signed-in provider session. It may prepare proposed callback URLs, scopes,
descriptions, and non-secret configuration for the human to verify.

## Human-only decisions

The authorized human must personally complete or approve:

- CAPTCHA, passkeys, one-time codes, 2FA, and account recovery;
- payment, billing-plan selection, or financial commitments;
- acceptance of terms, legal attestations, contracts, or policy promises;
- provider review or verification submissions;
- organization-owner/admin consent, permission expansion, and production
  publication; and
- any action whose meaning or authority is unclear.

Automation must stop at these boundaries. It must not bypass a challenge,
impersonate the human, infer consent, or claim that a submission was completed
without provider evidence.

## Secret and evidence handling

Generated client secrets, API keys, access or refresh tokens, cookies, recovery
codes, signing material, and payment details must never be copied into chat,
screenshots, reports, commits, test fixtures, terminal transcripts, or local
Marketplace-loop ledgers. Secrets go directly into the intended Railway secret
variable or other approved secret store; evidence records contain only the
provider slug, non-secret application identifier where necessary, reviewed
scope/callback metadata, result state, date, and source link.

If a secret appears in any captured artifact, stop, remove the artifact from the
working set, rotate the credential, and follow the Marketplace credential
incident runbook before continuing.

## Dangerous end-user policy boundary

`dangerously_skip_permissions` is not an ordinary Marketplace choice. The
legacy macOS `allow_direct_writes` value is the same dangerous-policy class, not
a separate lower-risk choice. A client may expose either only in a separate
advanced flow that states what approval is being removed and requires a
dedicated acknowledgement for that activation. The Railway API and native
service paths must reject activation without the same acknowledgement and
record its policy version, actor, time, and preserved invariants. A legacy or
malformed native permission map that lacks this evidence must treat every
`auto_execute` action as `approval_required`.

This policy never bypasses workspace or connection ownership, the authority
granted by the provider, selected capabilities, blocked actions, fixed origins,
request bounds, provider and Relay rate limits, audit evidence, truthful result
handling, or secret non-exposure. An acknowledgement of generated content,
general risk, provider consent, or another warning must not be reused as the
dangerous-policy acknowledgement.

## Release boundary

Only the reviewed provider cohort selected for the frozen release candidate can
block that release. Review, verification, or commercial approval for any other
provider remains deferred work and must not expand the launch gate. A provider
that has not passed its release gate stays unavailable or clearly labelled with
its truthful non-usable state.
