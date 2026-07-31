# Salesforce Permissions and Scopes

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Salesforce authorization is layered: OAuth scopes allow API access, but the running user still needs object CRUD permissions, sharing access, profile/permission-set grants, field-level security, record-type access, validation-rule compatibility, and sometimes feature licenses.

Use describe resources before writes. A field being present in user text is not proof it is readable or updateable.

Approval is required for connected-app scope changes, profile/permission-set changes, field permissions, sharing/admin settings, automation, Platform Events, CDC, metadata changes, Bulk/Composite writes, exports, merges, deletes, and customer-visible Case communication.

Blocked: bypassing FLS/CRUD/sharing, exposing tokens/session ids, disabling audit/security/compliance settings, deleting orgs, and destructive bulk actions.
