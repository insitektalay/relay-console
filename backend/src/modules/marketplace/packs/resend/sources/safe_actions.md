# Resend Safe Actions

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Allowed Without Additional Approval

- Retrieve an email by id before reporting delivery status.
- Check domain verification before sending from a domain; explain required DNS records without exposing secrets.
- List audiences/contacts only for a bounded user request and avoid exporting full recipient lists.

## Approval Required

- Any live email send, batch send, broadcast, domain mutation, API-key mutation, webhook change, or audience/contact bulk change requires approval.
- External/customer-facing content and emails containing legal, billing, security, or account-status language require approval.
- Sending attachments or high-recipient-count messages requires approval.

## Blocked

- Spam campaigns, purchased lists, credential emailing, API key exposure, webhook secret exposure, and sender-domain spoofing are blocked.
- Do not send password reset, security, billing, or legal notices unless the user approved exact content and recipients.
- Do not infer opt-in status; require source-of-truth confirmation for audiences.

## Secret-Safety Rule

Provider secrets and credential-shaped values must never appear in responses, generated files, examples, audit notes, or provider-side comments/messages.
