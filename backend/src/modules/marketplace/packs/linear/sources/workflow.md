# Linear Workflow Router

Use Linear for product execution in its GraphQL API: issues, teams, projects, cycles, comments, labels, workflow states, priorities, relations, and assignments.

Do not use Linear for chat, document storage, source-code changes, or Jira/Asana workspaces unless the user explicitly wants a Linear issue mirror.

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

## Routing Doctrine

1. Confirm the connected Linear organization, team key, issue/project/cycle ids, workflow state ids, assignee ids, labels, OAuth/API-key scope, and webhook target before selecting tools.
2. Load auth, permissions, endpoint, rate-limit, webhook, error, safe-action, and workflow references before writes.
3. Resolve Linear UUIDs, issue identifiers, team ids, project ids, cycle ids, state ids, label ids, user ids, and relation ids from GraphQL queries before mutations.
4. Draft bulk issue updates, cross-team reassignment, workflow-state changes, project status/date changes, issue archives, customer-facing issue content, webhook changes, and team/label/workflow configuration changes for approval.
5. Record Linear ids, GraphQL mutation name, changed fields, previous state where known, approval id, and safe response summaries after approved mutations.

## When To Use

Use Linear for product execution in its GraphQL API: issues, teams, projects, cycles, comments, labels, workflow states, priorities, relations, and assignments.

## When Not To Use

Do not use Linear for chat, document storage, source-code changes, or Jira/Asana workspaces unless the user explicitly wants a Linear issue mirror.
