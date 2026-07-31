# Confluence Escalation

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Escalate when Confluence credentials are missing, Atlassian scopes/space permissions are insufficient, site/space/page/attachment/comment/version ids are ambiguous, the operation is approval-required, the request touches secrets or high-risk space data, Confluence returns conflicting version state, or official docs do not cover the requested endpoint.

## Approval-Required Patterns

- Bulk record changes, schema/field changes, webhook changes, deletes, external shares, and automations require approval.
- Sensitive tables/views require approval before export.
- Changing page restrictions, space permissions, labels used for policy, or document permissions requires approval.

## Blocked Patterns

- Token exposure, base/doc deletion, bypassing sharing restrictions, and unbounded export of sensitive tables are blocked.
