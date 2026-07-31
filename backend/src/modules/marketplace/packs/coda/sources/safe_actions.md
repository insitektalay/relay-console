# Coda Safe Actions

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Allowed Without Additional Approval

- Inspect Coda doc/page/table/column definitions before querying rows.
- Use filters/views/query parameters and bounded pagination.
- Preserve Coda row ids, column names, cell values, formula/control references, and typed values in summaries.

## Approval Required

- Bulk record changes, schema/field changes, webhook changes, deletes, external shares, and automations require approval.
- Sensitive tables/views require approval before export.
- Changing formulas, columns, or document permissions requires approval.

## Blocked

- Token exposure, base/doc deletion, bypassing sharing restrictions, and unbounded export of sensitive tables are blocked.

## Secret-Safety Rule

Provider secrets and credential-shaped values must never appear in responses, generated files, examples, audit notes, or provider-side comments/messages.
