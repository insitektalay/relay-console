# Google Drive Safe Actions

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Allowed Without Additional Approval

- Resolve file/folder ids and parent/container before reading.
- Use metadata first, then download/export only the specific requested file.
- For My Drive folders and shared drives, paginate and preserve parent ids, shortcut targets, driveId, and organizer/owner context.

## Approval Required

- External sharing, permission role changes, deletes, public links, large exports, shared-drive organizer changes, ownership transfers, and shortcut moves require approval.
- Downloads of sensitive/customer/security/legal folders require approval.
- Overwrite operations require approval unless the user supplied the exact file id/version.

## Blocked

- Exposing OAuth tokens, refresh tokens, full My Drive/shared-drive exports, bypassing sharing restrictions, and deleting shared drives are blocked.

## Secret-Safety Rule

Provider secrets and credential-shaped values must never appear in responses, generated files, examples, audit notes, or provider-side comments/messages.
