# Linear Write Workflows

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

- Create issues with explicit teamId, title, description, priority, labelIds, assigneeId, projectId, cycleId, and stateId where appropriate.
- Update issue state only after matching the requested state to the team workflow states.
- Create comments using commentCreate and include source context; do not use comments for hidden approval.
- For project or cycle updates, confirm the Linear project/cycle id, status, lead, target date, milestone, and affected teams before mutation.
- For issue relations or attachments, confirm the source issue identifier, target issue/url, relation type, and visibility.

Before execution, show the Linear organization, team key, issue/project/cycle ids, GraphQL mutation name, changed fields, customer/public roadmap impact, rollback expectations, approval requirement, and audit note.
