# HubSpot Permissions and Scopes

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.hubspot.com/docs/apps/legacy-apps/authentication/scopes
- https://developers.hubspot.com/docs/api/crm/understanding-the-crm
- https://developers.hubspot.com/docs/api/crm/properties

## Scope Doctrine

Use granular CRM scopes where available. Common CRM/support scopes include `crm.objects.contacts.read`, `crm.objects.contacts.write`, `crm.objects.companies.read`, `crm.objects.companies.write`, `crm.objects.deals.read`, `crm.objects.deals.write`, ticket read/write scopes, owner read scopes, and relevant engagement/activity scopes.

Read scopes allow bounded inspection of CRM objects, properties, owners, associations, lists, and pipelines. Write scopes allow record mutations only when the active approval policy permits the exact operation.

Private app scope expansion, OAuth scope expansion, webhook subscription changes, workflow/automation changes, property/schema edits, exports, and destructive actions require approval.

## Safety

Do not bypass HubSpot user permissions, private app scope limits, or portal governance. If a field or object is unavailable, stop and report the missing scope or permission.
