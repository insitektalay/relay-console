# Asana Workflow Router

Use Asana for work-management operations involving tasks, projects, sections, stories, workspaces, teams, portfolios, webhooks.

Do not use Asana for source-code edits, billing, chat broadcasts, or documents that belong in a knowledge base unless linked to work items.

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

## Routing Doctrine

1. Confirm the connected Asana workspace, team, project, section, task gid, story/comment target, assignee gid, custom fields, and OAuth/PAT scope before selecting tools.
2. Load auth, permissions, endpoint, rate-limit, webhook, error, safe-action, and workflow references before writes.
3. Resolve Asana workspace/team/project/section/task/story/user/custom-field/portfolio/webhook GIDs from Asana APIs before mutating anything.
4. Draft bulk task changes, task deletes, project/section membership changes, custom-field changes, portfolio changes, customer-visible stories, webhook changes, and permission-impacting operations for approval.
5. Record Asana workspace/project/task/section/story/custom-field/webhook GIDs, changed fields, approval id, and safe response summaries after approved writes.

## When To Use

Use Asana for work-management operations involving tasks, projects, sections, stories, workspaces, teams, portfolios, webhooks.

## When Not To Use

Do not use Asana for source-code edits, billing, chat broadcasts, or documents that belong in a knowledge base unless linked to work items.
