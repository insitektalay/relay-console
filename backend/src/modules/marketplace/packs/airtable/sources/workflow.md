# Airtable Workflow Router

Use Airtable for structured document/table workflows involving bases, tables, fields, views, records, comments, webhooks.

Do not use Airtable as an unrestricted database dump, chat system, or source-control replacement.

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://airtable.com/developers/web/api/introduction
- https://airtable.com/developers/web/api/authentication
- https://airtable.com/developers/web/api/scopes
- https://airtable.com/developers/web/api/list-records
- https://airtable.com/developers/web/api/rate-limits
- https://airtable.com/developers/web/api/webhooks-overview
- https://airtable.com/developers/web/api/errors

## Routing Doctrine

1. Confirm the connected Airtable base id, table id/name, view, record ids, field schema, personal-access-token/OAuth scopes, and webhook target before selecting tools.
2. Load auth, permissions, endpoint, rate-limit, webhook, error, safe-action, and workflow references before writes.
3. Resolve Airtable base ids, table ids/names, record ids, field ids/names/types, view ids, webhook ids, and automation/interface context from Airtable APIs before mutating anything.
4. Draft bulk record writes, schema/field changes, table/view changes, webhook changes, external shares, automations, synced-table changes, and sensitive-table exports for approval.
5. Record Airtable base/table/record/field/view/webhook ids, changed fields, approval id, and safe response summaries after approved writes.

## When To Use

Use Airtable for structured document/table workflows involving bases, tables, fields, views, records, comments, webhooks.

## When Not To Use

Do not use Airtable as an unrestricted database dump, chat system, or source-control replacement.
