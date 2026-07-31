# Google Drive Read Workflows

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

Always use explicit Google Drive file ids, folder ids, shared drive ids, permission ids, shortcut target ids, change tokens, or narrow Drive `q` filters. Summaries must redact secrets and unnecessary personal, customer, financial, security, source-code, or private Drive content.
