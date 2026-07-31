# Salesforce Errors and Failure Modes

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Handle invalid/expired sessions, insufficient OAuth scope, object CRUD denial, field-level security denial, sharing denial, invalid field API names, invalid picklist values, validation rules, duplicate rules, record locks, stale state, governor/API limits, Composite partial failures, and provider outages.

On failed writes, stop and report safe error categories with object ids. Do not retry side-effecting Composite/Bulk operations without fresh state and approval.
