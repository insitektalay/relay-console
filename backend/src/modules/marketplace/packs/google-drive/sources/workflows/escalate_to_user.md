# Google Drive Escalation

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Escalate when Google OAuth credentials are missing, Drive scopes are insufficient, file/folder/shared-drive/permission/change ids are ambiguous, the operation is approval-required, the request touches secrets or high-risk Drive content, Drive returns conflicting sharing/ownership state, or official docs do not cover the requested method.

## Approval-Required Patterns

- External sharing, permission role changes, deletes, public links, large exports, shared-drive organizer changes, ownership transfers, and shortcut moves require approval.
- Downloads of sensitive/customer/security/legal folders require approval.
- Overwrite operations require approval unless the user supplied the exact file id/version.

## Blocked Patterns

- Exposing OAuth tokens, refresh tokens, full My Drive/shared-drive exports, bypassing sharing restrictions, and deleting shared drives are blocked.
