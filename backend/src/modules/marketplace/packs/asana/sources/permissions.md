# Asana Permissions and Scopes

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.asana.com/docs
- https://developers.asana.com/docs/authentication
- https://developers.asana.com/docs/oauth
- https://developers.asana.com/reference/rest-api-reference
- https://developers.asana.com/docs/webhooks-guide
- https://developers.asana.com/docs/rate-limits
- https://developers.asana.com/docs/errors

## Provider Permission Model

Relevant permissions include default OAuth scopes plus workspace authorization. Project/admin and bulk-update permissions require approval.

## Capability Mapping

- Read capability: use Asana tasks, projects, sections, stories, workspaces, teams, users, custom fields, portfolios, and webhook APIs with bounded pagination and opt_fields.
- Draft capability: prepare exact Asana task create/update, project/section add/remove, story/comment, custom-field, portfolio, attachment, or webhook payloads without side effects.
- Write capability: create/update Asana tasks, stories, project memberships, sections, and custom-field values only when OAuth/PAT permissions and approval policy allow it.
- Admin capability: Asana workspace/project deletion, custom-field/schema changes, team/project permissions, portfolio configuration, webhook subscriptions, bulk changes, and destructive operations; disabled by default.
