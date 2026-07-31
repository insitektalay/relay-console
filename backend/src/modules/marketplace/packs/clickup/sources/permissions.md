# ClickUp Permissions and Scopes

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developer.clickup.com/docs
- https://developer.clickup.com/docs/authentication
- https://developer.clickup.com/reference
- https://developer.clickup.com/docs/webhooks
- https://developer.clickup.com/docs/rate-limits

## Provider Permission Model

Relevant permissions include OAuth scopes and token workspace access. Project/admin and bulk-update permissions require approval.

## Capability Mapping

- Read capability: use ClickUp teams/workspaces, spaces, folders, lists, tasks, statuses, custom fields, comments, docs, users, goals, and webhooks with bounded filters.
- Draft capability: prepare exact ClickUp task create/update, list/space/folder, status, custom-field, assignee, comment, doc, attachment, or webhook payloads without side effects.
- Write capability: create/update ClickUp tasks, comments, statuses, assignees, priorities, dates, tags, and custom fields only when token/OAuth access and approval policy allow it.
- Admin capability: ClickUp workspace/team configuration, space/folder/list deletion, statuses, custom fields, permissions, docs, webhooks, automations, and bulk/destructive operations; disabled by default.
