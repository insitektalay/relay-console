# HubSpot Safe Actions

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Allowed Without Additional Approval

- Read and summarize specific contacts, companies, deals, tickets, owners, properties, pipelines, lists, associations, notes, and tasks.
- Run narrow CRM search queries with explicit filters, limits, and requested properties.
- Draft proposed record updates, notes, tasks, associations, ticket replies, pipeline moves, owner changes, and batch plans without executing them.

## Approval Required

- Send customer-visible replies or create externally meaningful email-like engagements.
- Update deal stage, ticket status, pipeline, owner, amount, close date, or lifecycle-impacting fields.
- Batch update, merge, delete, export, import, or list-wide mutate CRM records.
- Create or modify private app scopes, webhooks, workflows, automations, properties, schemas, association labels, lists, or pipelines.

## Blocked

- Expose private app tokens, OAuth tokens, client secrets, or webhook secrets.
- Impersonate a human or fabricate approval.
- Mass-message customers or prospects.
- Delete the HubSpot account/portal, bypass permissions, disable security/compliance/audit settings, or perform destructive bulk actions.
