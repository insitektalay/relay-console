# Zendesk Workflow Router

Use Zendesk for support workflows involving tickets, users, organizations, groups, agents, comments, public replies, internal notes, requester/assignee changes, tags, macros, triggers, automations, attachments, views, webhooks, and Help Center content.

Do not use Zendesk to expose secrets, reveal internal notes to customers, impersonate agents, mass-close tickets, mass-message customers, or bypass Zendesk roles.

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developer.zendesk.com/api-reference/
- https://developer.zendesk.com/api-reference/introduction/security-and-auth/
- https://developer.zendesk.com/api-reference/ticketing/tickets/tickets/
- https://developer.zendesk.com/api-reference/ticketing/users/users/
- https://developer.zendesk.com/api-reference/ticketing/organizations/organizations/
- https://developer.zendesk.com/api-reference/ticketing/groups/groups/
- https://developer.zendesk.com/api-reference/ticketing/business-rules/triggers/
- https://developer.zendesk.com/api-reference/webhooks/webhooks-api/webhooks/
- https://developer.zendesk.com/api-reference/introduction/rate-limits/

## Routing Doctrine

1. Confirm Zendesk subdomain, auth type, role/agent context, and ticket scope before API use.
2. Resolve ticket id, requester, assignee, group, organization, status, priority, tags, and comment visibility before drafting writes.
3. Treat `public: true` comments, requester replies, side conversations, and Help Center publication as customer-visible and approval-required.
4. Use internal notes for private support context only; never transform private notes into public replies without explicit approval.
5. Require approval for ticket lifecycle/assignment changes, bulk updates, exports, merges/deletes, attachments at scale, macros, triggers, automations, webhooks, roles, groups, routing, and Help Center publication.
