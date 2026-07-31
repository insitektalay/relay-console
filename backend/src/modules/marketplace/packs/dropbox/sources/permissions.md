# Dropbox Permissions and Scopes

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://www.dropbox.com/developers/documentation/http/overview
- https://www.dropbox.com/developers/reference/oauth-guide
- https://developers.dropbox.com/oauth-guide#scopes
- https://www.dropbox.com/developers/documentation/http/documentation
- https://www.dropbox.com/developers/reference/webhooks

## Provider Permission Model

Relevant scopes include files.metadata.read, files.content.read, files.content.write, sharing.read, sharing.write, team_data.member. Read scopes permit metadata/content reads; write/share scopes permit uploads, moves, deletes, and permission mutations and require approval.

## Capability Mapping

- Read capability: use Dropbox `files/list_folder`, `files/list_folder/continue`, `files/get_metadata`, `files/download`, sharing metadata, namespace/team-folder metadata, and webhook cursor state with bounded paths.
- Draft capability: prepare exact Dropbox upload, download, move, copy, delete, restore, shared-link, file-lock, team-folder, or webhook payloads without side effects.
- Write capability: upload/update/move/copy/delete selected Dropbox files and folders, create shared links, or adjust sharing only when OAuth scopes, namespace context, and approval policy allow it.
- Admin capability: Dropbox team folder administration, team namespace operations, external sharing policy changes, large exports/downloads, webhook configuration, and destructive file/team operations; disabled by default.
