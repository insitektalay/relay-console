# Airtable Endpoint Families

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

- `GET /v0/{baseId}/{tableIdOrName}` with `filterByFormula`, `view`, `fields`, `sort`, `pageSize`, and `offset`.
- `POST /v0/{baseId}/{tableIdOrName}` for record creation.
- `PATCH /v0/{baseId}/{tableIdOrName}` for record updates/upserts where supported.
- `DELETE /v0/{baseId}/{tableIdOrName}/{recordId}` for exact record deletion.
- Metadata APIs for bases, tables, fields, and views.
- Webhooks APIs for base/table change notifications.

## Read Method Doctrine

- Inspect Airtable base/table/field/view definitions before querying records.
- Use `filterByFormula`, views, field selection, sort parameters, and bounded pagination.
- Preserve record ids, field names, field types, linked-record ids, select options, and typed values in summaries.

## Write Method Doctrine

- Draft exact Airtable record create/update/delete payloads with field names and typed values.
- Validate required fields and select/status options against schema first.
- Bulk writes must be chunked and audited.
