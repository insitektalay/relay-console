# Linear Common Workflows

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.linear.app/docs/graphql/working-with-the-graphql-api
- https://developers.linear.app/docs/graphql/graphql-api
- https://developers.linear.app/docs/graphql/oauth/authentication
- https://developers.linear.app/docs/oauth/authentication#scopes
- https://developers.linear.app/docs/graphql/webhooks
- https://developers.linear.app/docs/graphql/working-with-the-graphql-api/rate-limiting
- https://developers.linear.app/docs/graphql/working-with-the-graphql-api/errors

- Resolve the team by key/name, then query its workflow states before creating or moving issues.
- For status reports, query issues with team/project/cycle filters and include state, priority, assignee, labels, and updatedAt.
- When summarizing comments, query the issue by identifier and fetch comments in chronological order.
- Create issues with explicit teamId, title, description, priority, labelIds, assigneeId, projectId, cycleId, and stateId where appropriate.
- Update issue state only after matching the requested state to the team workflow states.
- Create comments using commentCreate and include source context; do not use comments for hidden approval.
