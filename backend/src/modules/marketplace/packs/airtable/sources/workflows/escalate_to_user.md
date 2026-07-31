# Airtable Escalation

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Escalate when Airtable credentials are missing, PAT/OAuth scopes or base access are insufficient, base/table/record/field/view/webhook ids are ambiguous, the operation is approval-required, the request touches secrets or high-risk base data, Airtable returns conflicting schema/record state, or official docs do not cover the requested endpoint.

## Approval-Required Patterns

- Bulk record changes, schema/field changes, webhook changes, deletes, external shares, and automations require approval.
- Sensitive tables/views require approval before export.
- Changing formulas, columns, or document permissions requires approval.

## Blocked Patterns

- Token exposure, base/doc deletion, bypassing sharing restrictions, and unbounded export of sensitive tables are blocked.
