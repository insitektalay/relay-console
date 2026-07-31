# Confluence Safe Actions

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Allowed Without Additional Approval

- Inspect Confluence space, page, parent, version, label, attachment, and restriction metadata before reading full content.
- Use filters/views/query parameters and bounded pagination.
- Preserve page ids, space keys, parent ids, version numbers, attachment ids, labels, and comment ids in summaries.

## Approval Required

- Bulk record changes, schema/field changes, webhook changes, deletes, external shares, and automations require approval.
- Sensitive tables/views require approval before export.
- Changing page restrictions, space permissions, labels used for policy, or document permissions requires approval.

## Blocked

- Token exposure, base/doc deletion, bypassing sharing restrictions, and unbounded export of sensitive tables are blocked.

## Secret-Safety Rule

Provider secrets and credential-shaped values must never appear in responses, generated files, examples, audit notes, or provider-side comments/messages.
