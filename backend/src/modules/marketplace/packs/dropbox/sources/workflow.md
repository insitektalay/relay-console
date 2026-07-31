# Dropbox Workflow Router

Use Dropbox for file operations: `files/list_folder` entries, `files/download` streams, `files/upload` commit info, sharing links, team folders, namespace ids, file locks, file revisions, bounded downloads, uploads, organization, and approved sharing.

Do not use Dropbox for chat, source-code review, CRM updates, or mass exporting private/team files.

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://www.dropbox.com/developers/documentation/http/overview
- https://www.dropbox.com/developers/reference/oauth-guide
- https://developers.dropbox.com/oauth-guide#scopes
- https://www.dropbox.com/developers/documentation/http/documentation
- https://www.dropbox.com/developers/reference/webhooks

## Routing Doctrine

1. Confirm the connected Dropbox account or team namespace, path/root namespace, file/folder id, sharing-link id, team folder, member context, OAuth scopes, and webhook state before selecting tools.
2. Load auth, permissions, endpoint, rate-limit, webhook, error, safe-action, and workflow references before writes.
3. Resolve Dropbox file ids, paths, rev values, namespace ids, team folder ids, shared link ids, file lock state, and webhook cursor state before mutating anything.
4. Draft external sharing, shared-link creation/settings changes, team folder admin changes, file/folder deletes, large downloads, uploads overwriting existing revs, moves/copies, namespace/team-space operations, and webhook changes for approval.
5. Record Dropbox file/path/rev/namespace/team-folder/shared-link ids, conflict mode, approval id, and safe response summaries after approved writes.

## When To Use

Use Dropbox for file operations: `files/list_folder` entries, `files/download` streams, `files/upload` commit info, sharing links, team folders, namespace ids, file locks, file revisions, bounded downloads, uploads, organization, and approved sharing.

## When Not To Use

Do not use Dropbox for chat, source-code review, CRM updates, or mass exporting private/team files.
