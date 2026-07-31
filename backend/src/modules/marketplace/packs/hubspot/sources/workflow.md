# HubSpot Workflow Router

Use HubSpot for CRM work involving contacts, companies, deals, tickets, owners, properties, pipelines, lists, associations, and CRM activity objects such as notes, tasks, calls, emails, and meetings.

Do not use HubSpot for payment capture, source-code changes, human impersonation, unapproved bulk outreach, or broad customer-data export.

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.hubspot.com/docs/api/overview
- https://developers.hubspot.com/docs/api/crm/understanding-the-crm
- https://developers.hubspot.com/docs/api/crm/search
- https://developers.hubspot.com/docs/api/crm/contacts
- https://developers.hubspot.com/docs/api/crm/properties
- https://developers.hubspot.com/docs/api/crm/associations
- https://developers.hubspot.com/docs/api/webhooks
- https://developers.hubspot.com/docs/developer-tooling/platform/usage-guidelines
- https://developers.hubspot.com/docs/apps/legacy-apps/authentication/scopes

## Routing Doctrine

1. Confirm the connected HubSpot portal, auth type, private app/OAuth scopes, and target object type before selecting tools.
2. Resolve HubSpot record ids, owner ids, property internal names, pipeline ids, stage/status values, association labels/type ids, and list ids with read endpoints before constructing writes.
3. Prefer CRM search endpoints with narrow filters and explicit properties; avoid broad contact/company/deal/ticket scans.
4. Draft writes first: contact/company/deal/ticket updates, notes/tasks, associations, pipeline moves, owner changes, list membership, and customer-visible activity.
5. Require approval for public/customer-visible replies, pipeline or deal-stage changes, bulk mutations, exports, deletes/merges, webhook/workflow/property/schema/private-app changes, and owner changes at scale.
6. After approved writes, record provider ids, changed properties, approval id, response status, and a safe summary without exposing tokens or excessive customer data.
