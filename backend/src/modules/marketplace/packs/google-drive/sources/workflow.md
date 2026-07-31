# Google Drive Workflow Router

Use Google Drive for Drive file operations: files, folders with MIME type application/vnd.google-apps.folder, shortcuts, permissions roles owner/organizer/fileOrganizer/writer/commenter/reader, shared drives, changes/watch channels, export of Google Workspace files, binary download, upload, move/copy, and approved sharing.

Do not use Google Drive for chat, source-code review, CRM updates, or mass exporting private/team files.

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

## Routing Doctrine

1. Confirm the connected Google Drive user, My Drive or shared drive context, file/folder/shortcut id, parent folder, owner/organizer role, permission role, and changes/watch channel scope before selecting tools.
2. Load auth, permissions, endpoint, rate-limit, webhook, error, safe-action, and workflow references before writes.
3. Resolve Google Drive file ids, folder ids, shared drive ids, shortcut target ids, permission ids, change tokens, revision ids, and owner/organizer context before mutating anything.
4. Draft external sharing, permission role changes, ownership transfers, shared drive organizer changes, public links, file deletes, shortcut moves, overwrite operations, large exports/downloads, and watch-channel changes for approval.
5. Record Drive file/folder/shared-drive/permission/change-channel ids, MIME/export/download path, approval id, and safe response summaries after approved writes.

## When To Use

Use Google Drive for Drive file operations: files, folders with MIME type application/vnd.google-apps.folder, shortcuts, permissions roles owner/organizer/fileOrganizer/writer/commenter/reader, shared drives, changes/watch channels, export of Google Workspace files, binary download, upload, move/copy, and approved sharing.

## When Not To Use

Do not use Google Drive for chat, source-code review, CRM updates, or mass exporting private/team files.
