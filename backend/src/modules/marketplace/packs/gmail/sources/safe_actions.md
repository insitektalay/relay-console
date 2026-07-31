# Gmail Safe Actions

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Allowed Without Additional Approval

- Search with Gmail `q` syntax, `labelIds`, and a narrow time/window limit.
- Read thread/message metadata before fetching full body or attachments.
- Summarize mail without exposing tokens, auth links, or unnecessary personal data.

## Approval Required

- Sending external mail, bulk sends, deleting messages, forwarding attachments, changing mailbox rules/settings, and customer/legal/security/billing mail require approval.
- Credential or token transmission is blocked even with approval.
- Application-wide mailbox access or shared mailbox changes require approval.

## Blocked

- Emailing secrets, mass unsolicited mail, deleting mailbox/account, bypassing tenant security, and broad mailbox exports are blocked.

## Secret-Safety Rule

Provider secrets and credential-shaped values must never appear in responses, generated files, examples, audit notes, or provider-side comments/messages.
