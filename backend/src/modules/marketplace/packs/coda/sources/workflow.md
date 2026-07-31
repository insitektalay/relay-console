# Coda Workflow Router

Use Coda for structured document/table workflows involving docs, pages, tables, rows, columns, formulas, controls, webhooks.

Do not use Coda as an unrestricted database dump, chat system, or source-control replacement.

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

## Routing Doctrine

1. Confirm the connected Coda doc id, page/table/row/column/formula ids, API-token access, row identifiers, and webhook target before selecting tools.
2. Load auth, permissions, endpoint, rate-limit, webhook, error, safe-action, and workflow references before writes.
3. Resolve Coda doc ids, page ids, table ids/names, row ids, column ids/names, view ids, formula ids, control ids, and webhook ids from Coda APIs before mutating anything.
4. Draft row inserts/updates/deletes, bulk row changes, column/schema changes, formula/control changes, doc sharing/publishing, automation changes, webhook changes, and sensitive-table exports for approval.
5. Record Coda doc/page/table/row/column/formula/control/webhook ids, changed cell values, approval id, and safe response summaries after approved writes.

## When To Use

Use Coda for structured document/table workflows involving docs, pages, tables, rows, columns, formulas, controls, webhooks.

## When Not To Use

Do not use Coda as an unrestricted database dump, chat system, or source-control replacement.
