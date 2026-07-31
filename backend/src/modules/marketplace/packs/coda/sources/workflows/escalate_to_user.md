# Coda Escalation

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Escalate when Coda credentials are missing, token permissions or doc access are insufficient, doc/page/table/row/column/formula/control/webhook ids are ambiguous, the operation is approval-required, the request touches secrets or high-risk doc data, Coda returns conflicting schema/row state, or official docs do not cover the requested endpoint.

## Approval-Required Patterns

- Bulk record changes, schema/field changes, webhook changes, deletes, external shares, and automations require approval.
- Sensitive tables/views require approval before export.
- Changing formulas, columns, or document permissions requires approval.

## Blocked Patterns

- Token exposure, base/doc deletion, bypassing sharing restrictions, and unbounded export of sensitive tables are blocked.
