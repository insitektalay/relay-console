# Asana Read Workflows

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

- Resolve Asana workspace, team, project, section, task, user, custom-field, and portfolio GIDs before querying.
- Read current status/state/assignee/labels before proposing changes.
- Use bounded pagination and `opt_fields` for reports and preserve Asana GIDs.

Always use explicit Asana workspace/team/project/section/task/story/user/custom-field/portfolio/webhook GIDs or bounded Asana filters. Summaries must redact secrets and unnecessary personal, customer, financial, security, source-code, or private task data.
