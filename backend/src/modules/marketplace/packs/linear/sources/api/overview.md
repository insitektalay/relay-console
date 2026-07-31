# Linear API Overview

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

## Provider Object Model

- Issue with identifier, team, title, description, priority, assignee, labels, project, cycle, state, relations
- Team with key, workflow states, members, cycles, and projects
- Project with status, milestones, target date, lead, and documents
- Cycle with startsAt, endsAt, progress, and issue membership
- Comment attached to issue
- Workflow states such as backlog, triage, started, completed, canceled configured per team

## Endpoint/Method Families

- GraphQL queries: viewer, organization, teams, team, issue, issues, project, projects, cycle, cycles, users
- Mutations: issueCreate, issueUpdate, issueArchive, commentCreate, attachmentCreate, projectCreate, projectUpdate
- Webhook resources for Issue, Comment, Project, Cycle, and other model changes
