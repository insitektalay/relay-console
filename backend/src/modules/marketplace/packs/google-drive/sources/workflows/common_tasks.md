# Google Drive Common Workflows

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.google.com/drive/api/guides/about-sdk
- https://developers.google.com/drive/api/guides/about-auth
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/workspace/drive/api/reference/rest/v3
- https://developers.google.com/drive/api/guides/push
- https://developers.google.com/drive/api/guides/handle-errors

- Resolve file/folder ids and parent/container before reading.
- Use metadata first, then download/export only the specific requested file.
- For My Drive folders and shared drives, paginate and preserve parent ids, shortcut targets, driveId, and organizer/owner context.
- Upload or update with explicit parent, filename, MIME type, conflict behavior, and audit context.
- Move/copy files only after confirming source and destination ids.
- Permission/share changes must name role, recipient, expiration, and external visibility.
