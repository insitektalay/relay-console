# Coda Permissions and Scopes

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

## Provider Permission Model

Relevant permissions include doc read/write access implied by token and sharing. Schema/admin changes and bulk data writes require approval.

## Capability Mapping

- Read capability: inspect Coda docs, pages, tables, rows, columns, formulas, controls, permissions, and webhook metadata with bounded API calls.
- Draft capability: prepare exact Coda row insert/update/delete, cell-value, table/page/doc, formula/control, permission, or webhook payloads without side effects.
- Write capability: create/update/delete Coda rows and selected doc/table content only when token permissions, doc access, table schema, and approval policy allow it.
- Admin capability: Coda doc sharing/publishing, table/column schema changes, formula/control mutations, automation changes, webhook creation/deletion, doc deletion, and high-volume exports; disabled by default.
