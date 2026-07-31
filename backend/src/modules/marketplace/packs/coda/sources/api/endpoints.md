# Coda Endpoint Families

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://coda.io/developers/apis/v1
- https://coda.io/developers/apis/v1#section/Authentication
- https://coda.io/developers/apis/v1#operation/listDocs
- https://coda.io/developers/apis/v1#section/Rate-limits
- https://coda.io/developers/apis/v1#section/Errors
- https://coda.io/developers/apis/v1#tag/Webhooks

- `GET /docs` and `GET /docs/{docId}` for accessible docs.
- `GET /docs/{docId}/pages` for page hierarchy.
- `GET /docs/{docId}/tables` and table metadata for schema inspection.
- `GET/POST /docs/{docId}/tables/{tableIdOrName}/rows` for row reads/inserts.
- `PUT /docs/{docId}/tables/{tableIdOrName}/rows/{rowIdOrName}` for row/cell updates.
- `GET /columns`, `GET /formulas`, and controls endpoints for table/doc logic.
- Coda webhooks endpoints for doc/table change notifications.

## Read Method Doctrine

- Inspect Coda doc/page/table/column definitions before querying rows.
- Use table/view/query parameters, visible column selection, and bounded pagination.
- Preserve Coda row ids, column names, cell values, formula/control references, and typed values in summaries.

## Write Method Doctrine

- Draft exact Coda row create/update/delete payloads with column names and typed cell values.
- Validate required columns, select/status options, lookup behavior, and formula-controlled columns against schema first.
- Bulk row writes must be chunked and audited.
