# Intercom Endpoint Families

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

- Contacts/companies: list, search, retrieve, create/update, archive/delete where available, attach companies, notes, tags, and segments.
- Conversations: list/search/retrieve, reply, note, assign, open, close, snooze, tag, and update state.
- Messages/tickets: create customer-visible messages/replies and ticket replies only after approval.
- Admins/teams: resolve admins and teams before assignment/routing changes.
- Articles/tags/segments: read for context; publishing or bulk targeting changes require approval.
- Webhooks: topic subscriptions and delivery configuration require approval.

## Write Doctrine

Classify each payload as internal note, customer-visible reply, assignment/routing, contact/company mutation, article publication, webhook/admin, bulk/export, or destructive.
