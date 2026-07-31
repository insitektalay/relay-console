# Airtable Permissions and Scopes

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

## Provider Permission Model

Relevant permissions include data.records:read, data.records:write, schema.bases:read, schema.bases:write, webhook:manage. Schema/admin changes and bulk data writes require approval.

## Capability Mapping

- Read capability: inspect Airtable bases, tables, fields, views, record ids, typed field values, pagination offsets, and webhook metadata with bounded API calls.
- Draft capability: prepare exact Airtable list-records, create/update/upsert/delete record, metadata, field/table, automation/interface, or webhook payloads without side effects.
- Write capability: create/update/delete Airtable records and limited table data only when PAT/OAuth scopes, base permissions, table schema, and approval policy allow it.
- Admin capability: Airtable base/table/field schema changes, webhook creation/deletion, automation/interface changes, external sharing, base deletion, and high-volume exports; disabled by default.
