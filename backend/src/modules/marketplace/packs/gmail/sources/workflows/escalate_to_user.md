# Gmail Escalation

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Escalate when Gmail OAuth credentials are missing, Gmail scopes are insufficient, message/thread/draft/label/history ids are ambiguous, the operation is approval-required, the request touches secrets or high-risk mailbox data, Gmail returns conflicting mailbox state, or official docs do not cover the requested method.

## Approval-Required Patterns

- Sending external mail, bulk sends, deleting messages, forwarding attachments, changing mailbox rules/settings, and customer/legal/security/billing mail require approval.
- Credential or token transmission is blocked even with approval.
- Application-wide mailbox access or shared mailbox changes require approval.

## Blocked Patterns

- Emailing secrets, mass unsolicited mail, deleting mailbox/account, bypassing tenant security, and broad mailbox exports are blocked.
