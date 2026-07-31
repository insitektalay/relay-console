# Dropbox Endpoint Families

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://www.dropbox.com/developers/documentation/http/overview
- https://www.dropbox.com/developers/reference/oauth-guide
- https://developers.dropbox.com/oauth-guide#scopes
- https://www.dropbox.com/developers/documentation/http/documentation
- https://www.dropbox.com/developers/reference/webhooks

- files/list_folder
- files/list_folder/continue
- files/download
- files/upload
- files/get_metadata
- sharing/create_shared_link_with_settings
- team/team_folder/list

## Read Method Doctrine

- Resolve file/folder ids and parent/container before reading.
- Use metadata first, then download/export only the specific requested file.
- For folders/team spaces, paginate and preserve path/parent context.

## Write Method Doctrine

- Upload or update with explicit parent, filename, MIME type, conflict behavior, and audit context.
- Move/copy files only after confirming source and destination ids.
- Permission/share changes must name role, recipient, expiration, and external visibility.
