# Pipedrive Permissions and Scopes

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Pipedrive access is governed by the authenticated user's company, token/OAuth grant, roles, visibility groups, and object permissions. API token access is user/company-specific and should be treated as sensitive.

Read and draft operations may inspect persons, organizations, deals, leads, activities, notes, products, users, filters, fields, pipelines, and stages. Writes require validated ids and approval policy checks.

Pipeline/stage/status/value/owner changes, bulk updates, exports, webhooks, filters, custom fields, products, roles/permissions, and destructive actions require approval.
