# Google Drive Permissions and Scopes

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

## Provider Permission Model

Relevant scopes include drive.readonly, drive.file, drive.metadata.readonly, drive. Read scopes permit metadata/content reads; write/share scopes permit uploads, moves, deletes, and permission mutations and require approval.

## Capability Mapping

- Read capability: inspect Drive file metadata, folder-as-file records, shared-drive membership, shortcut targets, permissions, changes, and export/download eligibility.
- Draft capability: prepare exact files.create, files.update, files.copy, permissions.create, files.export, or changes/watch plans without modifying Drive.
- Write capability: upload, move, copy, rename, or share Drive files only after validating file id, parent folder, shared-drive support flags, owner/organizer role, and approval policy.
- Admin capability: shared-drive organizer changes, ownership transfers, domain/public sharing, watch-channel setup, bulk export, and destructive file/shared-drive actions; disabled by default.
