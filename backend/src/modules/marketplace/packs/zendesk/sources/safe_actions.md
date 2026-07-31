# Zendesk Safe Actions

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Allowed Without Additional Approval

- Read specific tickets, users, organizations, groups, agents, tags, comments, audits, and attachment metadata.
- Summarize ticket status, requester, assignee, group, SLA-relevant fields, public comments, and internal notes with visibility boundaries.
- Draft internal notes, public replies, status changes, tag changes, requester/assignee/group changes, or macro/trigger plans without executing them.

## Approval Required

- Send public ticket replies or side conversation replies.
- Change ticket status, priority, requester, assignee, group, tags at scale, or SLA-impacting fields.
- Bulk update, merge, delete, export, or mass-close tickets/users/organizations.
- Create or modify macros, triggers, automations, webhooks, groups, agent roles, routing, or Help Center articles.

## Blocked

- Expose API/OAuth tokens or webhook secrets.
- Reveal internal notes as public replies without approval.
- Impersonate agents, fabricate approval, bypass roles, delete the account, disable audit/security controls, or mass-message customers.
