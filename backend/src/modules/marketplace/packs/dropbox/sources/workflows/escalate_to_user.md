# Dropbox Escalation

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Escalate when Dropbox credentials are missing, OAuth scopes or namespace/team context are insufficient, file/path/rev/team-folder/shared-link ids are ambiguous, the operation is approval-required, the request touches secrets or high-risk Dropbox content, Dropbox returns conflicting metadata/rev state, or official docs do not cover the requested endpoint.

## Approval-Required Patterns

- External sharing, permission role changes, deletes, public links, large downloads/exports, namespace changes, and team-folder admin changes require approval.
- Downloads of sensitive/customer/security/legal folders require approval.
- Overwrite operations require approval unless the user supplied the exact file id/version.

## Blocked Patterns

- Exposing OAuth tokens, refresh tokens, full-account/team-folder exports, bypassing sharing restrictions, and deleting team folders are blocked.
