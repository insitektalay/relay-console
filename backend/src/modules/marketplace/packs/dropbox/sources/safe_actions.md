# Dropbox Safe Actions

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Allowed Without Additional Approval

- Resolve file/folder ids and parent/container before reading.
- Use metadata first, then download/export only the specific requested file.
- For folders/team spaces, paginate and preserve path/parent context.

## Approval Required

- External sharing, permission role changes, deletes, public links, large downloads/exports, namespace changes, and team-folder admin changes require approval.
- Downloads of sensitive/customer/security/legal folders require approval.
- Overwrite operations require approval unless the user supplied the exact file id/version.

## Blocked

- Exposing OAuth tokens, refresh tokens, full-account/team-folder exports, bypassing sharing restrictions, and deleting team folders are blocked.

## Secret-Safety Rule

Provider secrets and credential-shaped values must never appear in responses, generated files, examples, audit notes, or provider-side comments/messages.
