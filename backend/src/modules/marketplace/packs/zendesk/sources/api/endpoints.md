# Zendesk Endpoint Families

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

- Tickets: `GET/POST /api/v2/tickets`, `GET/PUT /api/v2/tickets/{id}`, ticket audits, ticket comments, uploads, and side conversations.
- Users/organizations/groups: user, organization, group, agent, identity, and membership endpoints.
- Search/export: ticket search and incremental export endpoints; customer-data export requires approval.
- Business rules: macros, triggers, automations, views, SLAs, and routing; writes require approval.
- Webhooks: webhook CRUD and trigger wiring; changes require approval.

## Write Doctrine

Always state whether a comment is public or internal. Show requester, assignee, group, status, tags, changed fields, customer impact, approval id, and rollback expectations.
