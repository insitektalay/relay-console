# Linear Permissions and Scopes

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

## Provider Permission Model

Use minimal OAuth scopes for reading and writing issues, comments, projects, cycles, and teams. Never assume admin access to workspace settings. Team membership and workflow-state availability are workspace-specific and must be queried before mutation.

## Capability Mapping

- Read capability: query Linear viewer, organization, teams, workflow states, issues, projects, cycles, comments, labels, users, and issue relations with bounded GraphQL selections.
- Draft capability: prepare exact `issueCreate`, `issueUpdate`, `commentCreate`, `attachmentCreate`, project/cycle update, or webhook payloads without side effects.
- Write capability: create/update Linear issues, comments, relations, labels, cycles, and projects only inside selected OAuth/API-key scope and active approval policy.
- Admin capability: Linear OAuth scope changes, webhook subscriptions, team/workflow/label configuration, project milestone changes, issue archive workflows, and bulk organization operations; disabled by default.
