# Pipedrive Safe Actions

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Allowed Without Additional Approval

- Read specific persons, organizations, deals, leads, pipelines, stages, activities, notes, products, users, filters, fields, and webhooks.
- Summarize pipeline, contact, deal, lead, and activity state with minimal customer/prospect data.
- Draft contact, deal, lead, activity, note, product, pipeline/stage, filter, or webhook changes without execution.

## Approval Required

- Change deal/lead pipeline, stage, status, value, close date, or owner.
- Send or trigger customer/prospect-visible outreach.
- Bulk update, export, merge, delete, or owner-change CRM records at scale.
- Create or modify pipelines, stages, custom fields, filters, products, webhooks, roles, permissions, or company settings.

## Blocked

- Expose API tokens, OAuth tokens, client secrets, or webhook secrets.
- Mass-message prospects, impersonate a user, fabricate approval, delete the company account, disable security/compliance/audit settings, or perform destructive bulk actions.
